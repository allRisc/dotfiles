import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import {
	anthropicMessagesApi,
	createAssistantMessageEventStream,
	createProvider,
	type AssistantMessage,
	type AssistantMessageEvent,
	type AssistantMessageEventStream,
	type Context,
	type Model,
	type SimpleStreamOptions,
} from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * An apiKeyHelper-compatible Anthropic provider.
 *
 * Configure `apiKeyHelper` in ~/.pi/agent/settings.json (or set
 * PI_API_KEY_HELPER) to a shell command that prints an API key to stdout.
 * Its result is cached for five minutes by default, and a 401 invalidates the
 * cache and retries the request with a newly obtained key.
 */

const PROVIDER_ID = "anthropic-api-key-helper";
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 30 * 1000;
const MAX_AUTH_ATTEMPTS = 3;
const execFileAsync = promisify(execFile);

type HelperSettings = {
	apiKeyHelper?: unknown;
	apiKeyHelperTtlMs?: unknown;
	apiKeyHelperTimeoutMs?: unknown;
};

type CachedKey = { value: string; expiresAt: number };

let cachedKey: CachedKey | undefined;
let pendingKey: Promise<string> | undefined;

function numberSetting(value: unknown, fallback: number): number {
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readSettings(): HelperSettings {
	try {
		return JSON.parse(readFileSync(`${process.env.HOME}/.pi/agent/settings.json`, "utf8")) as HelperSettings;
	} catch {
		return {};
	}
}

function configuration(): { command?: string; ttlMs: number; timeoutMs: number } {
	const settings = readSettings();
	const command = process.env.PI_API_KEY_HELPER ?? settings.apiKeyHelper;
	return {
		command: typeof command === "string" && command.trim() ? command : undefined,
		// Honor Claude Code's TTL variable as well, so the same shell environment
		// can configure both clients.
		ttlMs: numberSetting(
			process.env.PI_API_KEY_HELPER_TTL_MS ?? process.env.CLAUDE_CODE_API_KEY_HELPER_TTL_MS ?? settings.apiKeyHelperTtlMs,
			DEFAULT_TTL_MS,
		),
		timeoutMs: numberSetting(process.env.PI_API_KEY_HELPER_TIMEOUT_MS ?? settings.apiKeyHelperTimeoutMs, DEFAULT_TIMEOUT_MS),
	};
}

async function executeHelper(command: string, timeoutMs: number): Promise<string> {
	try {
		const { stdout } = await execFileAsync(process.env.SHELL || "/bin/sh", ["-lc", command], {
			timeout: timeoutMs,
			maxBuffer: 64 * 1024,
		});
		const key = stdout.trim();
		if (!key) throw new Error("apiKeyHelper printed no API key");
		return key;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`apiKeyHelper failed: ${message}`);
	}
}

async function getApiKey(forceRefresh = false): Promise<string> {
	const { command, ttlMs, timeoutMs } = configuration();
	if (!command) throw new Error("apiKeyHelper is not configured");

	if (!forceRefresh && cachedKey && cachedKey.expiresAt > Date.now()) return cachedKey.value;
	if (pendingKey) return pendingKey;

	pendingKey = executeHelper(command, timeoutMs)
		.then((value) => {
			cachedKey = { value, expiresAt: Date.now() + ttlMs };
			return value;
		})
		.finally(() => {
			pendingKey = undefined;
		});
	return pendingKey;
}

function errorStream(model: Model<"anthropic-messages">, error: unknown): AssistantMessageEventStream {
	const stream = createAssistantMessageEventStream();
	const message: AssistantMessage = {
		role: "assistant",
		content: [],
		api: model.api,
		provider: model.provider,
		model: model.id,
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "error",
		errorMessage: error instanceof Error ? error.message : String(error),
		timestamp: Date.now(),
	};
	queueMicrotask(() => {
		stream.push({ type: "error", reason: "error", error: message });
		stream.end();
	});
	return stream;
}

function isUnauthorized(event: AssistantMessageEvent, status: number | undefined): boolean {
	return event.type === "error" && (status === 401 || /\b401\b|unauthori[sz]ed/i.test(event.error.errorMessage ?? ""));
}

function streamWithHelper(
	model: Model<"anthropic-messages">,
	context: Context,
	options?: SimpleStreamOptions,
): AssistantMessageEventStream {
	const stream = createAssistantMessageEventStream();

	(async () => {
		try {
			for (let attempt = 1; attempt <= MAX_AUTH_ATTEMPTS; attempt++) {
				const apiKey = await getApiKey(attempt > 1);
				let responseStatus: number | undefined;
				let retry = false;
				const inner = anthropicMessagesApi().streamSimple(model, context, {
					...options,
					apiKey,
					onResponse: async (response, responseModel) => {
						responseStatus = response.status;
						await options?.onResponse?.(response, responseModel);
					},
				});

				for await (const event of inner) {
					if (isUnauthorized(event, responseStatus) && attempt < MAX_AUTH_ATTEMPTS) {
						cachedKey = undefined;
						retry = true;
						break;
					}
					stream.push(event);
				}
				if (retry) continue;
				stream.end();
				return;
			}
		} catch (error) {
			const failed = errorStream(model, error);
			for await (const event of failed) stream.push(event);
		}
		stream.end();
	})();

	return stream;
}

const models: Model<"anthropic-messages">[] = [
	{
		id: "claude-sonnet-4-5",
		name: "Claude Sonnet 4.5 (apiKeyHelper)",
		api: "anthropic-messages",
		provider: PROVIDER_ID,
		baseUrl: "https://api.anthropic.com",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
		contextWindow: 1_000_000,
		maxTokens: 64_000,
		compat: { supportsStrictTools: true },
	},
	{
		id: "claude-sonnet-4-6",
		name: "Claude Sonnet 4.6 (apiKeyHelper)",
		api: "anthropic-messages",
		provider: PROVIDER_ID,
		baseUrl: "https://api.anthropic.com",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
		contextWindow: 1_000_000,
		maxTokens: 128_000,
		thinkingLevelMap: { max: "max" },
		compat: { forceAdaptiveThinking: true, supportsStrictTools: true },
	},
	{
		id: "claude-opus-4-6",
		name: "Claude Opus 4.6 (apiKeyHelper)",
		api: "anthropic-messages",
		provider: PROVIDER_ID,
		baseUrl: "https://api.anthropic.com",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
		contextWindow: 1_000_000,
		maxTokens: 128_000,
		thinkingLevelMap: { max: "max" },
		compat: { forceAdaptiveThinking: true, supportsStrictTools: true },
	},
];

export default function apiKeyHelperProvider(pi: ExtensionAPI): void {
	pi.registerProvider(
		createProvider({
			id: PROVIDER_ID,
			name: "Anthropic (apiKeyHelper)",
			baseUrl: "https://api.anthropic.com",
			auth: {
				apiKey: {
					name: "apiKeyHelper",
					async login() {
						throw new Error("Configure apiKeyHelper in ~/.pi/agent/settings.json instead of using /login");
					},
					async resolve() {
						return configuration().command
							? { auth: { apiKey: "api-key-helper" }, source: "apiKeyHelper" }
							: undefined;
					},
				},
			},
			models,
			api: {
				stream: streamWithHelper,
				streamSimple: streamWithHelper,
			},
		}),
	);
}

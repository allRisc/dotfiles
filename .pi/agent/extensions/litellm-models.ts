import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Auto-discover the models exposed by the local LiteLLM proxy.
 *
 * pi does not natively poll a provider's /v1/models endpoint, so this
 * extension registers the `litellm` provider with a `refreshModels` callback.
 * pi calls that callback at startup (and on model refresh / `--list-models`),
 * so the model list always mirrors whatever the proxy currently serves — no
 * manual edits to models.json needed.
 *
 * Because this replaces the litellm block, that provider should NOT also be
 * defined in models.json (a static models array there would win over this).
 */

const BASE_URL = "http://localhost:17291/up/v1";
const API_KEY = "test";

// Provider-level OpenAI compatibility settings (previously in models.json).
const COMPAT = {
	supportsUsageInStreaming: true,
	maxTokensField: "max_tokens" as const,
};

// Skip embeddings, rerankers, and other non-chat models.
const SKIP_SUBSTRINGS = [
	"embed",
	"rerank",
	"bge",
	"bert",
	"minilm",
	"mpnet",
];

// pi expects cost per million tokens; LiteLLM reports cost per token.
const TOKENS_PER_MILLION = 1_000_000;

type ModelCost = {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
};

const ZERO_COST: ModelCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

interface LiteLLMModel {
	id: string;
	max_input_tokens?: number;
	max_output_tokens?: number;
}

interface LiteLLMModelInfo {
	model_name: string;
	model_info?: {
		input_cost_per_token?: number | null;
		output_cost_per_token?: number | null;
		cache_read_input_token_cost?: number | null;
		cache_creation_input_token_cost?: number | null;
	};
}

// Fetch per-model pricing from the proxy's /model/info endpoint and convert
// the per-token costs into pi's per-million-token units.
async function fetchCostMap(
	signal?: AbortSignal,
): Promise<Record<string, ModelCost>> {
	const response = await fetch(`${BASE_URL}/model/info`, {
		headers: { Authorization: `Bearer ${API_KEY}` },
		signal,
	});
	if (!response.ok) {
		throw new Error(
			`LiteLLM /model/info returned ${response.status} ${response.statusText}`,
		);
	}
	const payload = (await response.json()) as { data: LiteLLMModelInfo[] };

	const costs: Record<string, ModelCost> = {};
	for (const entry of payload.data) {
		const info = entry.model_info;
		if (!info) continue;
		costs[entry.model_name] = {
			input: (info.input_cost_per_token ?? 0) * TOKENS_PER_MILLION,
			output: (info.output_cost_per_token ?? 0) * TOKENS_PER_MILLION,
			cacheRead:
				(info.cache_read_input_token_cost ?? 0) * TOKENS_PER_MILLION,
			cacheWrite:
				(info.cache_creation_input_token_cost ?? 0) * TOKENS_PER_MILLION,
		};
	}
	return costs;
}

function isChatModel(id: string): boolean {
	const low = id.toLowerCase();
	return !SKIP_SUBSTRINGS.some((s) => low.includes(s));
}

export default function litellmModelsExtension(pi: ExtensionAPI): void {
	pi.registerProvider("litellm", {
		name: "LiteLLM",
		baseUrl: BASE_URL,
		apiKey: API_KEY,
		api: "openai-completions",
		compat: COMPAT,
		// Called by pi during model refresh (startup, /model, --list-models).
		async refreshModels({ signal }) {
			const [response, costMap] = await Promise.all([
				fetch(`${BASE_URL}/models`, {
					headers: { Authorization: `Bearer ${API_KEY}` },
					signal,
				}),
				fetchCostMap(signal),
			]);
			if (!response.ok) {
				throw new Error(
					`LiteLLM /models returned ${response.status} ${response.statusText}`,
				);
			}
			const payload = (await response.json()) as { data: LiteLLMModel[] };

			return payload.data
				.filter((m) => isChatModel(m.id))
				.map((m) => ({
					id: m.id,
					name: m.id,
					reasoning: m.id.toLowerCase().includes("claude"),
					input: ["text"] as const,
					contextWindow: m.max_input_tokens ?? 128000,
					maxTokens: m.max_output_tokens ?? 16384,
					cost: costMap[m.id] ?? ZERO_COST,
					compat: COMPAT,
				}));
		},
	});
}

import {
	DynamicBorder,
	getAgentDir,
	getSettingsListTheme,
	type ExtensionAPI,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	Container,
	Key,
	matchesKey,
	type SettingItem,
	SettingsList,
	Text,
} from "@earendil-works/pi-tui";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * System prompt bits
 *
 * `/bits` opens a searchable list of "system prompt bits" and toggles which
 * ones are applied for the current run. It behaves like `/tools` and
 * `/skills`, but instead of tools or skills it manages fragments of system
 * prompt text.
 *
 * Custom bits are defined in a single global JSON file:
 *
 *   ~/.pi/agent/sys_prompt_bits.json
 *
 * Each enabled custom bit has its `content` appended to the end of the system
 * prompt. A built-in pseudo bit ("Pi self-modification docs") controls the
 * built-in "Pi documentation (...)" block that Pi normally appends near the
 * end of the system prompt; disabling it removes that block for the run.
 *
 * The selection is stored in the session as a `sys-prompt-bit-toggle` entry,
 * so it survives `/reload` and session resume, and follows branch navigation.
 *
 * Toggling only changes the *next* system prompt: pi rebuilds the prompt via
 * the `before_agent_start` hook, which only fires when a new message is sent.
 * There is no API to rewrite the already-built prompt outside of a turn, so
 * `ctx.getSystemPrompt()` (and therefore `/show-system-prompt`) keeps showing
 * the prompt as of the last message until you send another one. The actual
 * request sent to the model is correct starting with your very next message.
 *
 * Flag:
 *   --bits none         start with every bit disabled
 *   --bits all          start with every bit enabled
 *   --bits a,b          start with only the listed bits enabled
 *
 * JSON shapes accepted in sys_prompt_bits.json:
 *   { "bits": [ { "name": "x", "description": "...", "content": "...", "enabled": false } ] }
 *   [ { "name": "x", "content": "..." } ]
 *   { "x": { "description": "...", "content": "...", "enabled": true }, "y": "raw content" }
 */

const ENTRY_TYPE = "sys-prompt-bit-toggle";
const STATUS_KEY = "sys-prompt-bit-toggle";
const ENABLED = "enabled";
const DISABLED = "disabled";

/** Reserved id for the built-in "modify Pi" documentation block. */
const PI_DOCS_ID = "__pi_docs__";

/**
 * Matches the built-in "Pi documentation (...)" block that pi appends near the
 * end of the system prompt (see dist/core/system-prompt.js). Non-greedy up to
 * the unique closing phrase so nothing after it is consumed.
 */
const PI_DOCS_REGEX =
	/\n\nPi documentation \(read only when the user asks about pi itself[\s\S]*?tui\.md for TUI API details\)/;

interface Bit {
	name: string;
	description: string;
	content: string;
	/** Default enabled state used when there is no saved decision. */
	enabled: boolean;
}

interface BitToggleState {
	/** Bit ids that are enabled (may include PI_DOCS_ID). */
	enabledBits: string[];
	/** Ids known when this state was saved, used to default newly-added bits. */
	knownBits?: string[];
}

const bitsFilePath = (): string => join(getAgentDir(), "sys_prompt_bits.json");

const EXAMPLE_FILE = `{
  "bits": [
    {
      "name": "example-bit",
      "description": "Example system prompt bit (disabled). Edit or remove me.",
      "content": "When writing code, prefer clarity over cleverness.",
      "enabled": false
    }
  ]
}
`;

const firstLine = (text: string | undefined): string => {
	const line = (text ?? "").split("\n", 1)[0]?.trim() ?? "";
	return line.length > 120 ? `${line.slice(0, 117)}...` : line;
};

const parseList = (value: string): string[] =>
	value
		.split(/[,\s]+/)
		.map((name) => name.trim())
		.filter((name) => name.length > 0);

/** Coerce one raw entry into a Bit, or return undefined when unusable. */
const toBit = (name: unknown, raw: unknown): Bit | undefined => {
	const bitName = typeof name === "string" ? name.trim() : "";
	if (typeof raw === "string") {
		if (!bitName || raw.trim().length === 0) return undefined;
		return { name: bitName, description: "", content: raw, enabled: false };
	}
	if (raw && typeof raw === "object") {
		const obj = raw as Record<string, unknown>;
		const resolvedName = bitName || (typeof obj.name === "string" ? obj.name.trim() : "");
		const content = typeof obj.content === "string" ? obj.content : "";
		if (!resolvedName || content.trim().length === 0) return undefined;
		return {
			name: resolvedName,
			description: typeof obj.description === "string" ? obj.description : "",
			content,
			enabled: obj.enabled === true,
		};
	}
	return undefined;
};

/** Normalize the various accepted JSON shapes into a de-duplicated Bit[]. */
const normalizeBits = (parsed: unknown): Bit[] => {
	let list: Bit[] = [];
	if (Array.isArray(parsed)) {
		list = parsed.map((entry) => toBit(undefined, entry)).filter((b): b is Bit => !!b);
	} else if (parsed && typeof parsed === "object") {
		const obj = parsed as Record<string, unknown>;
		if (Array.isArray(obj.bits)) {
			list = obj.bits.map((entry) => toBit(undefined, entry)).filter((b): b is Bit => !!b);
		} else {
			list = Object.entries(obj)
				.map(([key, value]) => toBit(key, value))
				.filter((b): b is Bit => !!b);
		}
	}
	// De-duplicate by name (first wins) and never let a custom bit hijack the
	// reserved pi-docs id.
	const seen = new Set<string>([PI_DOCS_ID]);
	const result: Bit[] = [];
	for (const bit of list) {
		if (seen.has(bit.name)) continue;
		seen.add(bit.name);
		result.push(bit);
	}
	return result;
};

export default function sysPromptBitsExtension(pi: ExtensionAPI) {
	pi.registerFlag("bits", {
		description: "System prompt bits to enable this run: all, none, or a comma separated list",
		type: "string",
		default: "",
	});

	/** Bit ids currently enabled (includes PI_DOCS_ID when the pi docs block is on). */
	let enabled = new Set<string>();
	let customBits: Bit[] = [];
	let lastKnownIds: Set<string> | null = null;
	let flagsApplied = false;
	let stateRestored = false;
	let loadError: string | undefined;

	const knownIds = (): string[] => [PI_DOCS_ID, ...customBits.map((bit) => bit.name)];

	const defaultEnabledFor = (id: string): boolean => {
		if (id === PI_DOCS_ID) return true; // pi ships with the docs block on
		return customBits.find((bit) => bit.name === id)?.enabled ?? false;
	};

	const defaultsEnabled = (): Set<string> => new Set(knownIds().filter(defaultEnabledFor));

	/** Read and parse the bits file from disk. */
	const loadBits = (): void => {
		const path = bitsFilePath();
		loadError = undefined;
		if (!existsSync(path)) {
			// File genuinely absent: no custom bits.
			customBits = [];
			return;
		}
		try {
			customBits = normalizeBits(JSON.parse(readFileSync(path, "utf8")));
		} catch (error) {
			// Likely a mid-edit / transient parse error. Keep the last good bits so we
			// don't drop the user's session choices; surface the error instead.
			loadError = `Failed to read ${path}: ${(error as Error).message}`;
		}
	};

	/**
	 * Keep the enabled set consistent with the current bits on disk: drop bits
	 * that disappeared and enable newly-added bits that default to on.
	 */
	const reconcile = (): void => {
		const known = new Set(knownIds());
		for (const id of [...enabled]) {
			if (!known.has(id)) enabled.delete(id);
		}
		if (lastKnownIds) {
			for (const id of known) {
				if (!lastKnownIds.has(id) && defaultEnabledFor(id)) enabled.add(id);
			}
		}
		lastKnownIds = known;
	};

	const refresh = (): void => {
		loadBits();
		reconcile();
	};

	const updateStatus = (ctx: ExtensionContext): void => {
		const activeCustom = customBits.filter((bit) => enabled.has(bit.name)).length;
		const piDocsOff = !enabled.has(PI_DOCS_ID);
		const parts: string[] = [];
		if (activeCustom > 0) parts.push(`✎ ${activeCustom} bit${activeCustom === 1 ? "" : "s"}`);
		if (piDocsOff) parts.push("⊘ pi-docs");
		ctx.ui.setStatus(
			STATUS_KEY,
			parts.length === 0 ? undefined : ctx.ui.theme.fg("warning", parts.join(" ")),
		);
	};

	const persist = (): void => {
		pi.appendEntry<BitToggleState>(ENTRY_TYPE, {
			enabledBits: [...enabled].sort(),
			knownBits: knownIds().sort(),
		});
	};

	/** Apply `--bits` once, on the first session start. */
	const applyFlags = (): boolean => {
		if (flagsApplied) return false;
		flagsApplied = true;

		const raw = String(pi.getFlag("bits") ?? "").trim();
		if (raw === "") return false;
		if (raw.toLowerCase() === "none") {
			enabled = new Set();
			return true;
		}
		if (raw.toLowerCase() === "all") {
			enabled = new Set(knownIds());
			return true;
		}

		const requested = parseList(raw);
		if (requested.length === 0) return false;
		const known = new Set(knownIds());
		const unknown = requested.filter((name) => !known.has(name));
		enabled = new Set(requested.filter((name) => known.has(name)));
		if (unknown.length > 0) pi.appendEntry("sys-prompt-bit-warning", { unknown });
		return true;
	};

	/** Restore the last `sys-prompt-bit-toggle` entry of the current branch. */
	const restore = (ctx: ExtensionContext, applyStartupFlags: boolean): void => {
		loadBits();
		const known = new Set(knownIds());

		let saved: string[] | undefined;
		let savedKnown: string[] | undefined;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === ENTRY_TYPE) {
				const data = entry.data as BitToggleState | undefined;
				if (data?.enabledBits) {
					saved = data.enabledBits;
					savedKnown = data.knownBits;
				}
			}
		}

		if (saved) {
			enabled = new Set(saved.filter((id) => known.has(id)));
			// Bits added since the state was saved should follow their defaults
			// rather than silently defaulting to off.
			const previouslyKnown = new Set(savedKnown ?? []);
			for (const id of knownIds()) {
				if (!previouslyKnown.has(id) && defaultEnabledFor(id)) enabled.add(id);
			}
		} else {
			enabled = defaultsEnabled();
		}

		lastKnownIds = known;
		const changedByFlags = applyStartupFlags ? applyFlags() : false;
		stateRestored = true;
		updateStatus(ctx);
		if (changedByFlags) persist();
	};

	// Modify the system prompt for the turn: strip the pi docs block when its
	// toggle is off, then append every enabled custom bit's content.
	pi.on("before_agent_start", async (event, ctx) => {
		if (!stateRestored) restore(ctx, true);
		else refresh();

		let systemPrompt = event.systemPrompt;
		if (!enabled.has(PI_DOCS_ID)) {
			systemPrompt = systemPrompt.replace(PI_DOCS_REGEX, "");
		}
		const active = customBits.filter((bit) => enabled.has(bit.name));
		if (active.length > 0) {
			systemPrompt += `\n\n${active.map((bit) => bit.content).join("\n\n")}`;
		}
		updateStatus(ctx);
		return { systemPrompt };
	});

	pi.registerCommand("bits", {
		description: "Enable/disable system prompt bits for this run",
		handler: async (args, ctx) => {
			refresh();
			if (!stateRestored) restore(ctx, true);

			// Create a starter file the first time, so there is something to edit.
			const path = bitsFilePath();
			if (!existsSync(path) && customBits.length === 0) {
				try {
					writeFileSync(path, EXAMPLE_FILE);
					ctx.ui.notify(`Created example bits file: ${path}`, "info");
				} catch (error) {
					ctx.ui.notify(`Could not create ${path}: ${(error as Error).message}`, "warning");
				}
			}
			if (loadError) ctx.ui.notify(loadError, "error");

			const listLabel = (id: string): string =>
				id === PI_DOCS_ID ? "Pi self-modification docs" : id;

			// Non-interactive shortcuts: /bits all, /bits none, /bits list
			const arg = args.trim().toLowerCase();
			if (arg === "all" || arg === "none" || arg === "list") {
				if (arg === "list") {
					const lines = knownIds().map(
						(id) => `${enabled.has(id) ? "✓" : "⊘"} ${listLabel(id)}`,
					);
					ctx.ui.notify(lines.join("\n"), "info");
					return;
				}
				enabled = arg === "all" ? new Set(knownIds()) : new Set();
				persist();
				updateStatus(ctx);
				ctx.ui.notify(
					`${arg === "all" ? "All bits enabled" : "All bits disabled"} (applies starting with your next message; /show-system-prompt still shows the prompt as of your last message)`,
					"info",
				);
				return;
			}

			if (ctx.mode !== "tui") {
				ctx.ui.notify("/bits requires TUI mode (try /bits all|none|list)", "error");
				return;
			}

			let dirty = false;

			await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
				const piDocsItem: SettingItem = {
					id: PI_DOCS_ID,
					label: "Pi self-modification docs",
					description:
						"Built-in Pi documentation/extension instructions appended near the end of the system prompt",
					currentValue: enabled.has(PI_DOCS_ID) ? ENABLED : DISABLED,
					values: [ENABLED, DISABLED],
				};
				const bitItems: SettingItem[] = customBits.map((bit) => ({
					id: bit.name,
					label: bit.name,
					description: firstLine(bit.description || bit.content),
					currentValue: enabled.has(bit.name) ? ENABLED : DISABLED,
					values: [ENABLED, DISABLED],
				}));
				const items = [piDocsItem, ...bitItems];

				const container = new Container();
				container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
				container.addChild(
					new Text(theme.fg("accent", theme.bold("System prompt bits for this run")), 1, 0),
				);

				const settingsList = new SettingsList(
					items,
					Math.min(items.length + 2, 15),
					getSettingsListTheme(),
					(id, newValue) => {
						if (newValue === ENABLED) enabled.add(id);
						else enabled.delete(id);
						dirty = true;
					},
					() => done(undefined),
					{ enableSearch: true },
				);
				container.addChild(settingsList);
				container.addChild(
					new Text(
						theme.fg(
							"dim",
							"↑↓ navigate • enter/space toggle • ctrl+a all • ctrl+n none • esc close",
						),
						1,
						0,
					),
				);
				container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

				const setAll = (value: boolean): void => {
					enabled = value ? new Set(knownIds()) : new Set();
					for (const id of knownIds()) {
						settingsList.updateValue(id, value ? ENABLED : DISABLED);
					}
					dirty = true;
				};

				return {
					render: (width: number) => container.render(width),
					invalidate: () => container.invalidate(),
					handleInput: (data: string) => {
						if (matchesKey(data, Key.ctrl("a"))) setAll(true);
						else if (matchesKey(data, Key.ctrl("n"))) setAll(false);
						else settingsList.handleInput?.(data);
						tui.requestRender();
					},
				};
			});

			if (dirty) {
				persist();
				ctx.ui.notify(
					"Bit selection saved. Changes apply starting with your next message; the prompt shown by /show-system-prompt won't update until then.",
					"info",
				);
			}
			updateStatus(ctx);
		},
	});

	pi.registerEntryRenderer("sys-prompt-bit-warning", (entry, _options, theme) => {
		const unknown = (entry.data as { unknown: string[] }).unknown.join(", ");
		return new Text(theme.fg("warning", `Unknown system prompt bits ignored: ${unknown}`));
	});

	pi.on("session_start", async (_event, ctx) => {
		stateRestored = false;
		lastKnownIds = null;
		ctx.ui.setStatus(STATUS_KEY, undefined);
		restore(ctx, true);
	});

	pi.on("session_tree", async (_event, ctx) => {
		stateRestored = false;
		lastKnownIds = null;
		ctx.ui.setStatus(STATUS_KEY, undefined);
		restore(ctx, false);
	});
}

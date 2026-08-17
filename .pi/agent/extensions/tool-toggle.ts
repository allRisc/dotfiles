import type { ExtensionAPI, ExtensionContext, ToolInfo } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import {
	Container,
	Key,
	matchesKey,
	type SettingItem,
	SettingsList,
	Text,
} from "@earendil-works/pi-tui";

/**
 * Tool toggle
 *
 * `/tools` opens a searchable list of custom (non built-in) tools and toggles
 * each one for the current run. Disabled tools are removed from the active tool
 * set, so they disappear from the system prompt and cannot be called.
 *
 * The selection is stored in the session as a `tool-toggle` entry, so it
 * survives `/reload` and session resume, and follows branch navigation.
 *
 * Flag:
 *   --custom-tools none         start with every custom tool disabled
 *   --custom-tools all          start with every custom tool enabled
 *   --custom-tools a,b          start with only the listed custom tools enabled
 */

const ENTRY_TYPE = "tool-toggle";
const STATUS_KEY = "tool-toggle";
const ENABLED = "enabled";
const DISABLED = "disabled";

interface ToolToggleState {
	/** Custom tools that are enabled. Built-in tools are never listed here. */
	enabledCustomTools: string[];
}

/** Tools that come from extensions, SDK hosts, or MCP-like sources (everything but built-ins). */
const isCustomTool = (tool: ToolInfo): boolean => tool.sourceInfo.source !== "builtin";

const firstLine = (text: string | undefined): string => {
	const line = (text ?? "").split("\n", 1)[0]?.trim() ?? "";
	return line.length > 120 ? `${line.slice(0, 117)}...` : line;
};

const parseList = (value: string): string[] =>
	value
		.split(/[,\s]+/)
		.map((name) => name.trim())
		.filter((name) => name.length > 0);

export default function toolToggleExtension(pi: ExtensionAPI) {
	pi.registerFlag("custom-tools", {
		description: "Custom tools to enable this run: all, none, or a comma separated list",
		type: "string",
		default: "",
	});

	/** Custom tools currently enabled. */
	let enabled = new Set<string>();
	let customTools: ToolInfo[] = [];
	let flagsApplied = false;

	const refreshCustomTools = (): void => {
		customTools = pi.getAllTools().filter(isCustomTool);
	};

	const customToolNames = (): string[] => customTools.map((tool) => tool.name);

	/** Rewrite the active tool set: keep every built-in, keep only enabled custom tools. */
	const applyTools = (): void => {
		const custom = new Set(customToolNames());
		const active = pi.getActiveTools().filter((name) => !custom.has(name));
		for (const name of customToolNames()) {
			if (enabled.has(name)) active.push(name);
		}
		pi.setActiveTools([...new Set(active)]);
	};

	const updateStatus = (ctx: ExtensionContext): void => {
		const disabled = customTools.filter((tool) => !enabled.has(tool.name)).length;
		if (disabled === 0) {
			ctx.ui.setStatus(STATUS_KEY, undefined);
			return;
		}
		ctx.ui.setStatus(
			STATUS_KEY,
			ctx.ui.theme.fg("warning", `⊘ ${disabled} tool${disabled === 1 ? "" : "s"}`),
		);
	};

	const persist = (): void => {
		pi.appendEntry<ToolToggleState>(ENTRY_TYPE, {
			enabledCustomTools: [...enabled].sort(),
		});
	};

	/** Apply `--custom-tools` once, on the first session start. */
	const applyFlags = (): boolean => {
		if (flagsApplied) return false;
		flagsApplied = true;

		const raw = String(pi.getFlag("custom-tools") ?? "").trim();
		if (raw === "") return false;
		if (raw.toLowerCase() === "none") {
			enabled = new Set();
			return true;
		}
		if (raw.toLowerCase() === "all") {
			enabled = new Set(customToolNames());
			return true;
		}

		const requested = parseList(raw);
		if (requested.length === 0) return false;

		const known = new Set(customToolNames());
		const unknown = requested.filter((name) => !known.has(name));
		enabled = new Set(requested.filter((name) => known.has(name)));
		if (unknown.length > 0) {
			pi.appendEntry("tool-toggle-warning", { unknown });
		}
		return true;
	};

	/** Restore the last `tool-toggle` entry of the current branch. */
	const restore = (ctx: ExtensionContext, applyStartupFlags: boolean): void => {
		refreshCustomTools();
		const known = new Set(customToolNames());

		let saved: string[] | undefined;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === ENTRY_TYPE) {
				const data = entry.data as ToolToggleState | undefined;
				if (data?.enabledCustomTools) saved = data.enabledCustomTools;
			}
		}

		if (saved) {
			enabled = new Set(saved.filter((name) => known.has(name)));
		} else {
			// No stored decision: everything currently active stays enabled.
			enabled = new Set(pi.getActiveTools().filter((name) => known.has(name)));
		}

		const changedByFlags = applyStartupFlags ? applyFlags() : false;
		applyTools();
		updateStatus(ctx);
		if (changedByFlags) persist();
	};

	pi.registerCommand("tools", {
		description: "Enable/disable custom tools for this run",
		handler: async (args, ctx) => {
			refreshCustomTools();

			if (customTools.length === 0) {
				ctx.ui.notify("No custom tools are registered", "warning");
				return;
			}

			// Non-interactive shortcuts: /tools all, /tools none, /tools list
			const arg = args.trim().toLowerCase();
			if (arg === "all" || arg === "none" || arg === "list") {
				if (arg === "list") {
					const lines = customTools.map(
						(tool) => `${enabled.has(tool.name) ? "✓" : "⊘"} ${tool.name}`,
					);
					ctx.ui.notify(lines.join("\n"), "info");
					return;
				}
				enabled = arg === "all" ? new Set(customToolNames()) : new Set();
				applyTools();
				persist();
				updateStatus(ctx);
				ctx.ui.notify(
					arg === "all" ? "All custom tools enabled" : "All custom tools disabled",
					"info",
				);
				return;
			}

			if (ctx.mode !== "tui") {
				ctx.ui.notify("/tools requires TUI mode (try /tools all|none|list)", "error");
				return;
			}

			let dirty = false;

			await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
				const items: SettingItem[] = customTools.map((tool) => ({
					id: tool.name,
					label: tool.name,
					description: `${firstLine(tool.description)} [${tool.sourceInfo.source}]`,
					currentValue: enabled.has(tool.name) ? ENABLED : DISABLED,
					values: [ENABLED, DISABLED],
				}));

				const container = new Container();
				container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
				container.addChild(
					new Text(theme.fg("accent", theme.bold("Custom tools for this run")), 1, 0),
				);

				const settingsList = new SettingsList(
					items,
					Math.min(items.length + 2, 15),
					getSettingsListTheme(),
					(id, newValue) => {
						if (newValue === ENABLED) enabled.add(id);
						else enabled.delete(id);
						dirty = true;
						applyTools();
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
					enabled = value ? new Set(customToolNames()) : new Set();
					for (const name of customToolNames()) {
						settingsList.updateValue(name, value ? ENABLED : DISABLED);
					}
					dirty = true;
					applyTools();
				};

				return {
					render: (width: number) => container.render(width),
					invalidate: () => container.invalidate(),
					handleInput: (data: string) => {
						if (matchesKey(data, Key.ctrl("a"))) {
							setAll(true);
						} else if (matchesKey(data, Key.ctrl("n"))) {
							setAll(false);
						} else {
							settingsList.handleInput?.(data);
						}
						tui.requestRender();
					},
				};
			});

			if (dirty) persist();
			updateStatus(ctx);
		},
	});

	pi.registerEntryRenderer("tool-toggle-warning", (entry, _options, theme) => {
		const unknown = (entry.data as { unknown: string[] }).unknown.join(", ");
		return new Text(theme.fg("warning", `Unknown custom tools ignored: ${unknown}`));
	});

	pi.on("session_start", async (_event, ctx) => {
		restore(ctx, true);
	});

	pi.on("session_tree", async (_event, ctx) => {
		restore(ctx, false);
	});
}

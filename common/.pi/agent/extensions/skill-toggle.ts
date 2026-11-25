import {
	formatSkillsForPrompt,
	DynamicBorder,
	getSettingsListTheme,
	type ExtensionAPI,
	type ExtensionContext,
	type Skill,
} from "@earendil-works/pi-coding-agent";
import {
	Container,
	Key,
	matchesKey,
	type SettingItem,
	SettingsList,
	Text,
} from "@earendil-works/pi-tui";

/**
 * Skill toggle
 *
 * `/skills` opens a searchable list of discovered skills and toggles which
 * skills are advertised to the model for the current run. Disabled skills
 * are also blocked when explicitly invoked with /skill:name.
 *
 * The selection is stored in the session as a `skill-toggle` entry, so it
 * survives reload, resume, and follows session tree navigation.
 *
 * Flag:
 *   --skills none         start with every skill disabled
 *   --skills all          start with every skill enabled
 *   --skills a,b          start with only the listed skills enabled
 */

const ENTRY_TYPE = "skill-toggle";
const STATUS_KEY = "skill-toggle";
const ENABLED = "enabled";
const DISABLED = "disabled";

interface SkillToggleState {
	enabledSkills: string[];
}

const firstLine = (text: string | undefined): string => {
	const line = (text ?? "").split("\n", 1)[0]?.trim() ?? "";
	return line.length > 120 ? `${line.slice(0, 117)}...` : line;
};

const parseList = (value: string): string[] =>
	value
		.split(/[,\s]+/)
		.map((name) => name.trim())
		.filter((name) => name.length > 0);

export default function skillToggleExtension(pi: ExtensionAPI) {
	pi.registerFlag("skills", {
		description: "Skills to enable this run: all, none, or a comma separated list",
		type: "string",
		default: "",
	});

	let enabled = new Set<string>();
	let skills: Skill[] = [];
	let flagsApplied = false;
	let stateRestored = false;

	const refreshSkills = (ctx: ExtensionContext): void => {
		// The resource loader's skill list is exposed through the system prompt
		// options. This avoids reimplementing Pi's discovery and collision rules.
		skills = (ctx.getSystemPromptOptions().skills ?? []) as Skill[];
	};

	const skillNames = (): string[] => skills.map((skill) => skill.name);

	const updateStatus = (ctx: ExtensionContext): void => {
		const disabled = skills.filter((skill) => !enabled.has(skill.name)).length;
		ctx.ui.setStatus(
			STATUS_KEY,
			disabled === 0
				? undefined
				: ctx.ui.theme.fg("warning", `⊘ ${disabled} skill${disabled === 1 ? "" : "s"}`),
		);
	};

	const persist = (): void => {
		pi.appendEntry<SkillToggleState>(ENTRY_TYPE, {
			enabledSkills: [...enabled].sort(),
		});
	};

	const applyFlags = (): boolean => {
		if (flagsApplied) return false;
		flagsApplied = true;

		const raw = String(pi.getFlag("skills") ?? "").trim();
		if (raw === "") return false;
		if (raw.toLowerCase() === "none") {
			enabled = new Set();
			return true;
		}
		if (raw.toLowerCase() === "all") {
			enabled = new Set(skillNames());
			return true;
		}

		const requested = parseList(raw);
		if (requested.length === 0) return false;
		const known = new Set(skillNames());
		const unknown = requested.filter((name) => !known.has(name));
		enabled = new Set(requested.filter((name) => known.has(name)));
		if (unknown.length > 0) pi.appendEntry("skill-toggle-warning", { unknown });
		return true;
	};

	const restore = (ctx: ExtensionContext, applyStartupFlags: boolean): void => {
		refreshSkills(ctx);
		const known = new Set(skillNames());
		let saved: string[] | undefined;

		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === ENTRY_TYPE) {
				const data = entry.data as SkillToggleState | undefined;
				if (data?.enabledSkills) saved = data.enabledSkills;
			}
		}

		if (saved) enabled = new Set(saved.filter((name) => known.has(name)));
		else enabled = new Set(skillNames());

		const changedByFlags = applyStartupFlags ? applyFlags() : false;
		updateStatus(ctx);
		if (changedByFlags) persist();
	};

	// Rebuild only the skills section; leave custom prompts and all other
	// system-prompt content untouched.
	pi.on("before_agent_start", async (event, ctx) => {
		const selected = (event.systemPromptOptions.skills ?? []) as Skill[];
		if (!stateRestored) {
			skills = selected;
			const known = new Set(skillNames());
			let saved: string[] | undefined;
			for (const entry of ctx.sessionManager.getBranch()) {
				if (entry.type === "custom" && entry.customType === ENTRY_TYPE) {
					const data = entry.data as SkillToggleState | undefined;
					if (data?.enabledSkills) saved = data.enabledSkills;
				}
			}
			if (saved) enabled = new Set(saved.filter((name) => known.has(name)));
			else enabled = new Set(skillNames());
			const changedByFlags = applyFlags();
			if (changedByFlags) persist();
			stateRestored = true;
		}
		const visible = selected.filter((skill) => enabled.has(skill.name));
		const readTool = event.systemPromptOptions.selectedTools?.includes("read") ? "read" : "bash";
		const replacement = formatSkillsForPrompt(visible, readTool);
		const section = /\n\nThe following skills provide specialized instructions[\s\S]*?<\/available_skills>/;
		const systemPrompt = section.test(event.systemPrompt)
			? event.systemPrompt.replace(section, replacement)
			: event.systemPrompt;
		return { systemPrompt };
	});

	// Pi expands /skill commands after the input event, so this is the place
	// to prevent explicitly invoking a disabled skill.
	pi.on("input", async (event, ctx) => {
		const match = event.text.match(/^\/skill:([^\s]+)/);
		if (!match) return;
		if (!enabled.has(match[1])) {
			ctx.ui.notify(`Skill disabled: ${match[1]}`, "warning");
			return { action: "handled" };
		}
	});

	pi.registerCommand("skills", {
		description: "Enable/disable skills for this run",
		handler: async (args, ctx) => {
			refreshSkills(ctx);
			if (!stateRestored) restore(ctx, true);
			if (skills.length === 0) {
				ctx.ui.notify("No skills are registered", "warning");
				return;
			}

			const arg = args.trim().toLowerCase();
			if (arg === "all" || arg === "none" || arg === "list") {
				if (arg === "list") {
					ctx.ui.notify(
						skills.map((skill) => `${enabled.has(skill.name) ? "✓" : "⊘"} ${skill.name}`).join("\n"),
						"info",
					);
					return;
				}
				enabled = arg === "all" ? new Set(skillNames()) : new Set();
				persist();
				updateStatus(ctx);
				ctx.ui.notify(arg === "all" ? "All skills enabled" : "All skills disabled", "info");
				return;
			}

			if (ctx.mode !== "tui") {
				ctx.ui.notify("/skills requires TUI mode (try /skills all|none|list)", "error");
				return;
			}

			let dirty = false;
			await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
				const items: SettingItem[] = skills.map((skill) => ({
					id: skill.name,
					label: skill.name,
					description: firstLine(skill.description),
					currentValue: enabled.has(skill.name) ? ENABLED : DISABLED,
					values: [ENABLED, DISABLED],
				}));
				const container = new Container();
				container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
				container.addChild(new Text(theme.fg("accent", theme.bold("Skills for this run")), 1, 0));
				const settingsList = new SettingsList(
					items,
					Math.min(items.length + 2, 15),
					getSettingsListTheme(),
					(id, value) => {
						if (value === ENABLED) enabled.add(id);
						else enabled.delete(id);
						dirty = true;
					},
					() => done(undefined),
					{ enableSearch: true },
				);
				container.addChild(settingsList);
				container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter/space toggle • ctrl+a all • ctrl+n none • esc close"), 1, 0));
				container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
				const setAll = (value: boolean): void => {
					enabled = value ? new Set(skillNames()) : new Set();
					for (const name of skillNames()) settingsList.updateValue(name, value ? ENABLED : DISABLED);
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
			if (dirty) persist();
			updateStatus(ctx);
		},
	});

	pi.registerEntryRenderer("skill-toggle-warning", (entry, _options, theme) => {
		const unknown = (entry.data as { unknown: string[] }).unknown.join(", ");
		return new Text(theme.fg("warning", `Unknown skills ignored: ${unknown}`));
	});

	pi.on("session_start", async (_event, ctx) => {
		stateRestored = false;
		ctx.ui.setStatus(STATUS_KEY, undefined);
	});
	pi.on("session_tree", async (_event, ctx) => {
		stateRestored = false;
		ctx.ui.setStatus(STATUS_KEY, undefined);
	});
}

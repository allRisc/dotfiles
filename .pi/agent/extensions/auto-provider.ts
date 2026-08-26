import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Ordered provider/model profiles.
 *
 * The first profile with usable credentials wins. Keep this list in the shared
 * dotfiles repository; credentials remain in each machine's local auth.json.
 */
const profiles = [
	{
		name: "personal",
		provider: "opencode",
		model: "gpt-5.6-luna",
	},
	{
		name: "work",
		provider: "anthropic",
		model: "claude-haiku-latest",
	},
] as const;

/**
 * auto-provider deliberately never wants a persisted default provider/model in
 * settings.json. Pi's own login/model-selection flows can write
 * `defaultProvider`/`defaultModel` to the global settings file (e.g. right
 * after completing a `/login`), which would otherwise silently override the
 * profile ordering above on the next session. Strip those keys any time we
 * touch the model so the profile list stays authoritative.
 */
function clearPersistedDefaultModel(): void {
	const settingsPath = join(getAgentDir(), "settings.json");
	if (!existsSync(settingsPath)) return;

	try {
		const raw = readFileSync(settingsPath, "utf-8");
		const settings = JSON.parse(raw);
		if (!("defaultProvider" in settings) && !("defaultModel" in settings)) return;

		delete settings.defaultProvider;
		delete settings.defaultModel;
		writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
	} catch (error) {
		console.error("auto-provider: unable to clear persisted default model:", error);
	}
}

async function selectLoggedInProfile(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
): Promise<boolean> {
	for (const profile of profiles) {
		try {
			// This resolves both auth.json credentials and provider environment
			// variables. It may also refresh OAuth credentials when necessary.
			const auth = await ctx.modelRegistry.getProviderAuth(profile.provider);
			if (!auth) continue;

			const model = ctx.modelRegistry.find(profile.provider, profile.model);
			if (!model) {
				ctx.ui.notify(
					`Logged-in provider ${profile.provider} does not have model ${profile.model}`,
					"warning",
				);
				continue;
			}

			if (await pi.setModel(model)) {
				clearPersistedDefaultModel();
				ctx.ui.setStatus(
					"auto-provider",
					`${profile.name}: ${profile.provider}/${profile.model}`,
				);
				return true;
			}
		} catch (error) {
			// A broken credential for one profile should not prevent trying the
			// other profiles. Pi will provide its normal authentication guidance
			// if none of them can be selected.
			console.error(
				`auto-provider: unable to inspect ${profile.provider}:`,
				error,
			);
		}
	}

	// Deliberately do not display a replacement error here. When no provider is
	// logged in, leaving the model unset lets Pi show its normal virgin-install
	// guidance (including the /login instructions).
	return false;
}

export default function autoProviderExtension(pi: ExtensionAPI): void {
	pi.on("session_start", async (_event, ctx) => {
		await selectLoggedInProfile(pi, ctx);
	});

	pi.registerCommand("auto-provider", {
		description: "Select the first configured provider/model with credentials",
		handler: async (_args, ctx) => {
			await selectLoggedInProfile(pi, ctx);
		},
	});

	pi.on("model_select", async (event, ctx) => {
		// Catch persistence from any other flow too (e.g. Pi auto-selecting a
		// provider's default model right after a `/login` completes).
		clearPersistedDefaultModel();
		ctx.ui.setStatus(
			"auto-provider",
			`${event.model.provider}/${event.model.id}`,
		);
	});

	// Also clean up on the way out (quit, reload, /new, resume, fork) so
	// nothing persisted during the session lingers in settings.json.
	pi.on("session_shutdown", async () => {
		clearPersistedDefaultModel();
	});
}

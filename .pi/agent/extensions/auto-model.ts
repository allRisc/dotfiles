import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * Ordered provider/model profiles.
 *
 * The first profile with usable credentials wins. Keep this list in the shared
 * dotfiles repository; credentials remain in each machine's local auth.json.
 */
const profiles = [
	{
		name: "api-key-helper",
		provider: "anthropic-api-key-helper",
		model: "claude-sonnet-4-5",
	},
	{
		name: "work",
		provider: "anthropic",
		model: "claude-sonnet-4-5",
	},
	{
		name: "personal",
		provider: "opencode",
		model: "gpt-5.6-luna",
	},
] as const;

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
				ctx.ui.setStatus(
					"auto-model",
					`${profile.name}: ${profile.provider}/${profile.model}`,
				);
				return true;
			}
		} catch (error) {
			// A broken credential for one profile should not prevent trying the
			// other profiles. Pi will provide its normal authentication guidance
			// if none of them can be selected.
			console.error(
				`auto-model: unable to inspect ${profile.provider}:`,
				error,
			);
		}
	}

	// Deliberately do not display a replacement error here. When no provider is
	// logged in, leaving the model unset lets Pi show its normal virgin-install
	// guidance (including the /login instructions).
	return false;
}

export default function autoModelExtension(pi: ExtensionAPI): void {
	pi.on("session_start", async (_event, ctx) => {
		await selectLoggedInProfile(pi, ctx);
	});

	pi.registerCommand("auto-model", {
		description: "Select the first configured provider/model with credentials",
		handler: async (_args, ctx) => {
			await selectLoggedInProfile(pi, ctx);
		},
	});

	pi.on("model_select", async (event, ctx) => {
		ctx.ui.setStatus(
			"auto-model",
			`${event.model.provider}/${event.model.id}`,
		);
	});
}

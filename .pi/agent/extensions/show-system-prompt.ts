import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

/** Adds /show-system-prompt to display Pi's current assembled system prompt in the transcript. */
export default function (pi: ExtensionAPI) {
	pi.registerEntryRenderer("pi-system-prompt", (entry, _options, theme) => {
		const prompt = (entry.data as { prompt: string }).prompt;
		return new Text(
			`${theme.fg("accent", "--- Pi system prompt ---")}\n${prompt}\n${theme.fg("accent", "--- End system prompt ---")}`,
		);
	});

	pi.registerCommand("show-system-prompt", {
		description: "Display the current system prompt in the transcript",
		handler: async (_args, ctx) => {
			pi.appendEntry("pi-system-prompt", {
				prompt: ctx.getSystemPrompt(),
			});
		},
	});
}

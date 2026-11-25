import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Adds /exit as an alias for pi's built-in /quit command. */
export default function (pi: ExtensionAPI) {
	pi.registerCommand("exit", {
		description: "Exit pi (alias for /quit)",
		handler: async (_args, ctx) => {
			ctx.shutdown();
		},
	});
}

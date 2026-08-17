import { isAbsolute, relative, resolve } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

/**
 * Command Guard
 *
 * Validates bash commands before they run:
 *
 * 1. `rm -rf` (any recursive+force removal) is blocked when a target resolves
 *    outside the current working directory, or when the target cannot be
 *    resolved statically (unexpanded variables, command substitution).
 * 2. Any git command that relies on a force flag (`--force`, `-f`,
 *    `--force-with-lease`, `--force-if-includes`, `reset --hard`, ...) is
 *    blocked, and the model is told to ask the user to run it instead.
 */

const SEPARATORS = /^(?:&&|\|\||;|\||&|\n)$/;

/** Splits a command line into shell "words", keeping separators as their own tokens. */
function tokenize(command: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let quote: '"' | "'" | null = null;
	let hasContent = false;

	const push = () => {
		if (hasContent) tokens.push(current);
		current = "";
		hasContent = false;
	};

	for (let i = 0; i < command.length; i++) {
		const char = command[i] as string;

		if (quote) {
			if (char === quote) {
				quote = null;
			} else if (char === "\\" && quote === '"' && i + 1 < command.length) {
				current += command[++i];
				hasContent = true;
			} else {
				current += char;
				hasContent = true;
			}
			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			hasContent = true;
			continue;
		}

		if (char === "\\" && i + 1 < command.length) {
			const next = command[++i] as string;
			if (next !== "\n") {
				current += next;
				hasContent = true;
			}
			continue;
		}

		if (char === "#" && !hasContent) {
			while (i < command.length && command[i] !== "\n") i++;
			continue;
		}

		if (/\s/.test(char)) {
			if (char === "\n") {
				push();
				tokens.push("\n");
			} else {
				push();
			}
			continue;
		}

		if (char === "(" || char === ")" || char === "{" || char === "}") {
			push();
			tokens.push(char);
			continue;
		}

		if (char === "&" || char === "|" || char === ";") {
			push();
			let op = char;
			if ((char === "&" || char === "|") && command[i + 1] === char) {
				op += char;
				i++;
			}
			tokens.push(op);
			continue;
		}

		current += char;
		hasContent = true;
	}
	push();
	return tokens;
}

/** Splits tokens into simple commands separated by shell control operators. */
function splitCommands(tokens: string[]): string[][] {
	const commands: string[][] = [];
	let current: string[] = [];
	for (const token of tokens) {
		if (SEPARATORS.test(token) || token === "(" || token === ")" || token === "{" || token === "}") {
			if (current.length) commands.push(current);
			current = [];
			continue;
		}
		current.push(token);
	}
	if (current.length) commands.push(current);
	return commands;
}

/** Drops leading env assignments and wrappers so we see the real program name. */
function stripPrefixes(words: string[]): string[] {
	let index = 0;
	while (index < words.length) {
		const word = words[index] as string;
		if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) {
			index++;
			continue;
		}
		const program = basename(word);
		if (program === "env" || program === "sudo" || program === "doas" || program === "nohup" || program === "time" || program === "command" || program === "xargs") {
			index++;
			continue;
		}
		break;
	}
	return words.slice(index);
}

function basename(word: string): string {
	const parts = word.split("/");
	return parts[parts.length - 1] ?? word;
}

const DYNAMIC = /[$`]/;

type RmVerdict = { blocked: false } | { blocked: true; reason: string };

function checkRm(words: string[], cwd: string, dir: string | null): RmVerdict {
	if (dir === null) {
		return {
			blocked: true,
			reason: `the command changes directory in a way that cannot be resolved statically, so an "rm -rf" target cannot be verified to stay inside ${cwd}.`,
		};
	}

	let recursive = false;
	let force = false;
	const targets: string[] = [];
	let endOfFlags = false;

	for (const word of words.slice(1)) {
		if (!endOfFlags && word === "--") {
			endOfFlags = true;
			continue;
		}
		if (!endOfFlags && word.startsWith("--")) {
			if (word === "--recursive" || word === "--dir") recursive = true;
			if (word === "--force" || word === "--no-preserve-root") force = true;
			continue;
		}
		if (!endOfFlags && word.startsWith("-") && word.length > 1) {
			if (/[rR]/.test(word)) recursive = true;
			if (word.includes("f")) force = true;
			if (word.includes("d")) recursive = true;
			continue;
		}
		targets.push(word);
	}

	if (!recursive || !force) return { blocked: false };

	for (const target of targets) {
		if (DYNAMIC.test(target)) {
			return {
				blocked: true,
				reason: `"rm -rf ${target}" uses a variable or command substitution, so the target cannot be verified to stay inside ${cwd}.`,
			};
		}

		const expanded = target === "~" || target.startsWith("~/") ? homedir() + target.slice(1) : target;
		const absolute = isAbsolute(expanded) ? resolve(expanded) : resolve(dir, expanded);
		const rel = relative(cwd, absolute);

		if (absolute === cwd || absolute === dir) {
			return { blocked: true, reason: `"rm -rf ${target}" would delete the working directory itself (${absolute}).` };
		}
		if (rel.startsWith("..") || isAbsolute(rel)) {
			return {
				blocked: true,
				reason: `"rm -rf ${target}" resolves to ${absolute}, which is outside the working directory ${cwd}.`,
			};
		}
	}

	return { blocked: false };
}

const GIT_FORCE_FLAGS = new Set([
	"--force",
	"--force-with-lease",
	"--force-if-includes",
	"--force-rebase",
	"--allow-force",
]);

/** git subcommands where a bare `-f` (or bundled short flag) means "force". */
const GIT_SHORT_FORCE_SUBCOMMANDS = new Set([
	"push",
	"clean",
	"checkout",
	"switch",
	"branch",
	"tag",
	"reset",
	"rm",
	"restore",
	"worktree",
	"submodule",
	"stash",
	"gc",
	"filter-branch",
]);

function findGitForce(words: string[]): string | undefined {
	const subcommand = words.slice(1).find((word) => !word.startsWith("-"));

	for (const word of words.slice(1)) {
		if (word.startsWith("--")) {
			const name = word.split("=", 1)[0] as string;
			if (GIT_FORCE_FLAGS.has(name)) return word;
			if (name === "--hard" && subcommand === "reset") return word;
			continue;
		}
		if (word.startsWith("-") && word.length > 1 && !/^-[0-9]/.test(word)) {
			if (word.includes("f") && subcommand && GIT_SHORT_FORCE_SUBCOMMANDS.has(subcommand)) return word;
			if (word.includes("D") && (subcommand === "branch" || subcommand === "tag")) return word;
		}
	}
	return undefined;
}

export default function commandGuard(pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (!isToolCallEventType("bash", event)) return undefined;

		const command = event.input.command;
		if (typeof command !== "string" || command.trim() === "") return undefined;

		const cwd = resolve(ctx.cwd);
		// Tracks `cd` inside the command line; null means "unknown directory".
		let dir: string | null = cwd;

		for (const simple of splitCommands(tokenize(command))) {
			const words = stripPrefixes(simple);
			if (words.length === 0) continue;
			const program = basename(words[0] as string);

			if (program === "cd" || program === "pushd") {
				const target = words.slice(1).find((word) => !word.startsWith("-"));
				if (target === undefined) {
					dir = homedir();
				} else if (DYNAMIC.test(target)) {
					dir = null;
				} else {
					const expanded = target === "~" || target.startsWith("~/") ? homedir() + target.slice(1) : target;
					dir = isAbsolute(expanded) ? resolve(expanded) : dir === null ? null : resolve(dir, expanded);
				}
				continue;
			}

			if (program === "rm") {
				const verdict = checkRm(words, cwd, dir);
				if (verdict.blocked) {
					if (ctx.hasUI) ctx.ui.notify("Blocked recursive delete outside the working directory", "warning");
					return {
						block: true,
						reason: `Blocked by command-guard: ${verdict.reason} Recursive force deletes must stay inside the working directory; ask the user to run this command themselves if it is really needed.`,
					};
				}
				continue;
			}

			if (program === "git") {
				const flag = findGitForce(words);
				if (flag) {
					if (ctx.hasUI) ctx.ui.notify(`Blocked forced git command (${flag})`, "warning");
					return {
						block: true,
						reason: `Blocked by command-guard: git commands using "${flag}" are not allowed. Stop and ask the user to run this command themselves, showing them the exact command: ${command.trim()}`,
					};
				}
			}
		}

		return undefined;
	});
}

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	Editor,
	type EditorTheme,
	Key,
	matchesKey,
	Text,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { Type } from "typebox";

const Option = Type.Object({
	label: Type.String({ description: "Answer displayed to the user" }),
	description: Type.Optional(Type.String({ description: "Explanation shown below the answer" })),
});

const Prompt = Type.Object({
	header: Type.Optional(Type.String({ description: "Short label for this question" })),
	question: Type.String({ description: "Question to ask the user" }),
	options: Type.Array(Option, { description: "Selectable answers" }),
	multiple: Type.Optional(Type.Boolean({ description: "Allow selecting more than one answer" })),
	custom: Type.Optional(Type.Boolean({ description: "Allow the user to type an answer (default true)" })),
});

const Parameters = Type.Object({
	questions: Type.Array(Prompt, { description: "Questions to ask" }),
});

type QuestionResult = {
	questions: string[];
	answers: string[][];
	cancelled?: boolean;
};

type OptionValue = { label: string; description?: string; custom?: boolean };

/** An OpenCode-style question tool for interactive pi sessions. */
export default function questionExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "question",
		label: "Question",
		description: `Ask the user one or more questions during execution.
Use this to clarify ambiguous requirements, gather preferences, or let the user choose an implementation direction.
Each question may allow multiple selections. A custom text answer is offered by default; do not add an "Other" option.`,
		promptSnippet: "Ask the user interactive questions when requirements are ambiguous or a decision is needed.",
		parameters: Parameters,
		executionMode: "sequential",

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (ctx.mode !== "tui") {
				return {
					content: [{ type: "text", text: "Question tool requires interactive TUI mode" }],
					details: { questions: params.questions.map((q) => q.question), answers: [], cancelled: true } as QuestionResult,
					isError: true,
				};
			}
			if (params.questions.length === 0) {
				return {
					content: [{ type: "text", text: "No questions were provided" }],
					details: { questions: [], answers: [] } as QuestionResult,
					isError: true,
				};
			}

			const result = await ctx.ui.custom<QuestionResult | null>((tui, theme, _keybindings, done) => {
				let questionIndex = 0;
				let optionIndex = 0;
				let editing = false;
				let selected = new Set<number>();
				const answers: string[][] = [];
				let cachedLines: string[] | undefined;
				const editorTheme: EditorTheme = {
					borderColor: (s) => theme.fg("accent", s),
					selectList: {
						selectedPrefix: (s) => theme.fg("accent", s),
						selectedText: (s) => theme.fg("accent", s),
						description: (s) => theme.fg("muted", s),
						scrollInfo: (s) => theme.fg("dim", s),
						noMatch: (s) => theme.fg("warning", s),
					},
				};
				const editor = new Editor(tui, editorTheme);

				const current = () => params.questions[questionIndex];
				const options = (): OptionValue[] => {
					const q = current();
					return [
						...q.options,
						...(q.custom !== false ? [{ label: "Type your own answer", custom: true }] : []),
					];
				};
				const refresh = () => {
					cachedLines = undefined;
					tui.requestRender();
				};
				let completed = false;
				const finishQuestion = (values: string[]) => {
					answers.push(values);
					if (questionIndex === params.questions.length - 1) {
						// Mark the component complete before resolving the custom UI. The
						// input handler must not request another render after done(), or a
						// final Enter can leave the cleared editor visible over the dialog.
						completed = true;
						done({ questions: params.questions.map((q) => q.question), answers });
						return;
					}
					questionIndex++;
					optionIndex = 0;
					selected = new Set();
					editor.setText("");
					refresh();
				};
				// The Editor clears its own state before invoking onSubmit, so we must
				// read the submitted text from the callback argument rather than from
				// editor.getText() (which is already empty by this point).
				const submitCustom = (text: string) => {
					const value = (text ?? editor.getText()).trim();
					if (!value) return;
					editing = false;
					finishQuestion([value]);
				};
				editor.onSubmit = submitCustom;

				function handleInput(data: string) {
					if (editing) {
						if (matchesKey(data, Key.escape)) {
							editing = false;
							editor.setText("");
							refresh();
							return;
						}
						editor.handleInput(data);
						if (!completed) refresh();
						return;
					}
					const list = options();
					if (matchesKey(data, Key.up)) optionIndex = Math.max(0, optionIndex - 1);
					else if (matchesKey(data, Key.down)) optionIndex = Math.min(list.length - 1, optionIndex + 1);
					else if (matchesKey(data, Key.space) && current().multiple && !list[optionIndex].custom) {
						if (selected.has(optionIndex)) selected.delete(optionIndex);
						else selected.add(optionIndex);
					} else if (matchesKey(data, Key.enter)) {
						const item = list[optionIndex];
						if (item.custom) {
							editing = true;
						} else if (current().multiple) {
							if (selected.size > 0) finishQuestion([...selected].sort((a, b) => a - b).map((i) => list[i].label));
						} else finishQuestion([item.label]);
					} else if (matchesKey(data, Key.escape)) done(null);
					refresh();
				}

				function render(width: number): string[] {
					if (cachedLines) return cachedLines;
					const q = current();
					const list = options();
					const lines: string[] = [];
					const w = Math.max(1, width);
					const add = (text: string) => lines.push(...wrapTextWithAnsi(text, w));
					const addPrefix = (prefix: string, text: string) => {
						const n = visibleWidth(prefix);
						for (const [i, line] of wrapTextWithAnsi(text, Math.max(1, w - n)).entries()) lines.push(`${i ? " ".repeat(n) : prefix}${line}`);
					};
					lines.push(theme.fg("accent", "─".repeat(w)));
					addPrefix(" ", theme.fg("text", q.header ? `${q.header}: ${q.question}` : q.question));
					lines.push("");
					list.forEach((item, i) => {
						const active = i === optionIndex;
						const mark = q.multiple && selected.has(i) ? "[x] " : q.multiple ? "[ ] " : "";
						addPrefix(active ? theme.fg("accent", "> ") : "  ", theme.fg(active ? "accent" : "text", `${mark}${item.label}`));
						if (item.description) addPrefix("     ", theme.fg("muted", item.description));
					});
					if (editing) {
						lines.push("");
						addPrefix(" ", theme.fg("muted", "Your answer:"));
						for (const line of editor.render(Math.max(1, w - 2))) lines.push(` ${line}`);
					}
					lines.push("", theme.fg("dim", editing ? "Enter to submit • Esc to go back" : q.multiple ? "↑↓ navigate • Space toggle • Enter continue • Esc cancel" : "↑↓ navigate • Enter select • Esc cancel"), theme.fg("accent", "─".repeat(w)));
					cachedLines = lines;
					return lines;
				}
				return { render, handleInput, invalidate: () => (cachedLines = undefined) };
			});

			if (!result) {
				return { content: [{ type: "text", text: "User cancelled the questions" }], details: { questions: params.questions.map((q) => q.question), answers: [], cancelled: true } as QuestionResult };
			}
			const formatted = result.questions.map((q, i) => `"${q}"="${result.answers[i]?.join(", ") || "Unanswered"}"`).join(", ");
			return { content: [{ type: "text", text: `User has answered your questions: ${formatted}. Continue with these answers in mind.` }], details: result };
		},

		renderCall(args, theme) {
			return new Text(theme.fg("toolTitle", theme.bold("question ")) + theme.fg("muted", `${args.questions?.length ?? 0} question(s)`), 0, 0);
		},
		renderResult(result, _options, theme) {
			const details = result.details as QuestionResult | undefined;
			if (!details || details.cancelled) return new Text(theme.fg("warning", "Cancelled"), 0, 0);
			return new Text(theme.fg("success", `✓ ${details.answers.flat().join(", ")}`), 0, 0);
		},
	});
}

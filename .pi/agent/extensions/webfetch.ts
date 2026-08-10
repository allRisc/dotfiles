import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_SECONDS = 30;
const MAX_TIMEOUT_SECONDS = 120;
const BROWSER_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

const description = `Fetch content from an HTTP or HTTPS URL and return it as text, markdown, or HTML. Markdown is the default.

Use a more targeted tool when one is available. This tool is read-only. Large text results may be replaced with a preview while the complete output is retained in managed storage.`;

type Format = "text" | "markdown" | "html";

const acceptHeader = (format: Format): string => {
	switch (format) {
		case "markdown":
			return "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1";
		case "text":
			return "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1";
		case "html":
			return "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1";
	}
};

const isTextualMime = (mime: string): boolean =>
	!mime ||
	mime.startsWith("text/") ||
	mime === "application/json" ||
	mime.endsWith("+json") ||
	mime === "application/xml" ||
	mime.endsWith("+xml") ||
	mime === "application/javascript" ||
	mime === "application/x-javascript";

const decodeEntities = (text: string): string =>
	text.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity: string) => {
		if (entity.toLowerCase() === "amp") return "&";
		if (entity.toLowerCase() === "lt") return "<";
		if (entity.toLowerCase() === "gt") return ">";
		if (entity.toLowerCase() === "quot") return '"';
		if (entity.toLowerCase() === "apos") return "'";
		if (entity.toLowerCase() === "nbsp") return " ";
		const value = entity[0]?.toLowerCase() === "x"
			? Number.parseInt(entity.slice(1), 16)
			: Number.parseInt(entity.slice(1), 10);
		return Number.isFinite(value) ? String.fromCodePoint(value) : `&${entity};`;
	});

const withoutInactiveHTML = (html: string): string =>
	html.replace(/<(script|style|noscript|iframe|object|embed|meta|link)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
		.replace(/<(script|style|noscript|iframe|object|embed|meta|link)\b[^>]*\/?>/gi, "");

/** Mirrors OpenCode's htmlparser2 text extraction (text is intentionally not reflowed). */
export function extractTextFromHTML(html: string): string {
	return decodeEntities(withoutInactiveHTML(html).replace(/<!-- [\s\S]*? -->|<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, "")).trim();
}

/** A small dependency-free equivalent of OpenCode's Turndown configuration. */
export function convertHTMLToMarkdown(html: string): string {
	let value = withoutInactiveHTML(html);
	value = value.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi, (_, level, body) => `\n\n${"#".repeat(Number(level))} ${extractTextFromHTML(body)}\n\n`);
	value = value.replace(/<hr\b[^>]*\/?>/gi, "\n\n---\n\n");
	value = value.replace(/<br\s*\/?>/gi, "  \n");
	value = value.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi, (_, href, body) => `[${extractTextFromHTML(body)}](${href})`);
	value = value.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, "**$2**");
	value = value.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, "*$2*");
	value = value.replace(/<code\b[^>]*>([\s\S]*?)<\/code\s*>/gi, (_, body) => `\`${extractTextFromHTML(body).replace(/`/g, "\\`")}\``);
	value = value.replace(/<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi, "\n- $1");
	value = value.replace(/<\/(p|div|section|article|blockquote|pre|ul|ol|table|tr)\s*>/gi, "\n\n");
	return decodeEntities(value.replace(/<[^>]*>/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim());
}

async function readBounded(response: Response): Promise<Uint8Array> {
	const declared = Number(response.headers.get("content-length"));
	if (Number.isSafeInteger(declared) && declared > MAX_RESPONSE_BYTES) {
		throw new Error("Response too large");
	}
	if (!response.body) return new Uint8Array(await response.arrayBuffer());
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const part = await reader.read();
			if (part.done) break;
			size += part.value.byteLength;
			if (size > MAX_RESPONSE_BYTES) throw new Error("Response too large");
			chunks.push(part.value);
		}
	} finally {
		reader.releaseLock();
	}
	const result = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return result;
}

async function fetchPage(url: string, format: Format, timeout: number, signal: AbortSignal): Promise<{ contentType: string; output: string }> {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error("URL must use http:// or https://");
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("URL must use http:// or https://");

	const request = async (userAgent: string) => {
		const timeoutSignal = AbortSignal.timeout(timeout * 1000);
		const requestSignal = AbortSignal.any([signal, timeoutSignal]);
		return fetch(url, {
			signal: requestSignal,
			redirect: "follow",
			headers: {
				"User-Agent": userAgent,
				Accept: acceptHeader(format),
				"Accept-Language": "en-US,en;q=0.9",
			},
		});
	};

	let response = await request(BROWSER_USER_AGENT);
	if (response.status === 403 && response.headers.get("cf-mitigated") === "challenge") {
		response = await request("opencode");
	}
	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const contentType = response.headers.get("content-type") ?? "";
	const mime = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
	if (mime.startsWith("image/") && mime !== "image/svg+xml" && mime !== "image/vnd.fastbidsheet") throw new Error("Unsupported image");
	if (!isTextualMime(mime)) throw new Error("Unsupported file");
	const content = new TextDecoder().decode(await readBounded(response));
	const output = !contentType.toLowerCase().includes("text/html")
		? content
		: format === "markdown" ? convertHTMLToMarkdown(content)
			: format === "text" ? extractTextFromHTML(content) : content;
	return { contentType, output };
}

export default function webfetchExtension(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "webfetch",
		label: "WebFetch",
		description,
		promptSnippet: "Fetch and read a specific HTTP or HTTPS webpage as text, Markdown, or HTML",
		parameters: Type.Object({
			url: Type.String({ description: "The HTTP or HTTPS URL to fetch content from" }),
			format: Type.Optional(StringEnum(["text", "markdown", "html"] as const, { description: "Output format; defaults to markdown" })),
			timeout: Type.Optional(Type.Number({ minimum: 1, maximum: MAX_TIMEOUT_SECONDS, description: "Timeout in seconds (maximum 120)" })),
		}),
		async execute(_toolCallId, params, signal) {
			const format = params.format ?? "markdown";
			const timeout = params.timeout ?? DEFAULT_TIMEOUT_SECONDS;
			try {
				const result = await fetchPage(params.url, format, timeout, signal);
				return {
					content: [{ type: "text", text: result.output }],
					details: { url: params.url, contentType: result.contentType, format, output: result.output },
				};
			} catch {
				throw new Error(`Unable to fetch ${params.url}`);
			}
		},
	});
}

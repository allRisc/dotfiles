import type { ExtensionAPI, ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import { spawnSync } from "child_process";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as tls from "tls";

const GATEWAY_URL = "https://llmgateway.itg.ti.com";
const TOKEN_ENV = "TI_LLM_API_KEY";

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

let tokenExpiry = 0;

function resolveTokenScript(): string {
  if (process.env.TI_GET_TOKEN_SCRIPT) return process.env.TI_GET_TOKEN_SCRIPT;
  
  // Use npm root -g to find actual global node_modules location
  const result = spawnSync("npm", ["root", "-g"], {
    encoding: "utf-8",
    timeout: 5000,
    stdio: ["pipe", "pipe", "pipe"],
  });
  
  if (result.status === 0 && result.stdout) {
    const globalRoot = result.stdout.trim();
    const candidate = path.join(globalRoot, "ti-claude-code-install", "lib", "get-token.js");
    if (fs.existsSync(candidate)) return candidate;
  }
  
  throw new Error(
    "Cannot locate get-token.js. Install ti-claude-code-install globally or set TI_GET_TOKEN_SCRIPT env var."
  );
}

function fetchToken(): string {
  const script = resolveTokenScript();
  const result = spawnSync(process.execPath, [script], {
    encoding: "utf-8",
    timeout: 30000,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Token fetch failed: ${result.stderr?.trim()}`);
  const token = result.stdout?.trim();
  if (!token) throw new Error("get-token.js returned empty output");
  return token;
}

function jwtExpiry(token: string): number {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString()
    );
    if (payload.exp) return payload.exp * 1000;
  } catch {}
  return Date.now() + 55 * 60 * 1000;
}

function ensureFreshToken(): void {
  if (Date.now() < tokenExpiry - 60_000) return;
  const token = fetchToken();
  process.env[TOKEN_ENV] = token;
  tokenExpiry = jwtExpiry(token);
}

// ---------------------------------------------------------------------------
// Team ID — read from .claude/settings.json walking up from cwd
// ---------------------------------------------------------------------------

function readTeamId(): string {
  // Walk up from cwd looking for .claude/settings.json
  let dir = process.cwd();
  while (true) {
    const candidate = path.join(dir, ".claude", "settings.json");
    if (fs.existsSync(candidate)) {
      try {
        const settings = JSON.parse(fs.readFileSync(candidate, "utf-8"));
        const headers: string = settings?.env?.ANTHROPIC_CUSTOM_HEADERS ?? "";
        const match = headers.match(/x-litellm-team-id:\s*(\S+)/i);
        if (match?.[1]) return match[1];
      } catch {}
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  // Fall back to env var — no hardcoded default; team ID is required
  const teamId = process.env.LITELLM_TEAM_ID ?? "";
  if (!teamId) {
    console.warn(
      "[ti-gateway] WARNING: No team ID found. Set LITELLM_TEAM_ID env var or add " +
      "'x-litellm-team-id: <your-team>' to ANTHROPIC_CUSTOM_HEADERS in .claude/settings.json. " +
      "Model discovery will likely return no models."
    );
  }
  return teamId;
}

// ---------------------------------------------------------------------------
// TLS — combine system roots with TI CA bundle
// ---------------------------------------------------------------------------

let _ca: (string | Buffer)[] | undefined;

function getCA(): (string | Buffer)[] {
  if (_ca) return _ca;
  _ca = [...tls.rootCertificates];
  const caPath = process.env.NODE_EXTRA_CA_CERTS;
  if (caPath) {
    try {
      _ca.push(fs.readFileSync(caPath));
    } catch {}
  }
  return _ca;
}

// ---------------------------------------------------------------------------
// HTTPS helper
// ---------------------------------------------------------------------------

function httpsGet(url: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers,
        ca: getCA(),
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          res.statusCode === 200
            ? resolve(data)
            : reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`))
        );
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("Request timed out")));
  });
}

// ---------------------------------------------------------------------------
// Model discovery
// ---------------------------------------------------------------------------

// Matches all Claude extended-thinking models by name pattern (sonnet-4+, opus-4+, 3-7-sonnet).
// Haiku is intentionally excluded. Pattern-based so new model versions are covered automatically.
const REASONING_RE = /^(?:anthropic\.|us\.anthropic\.)?claude-(?:3-7-sonnet|sonnet-4|opus-4)/;

// Models that speak the Anthropic Messages API natively (via Bedrock or direct)
function isAnthropicModel(id: string): boolean {
  return /^(claude-|anthropic\.|us\.anthropic\.)/.test(id);
}

interface LiteLLMEntry {
  model_name: string;
  model_info?: {
    mode?: string;
    supports_vision?: boolean | null;
    max_input_tokens?: number | null;
    max_output_tokens?: number | null;
  };
}

async function discoverModels(token: string, teamId: string): Promise<ProviderModelConfig[]> {
  const body = await httpsGet(`${GATEWAY_URL}/model/info`, {
    Authorization: `Bearer ${token}`,
    "x-litellm-team-id": teamId,
  });

  const data: { data: LiteLLMEntry[] } = JSON.parse(body);
  const seen = new Set<string>();
  const models: ProviderModelConfig[] = [];

  for (const entry of data.data) {
    const id = entry.model_name;
    const info = entry.model_info ?? {};
    if (seen.has(id)) continue;
    const mode = info.mode ?? "";
    if (mode !== "completion" && mode !== "chat") continue;
    seen.add(id);

    const anthropic = isAnthropicModel(id);
    models.push({
      id,
      name: id,
      api: anthropic ? "anthropic-messages" : "openai-completions",
      reasoning: REASONING_RE.test(id),
      input: info.supports_vision ? ["text", "image"] : ["text"],
      contextWindow: info.max_input_tokens ?? 128000,
      maxTokens: info.max_output_tokens ?? 16384,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      compat: anthropic
        ? { supportsEagerToolInputStreaming: false }
        : { supportsDeveloperRole: false, supportsReasoningEffort: false, maxTokensField: "max_tokens" as const },
    });
  }

  return models;
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

function buildRoutingConfig(teamId: string) {
  return {
    baseUrl: GATEWAY_URL,
    apiKey: `$${TOKEN_ENV}`,
    authHeader: true as const,
    headers: { "x-litellm-team-id": teamId },
  };
}

type RoutingConfig = ReturnType<typeof buildRoutingConfig>;

function applyProviders(pi: ExtensionAPI, models: ProviderModelConfig[], routing: RoutingConfig): void {
  const anthropic = models.filter(m => isAnthropicModel(m.id));
  const other = models.filter(m => !isAnthropicModel(m.id));
  pi.registerProvider("anthropic", {
    ...routing,
    ...(anthropic.length > 0 ? { models: anthropic } : {}),
  });
  pi.registerProvider("ti-litellm", {
    name: "TI LiteLLM Gateway",
    ...routing,
    ...(other.length > 0 ? { models: other } : {}),
  });
}

export default async function (pi: ExtensionAPI) {
  ensureFreshToken();
  let teamId = readTeamId();

  let models: ProviderModelConfig[] = [];
  try {
    models = await discoverModels(process.env[TOKEN_ENV]!, teamId);
    console.log(`[ti-gateway] Discovered ${models.length} models (team: ${teamId})`);
  } catch (e) {
    console.error("[ti-gateway] Model discovery failed:", e);
  }

  applyProviders(pi, models, buildRoutingConfig(teamId));

  pi.on("session_start", async () => {
    try {
      ensureFreshToken();
      const newTeamId = readTeamId();
      if (newTeamId !== teamId) {
        teamId = newTeamId;
        const newModels = await discoverModels(process.env[TOKEN_ENV]!, teamId);
        applyProviders(pi, newModels, buildRoutingConfig(teamId));
        console.log(`[ti-gateway] Team ID updated to: ${teamId} (${newModels.length} models)`);
      }
    } catch (e) {
      console.error("[ti-gateway] Session start refresh failed:", e);
    }
  });
}


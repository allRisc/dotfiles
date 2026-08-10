# Pi configuration

Pi-specific configuration is stored under `agent/` and is loaded from
`~/.pi/agent/` after installation.

## Dynamic Anthropic API keys

The `anthropic-api-key-helper` provider mirrors Claude Code's `apiKeyHelper`:
it runs a command that writes an Anthropic API key to standard output, caches
that key for five minutes, and refreshes it after an HTTP 401 response (up to
three authentication attempts). It is loaded automatically from
`agent/extensions/` and is selected by `/auto-model` when configured.

Add the helper command to `~/.pi/agent/settings.json` (the command itself is
not stored in this repository):

```json
{
  "apiKeyHelper": "/path/to/print-anthropic-api-key"
}
```

Alternatively, set `PI_API_KEY_HELPER` to the command. The provider is listed
as `anthropic-api-key-helper`; select it with `/model` if you do not use
`/auto-model`.

Optional settings:

- `CLAUDE_CODE_API_KEY_HELPER_TTL_MS` or `PI_API_KEY_HELPER_TTL_MS` sets the
  cache lifetime in milliseconds (default: 300000).
- `PI_API_KEY_HELPER_TIMEOUT_MS` (or `apiKeyHelperTimeoutMs` in settings) sets
  the helper timeout in milliseconds (default: 30000).

The helper command is executed by your login shell. It must exit successfully
and print only the key (surrounding whitespace is removed).

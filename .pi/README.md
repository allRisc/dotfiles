# Pi configuration

Pi-specific configuration is stored under `agent/` and is loaded from
`~/.pi/agent/` after installation.

## Command guard

`agent/extensions/command-guard.ts` validates every `bash` tool call before it
runs and blocks two classes of commands:

- **Recursive force deletes outside the working directory.** `rm -rf` (and
  equivalent flag spellings such as `rm --recursive --force` or `rm -fr`) is
  allowed only when every target resolves inside the current working
  directory. Targets that resolve above it, the working directory itself, and
  targets containing variables or command substitution (`$HOME/x`,
  `` `pwd` ``) are blocked. Leading wrappers (`sudo`, `env`, ...) and `cd`
  earlier in the same command line are taken into account.
- **Forced git commands.** Any `git` invocation using `--force`,
  `--force-with-lease`, `--force-if-includes`, `--force-rebase`, a short `-f`
  or `-D` on a force-capable subcommand (`push`, `clean`, `checkout`,
  `branch`, ...), or `git reset --hard` is blocked. The block reason tells the
  model to stop and ask the user to run the command themselves.

Both checks inspect each simple command in a compound command line, so
`echo hi; rm -rf /etc` is blocked as well.

## Custom tool toggle

`agent/extensions/tool-toggle.ts` adds `/tools`, a TUI component that enables
and disables **custom** tools (every tool whose `sourceInfo.source` is not
`builtin`: extension, SDK, and package tools). Built-in tools are never touched;
use pi's own `--tools` / `--exclude-tools` flags for those.

Disabling a tool removes it from the active tool set, so it is dropped from the
`Available tools` section of the system prompt, its `promptGuidelines` are
dropped as well, and the model can no longer call it. This keeps the prompt
small and limits what a given run is able to do.

### Interactive use

`/tools` opens a bordered, searchable settings list:

| Key | Action |
| --- | --- |
| `↑` / `↓` | Move between tools |
| `enter` / `space` | Toggle the selected tool |
| `ctrl+a` | Enable every custom tool |
| `ctrl+n` | Disable every custom tool |
| type text | Fuzzy search by tool name |
| `esc` | Close |

Each row shows the tool name, its current state, and, for the selected row, the
first line of its description plus the source it came from. Toggles apply
immediately, so the next model request already uses the new tool set. While at
least one custom tool is disabled, the footer shows `⊘ N tools`.

### Non-interactive use

- `/tools all` — enable every custom tool
- `/tools none` — disable every custom tool
- `/tools list` — print the current state without opening the component

These work in non-TUI modes, where the interactive component is unavailable.

### Starting a run with a reduced tool set

The extension registers a `--custom-tools` flag:

```bash
pi --custom-tools none            # no custom tools this run
pi --custom-tools all             # all custom tools this run
pi --custom-tools webfetch,todo   # only these custom tools
```

Unknown names are ignored and reported in the transcript.

### Persistence

Every change appends a `tool-toggle` entry to the session. On session start and
on session-tree navigation the extension replays the last entry of the current
branch, so the selection survives `/reload`, resume, and branch switches. Tools
that no longer exist are dropped silently. When a branch has no stored entry,
the currently active tools are kept as-is.

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

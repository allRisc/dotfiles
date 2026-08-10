# ripgrep

Configuration for [ripgrep](https://github.com/BurntSushi/ripgrep), the recursive
search tool.

[`ripgrep.conf`](ripgrep.conf) excludes `.git` contents from searches. `.zsh_tools`
sets `RIPGREP_CONFIG_PATH` to this file when `rg` is installed, and `.zsh_aliases`
provides `rgrep` as an alias for `rg`.

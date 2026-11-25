# tmux

Configuration for [tmux](https://github.com/tmux/tmux), the terminal multiplexer.

## Highlights

- Uses Zsh and `screen-256color` with mouse and extended-key support.
- Changes the prefix from `Ctrl-b` to `Ctrl-Space`.
- Uses Vim-style pane navigation and copy mode.
- Starts windows and panes at 1 and preserves the current path when splitting.
- Enables the Catppuccin Mocha theme and TPM-managed plugins.
- Adds `e` as a popup editor shortcut using `tmux-popup-edit.sh`.

The configuration is stored in [`tmux.conf`](tmux.conf). TPM and its plugins are
installed under `~/.config/tmux/plugins/` by `.zsh_tools`.

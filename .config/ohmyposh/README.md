# Oh My Posh

Prompt themes for [Oh My Posh](https://ohmyposh.dev/).

## Themes

- [`allrisc_omp.toml`](allrisc_omp.toml) is the active theme loaded by `.zshrc`.
  It displays the current path, Git branch/status, Python virtual environment,
  and the previous command's exit status.
- [`catppuccin_mocha_omp.toml`](catppuccin_mocha_omp.toml) is an alternate
  Catppuccin Mocha-based theme.
- [`default.toml`](default.toml) is an additional baseline theme.

The active theme is installed to `~/.config/ohmyposh/` by GNU Stow. The shell
loads it with `oh-my-posh init zsh`.

# allRisc Dotfiles

Personal Linux workstation configuration managed as a GNU Stow package. The
repository contains Zsh startup files, terminal and editor configuration,
command-line tooling, Git defaults, and Pi extensions.

## Installation

### Requirements

- Git
- GNU Stow
- Zsh
- `sudo` access for the optional package installation performed by the shell
  tooling bootstrap

Clone the repository into your home directory and stow it from there:

```bash
cd ~
git clone https://github.com/allrisc/dotfiles.git dotfiles
cd ~/dotfiles
stow .
```

GNU Stow creates symlinks from the repository into `$HOME`. Re-run `stow .`
after pulling changes. To remove the links, run `stow -D .` from the repository.

> **Note:** `.zsh_tools` performs installation and bootstrap work when Zsh
> starts. Review it before use on a new machine, particularly if you do not
> want it to install packages or clone external repositories.

## Configuration index

Each program has a focused README next to its configuration:

### Applications and command-line tools

- [Ghostty](.config/ghostty/README.md) — terminal emulator settings.
- [Neovim](.config/nvim/README.md) — editor entry point and plugin lockfile.
- [Oh My Posh](.config/ohmyposh/README.md) — active and alternate prompt themes.
- [ripgrep](.config/ripgrep/README.md) — global search exclusions and shell integration.
- [tmux](.config/tmux/README.md) — multiplexer, keybindings, theme, and plugins.
- [Pi](.pi/README.md) — Pi extensions, including the bash command guard, the
  custom-tool toggle, and the dynamic Anthropic `apiKeyHelper` provider.

## Zsh

Zsh is the main shell environment configured by this repository. `.zshrc`
loads the files in the following order:

1. Sources optional user-local `$HOME/.env` and `$HOME/.secrets.sh` files.
2. Sources `.zsh_tools` to bootstrap command-line tools and shell integrations.
3. Starts Oh My Posh with `.config/ohmyposh/allrisc_omp.toml`.
4. Loads Zinit plugins and snippets.
5. Configures completions, history, keybindings, and `fzf-tab` previews.
6. Sources `.zsh_funcs`, `.zsh_aliases`, optional helper scripts, and `.zsh_post`.

### Included shell tooling

`.zsh_tools` bootstraps or configures the following when needed:

- [Zinit](https://github.com/zdharma-continuum/zinit) for Zsh plugins.
- [fzf](https://github.com/junegunn/fzf) and `fd` for fuzzy finding and completion.
- [ripgrep](https://github.com/BurntSushi/ripgrep) through `RIPGREP_CONFIG_PATH`.
- [zoxide](https://github.com/ajeetdsouza/zoxide), initialized as the `cd` command.
- [tmux](https://github.com/tmux/tmux) and the TPM plugin manager.
- [Oh My Posh](https://ohmyposh.dev/) for the prompt.
- [NVM](https://github.com/nvm-sh/nvm), Node.js, and npm.

The bootstrap uses `$HOME/.local/bin` and `$XDG_DATA_HOME` where applicable.
It may invoke `apt`, `sudo`, `curl`, `wget`, and `git`.

### Shell behavior

- History is stored in `~/.zsh_history`, shared between shells, and configured
  to avoid duplicate entries.
- Emacs keybindings are enabled. `Ctrl-P` and `Ctrl-N` search backward and
  forward through history.
- Completion is case-insensitive and uses `fzf-tab` previews for directory and
  zoxide completion.
- `.` through `.....` change to one through five parent directories.
- `ll` and `la` provide long and hidden-file listings; `reload` sources
  `~/.zshrc` again.
- Git helpers include the Oh My Zsh Git aliases plus `gbc`, `gbC`, `gsm`, and
  `glr`.
- `git_current_branch` returns the current branch name.
- NordVPN aliases are added only when the `nordvpn` command is available.
- `uv` shell completion is enabled when `uv` is installed.

Keep machine-specific values and credentials in `$HOME/.env` or
`$HOME/.secrets.sh`; these files are intentionally outside the repository.

## Git

`.gitconfig` sets `main` as the default initial branch, uses Neovim as the
editor, enables the `store` credential helper, includes an optional local
`~/.config/git/gituser.inc`, and defines `git com` as a shortcut for `git commit`.
The included identity file is intentionally local and is not provided here.

## Other files

- `.scripts/` contains helper scripts used by the shell and tmux configuration.

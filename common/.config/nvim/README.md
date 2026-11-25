# Neovim

This directory contains the Neovim entry point and plugin lockfile.

- [`init.lua`](init.lua) loads the `allrisc` Neovim configuration module.
- [`nvim-pack-lock.json`](nvim-pack-lock.json) pins plugin versions for
  reproducible plugin installation.

The configuration is installed to `~/.config/nvim/` by GNU Stow. The referenced
`allrisc` module and the plugin manager setup are expected to be available in
the local Neovim environment.

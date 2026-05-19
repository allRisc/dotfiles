---@type vim.lsp.Config
return {
  cmd = { "slang-server" },
  root_markers = { ".git", ".slang" },
  filetypes = {
    "systemverilog",
    "verilog",
  },
}

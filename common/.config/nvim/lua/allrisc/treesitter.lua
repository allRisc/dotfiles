vim.pack.add({
    { src="https://github.com/romus204/tree-sitter-manager.nvim", version="69c48bf"},
})

require("tree-sitter-manager").setup({
    auto_install=true,
})

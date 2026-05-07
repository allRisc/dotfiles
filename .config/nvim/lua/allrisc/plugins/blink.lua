-- Add blink
vim.pack.add({
    { src="https://github.com/saghen/blink.cmp", version="v1.10.2" },
})

-- Lazy Load blink
vim.api.nvim_create_autocmd("InsertEnter", {
    pattern = "*",
    once = true,
    callback = function()
        require("blink.cmp").setup({
            keymap = {
                preset = "default",
                ['<C-f>'] = { "select_and_accept", "fallback" },
            },
            appearance = {
                nerd_font_variant = "mono"
            },
            completion = {
                documentation = { autoshow = false }
            },
            source = {
                default = { "lsp", "path", "snippets", "buffer" },
            },
            fuzzy = { implementation = "prefer_rust_with_warning" },
        })
    end,
})

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
                documentation = { auto_show = false }
            },
            sources = {
                default = { "lsp", "path", "snippets", "buffer" },
                providers = {
                    path = {
                        opts = {
                            get_cwd = function(_)
                                return vim.fn.getcwd()
                            end,
                        },
                    },
                },
            },
            fuzzy = { implementation = "prefer_rust_with_warning" },
        })
    end,
})

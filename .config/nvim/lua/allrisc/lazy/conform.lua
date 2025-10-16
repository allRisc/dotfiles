return {
    "stevearc/conform.nvim",
    opts = {},

    cond = (function() return not vim.g.vscode end),

    config = function()
        require("conform").setup({
            format_on_save = {
                timeout_ms = 5000,
                lsp_format = "fallback",
            },
            formatters_by_ft = {
                python = { "isort" },
            },
            formatters = {
            },
        })

        vim.keymap.set("n", "<leader>f", function()
            require("conform").format({ bufnr = 0})
        end)
    end,
}

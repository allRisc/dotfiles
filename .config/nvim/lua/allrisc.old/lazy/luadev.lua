return {
    {
        "folke/lazydev.nvim",
        cond = (function() return not vim.g.vscode end),
        ft = "lua",
        opts = {
            library = {}
        }
    }
}

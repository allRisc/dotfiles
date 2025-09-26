return {
    {
        "L3MON4D3/LuaSnip",
        dependencies = {
            "rafamadriz/friendly-snippets",
        },
        cond = (function() return not vim.g.vscode end),

        config = function()
            local ls = require("luasnip")
            require("luasnip.loaders.from_lua").load({ paths = { "~/.config/nvim/snippets" } })

            vim.keymap.set({ "i" }, "<C-s>e", function() ls.expand() end, { silent = true })

            vim.keymap.set({ "i", "s" }, "<C-s>h", function() ls.jump(1) end, { silent = true })
            vim.keymap.set({ "i", "s" }, "<C-s>l", function() ls.jump(-1) end, { silent = true })

            vim.keymap.set({ "i", "s" }, "<C-E>", function()
                if ls.choice_active() then
                    ls.change_choice(1)
                end
            end, { silent = true })
        end,
    }
}

function VimColorScheme(color)
    color = color or "catppuccin"
    vim.cmd.colorscheme(color)
end

return {
    {
        "catppuccin/nvim",
        name = "catppuccin",
        priority = 1000,
        config = function()
            require("catppuccin").setup({
                flavour = "mocha",
                float = {
                    transparent = false,
                    solid = false,
                },
                auto_integrations = true,
            })

            VimColorScheme()
            --            vim.cmd.colorscheme "catppuccin"
        end
    },
    {
        "nvim-tree/nvim-web-devicons",
        lazy = true
    },
}

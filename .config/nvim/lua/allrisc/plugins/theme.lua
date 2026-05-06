-- Set the color scheme
function VimColorScheme(color)
    color = color or "catppuccin-nvim"
    vim.cmd.colorscheme(color)
end

-- Add the catpuccin color scheme
vim.pack.add({ 
    { src='https://github.com/catppuccin/nvim', version='v2.0.0' },
})

-- Setup catppucin
require("catppuccin").setup({
    flavour = "mocha",
    float = {
        transparent = false,
        solid = false,
    },
    auto_integrations = true,
})

VimColorScheme()

-- Add Icons collection scheme
vim.pack.add({ 
    { src="https://github.com/nvim-tree/nvim-web-devicons", version="master" },
})
require("nvim-web-devicons").setup({})

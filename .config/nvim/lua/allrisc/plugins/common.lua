-- Add plenary and devicons
vim.pack.add({ 
    { src="https://github.com/nvim-lua/plenary.nvim", version="74b06c6" },
    { src="https://github.com/nvim-tree/nvim-web-devicons", version="master" },
})

-- Setup devicons
require("nvim-web-devicons").setup({})

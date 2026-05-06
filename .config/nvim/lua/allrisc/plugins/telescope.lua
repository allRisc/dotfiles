-- Install telescope
vim.pack.add({
    { src="https://github.com/nvim-telescope/telescope-fzf-native.nvim", version="main" },
    { src="https://github.com/nvim-telescope/telescope.nvim", version="v0.2.1" },
    { src="https://github.com/nvim-telescope/telescope-file-browser.nvim", version="master" },
})

local actions = require("telescope.actions")

require("telescope").setup({
    defaults = {
        prompt_prefix = "🔍 ",
        selection_caret = "➜ ",
        path_display = { "truncate" },
     
        mappings = {
            ["i"] = {},
            ["n"] = {},
        },
    },

    extensions = {
        file_browser = {
            hidden = { file_browser = true, folder_browser = true },
            hijack_netrw = true,
            mappings = {
                ["i"] = {},
                ["n"] = {},
            },
        },
    },
})

require("telescope").load_extension("file_browser")
require("telescope").load_extension("fzf")

-- Telescope keymaps
local builtin = require('telescope.builtin')

-- Open the file browser
vim.keymap.set("n", "<leader>fv", ":Telescope file_browser path=%:p:h select_buffer=true<CR><Esc>")

-- Find files in current directory
vim.keymap.set('n', '<leader>ff', builtin.find_files, { desc = 'Find Files' })

-- Live grep search in project
vim.keymap.set('n', '<leader>fg', builtin.live_grep, { desc = 'Live Grep' })

-- Search through open buffers
vim.keymap.set('n', '<leader>fb', builtin.buffers, { desc = 'Find Buffers' })

-- Search help tags
vim.keymap.set('n', '<leader>fh', builtin.help_tags, { desc = 'Find Help' })

-- Search recent files
vim.keymap.set('n', '<leader>fr', builtin.oldfiles, { desc = 'Recent Files' })

-- Search current buffer
vim.keymap.set('n', '<leader>/', builtin.current_buffer_fuzzy_find, { desc = 'Search Current Buffer' })

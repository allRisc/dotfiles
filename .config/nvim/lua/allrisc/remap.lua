-- Change to leader
vim.g.mapleader = ' '

-- Exit to the netrw
vim.keymap.set("n", "<leader>pv", ":Telescope file_browser path=%:p:h select_buffer=true<CR><Esc>")

-- Set Ctrl+W to exit the current buffer
vim.keymap.set({"n", "v"}, "<C-w>", ":bd<CR>")

-- Keep the cursor at the same point when using 'J' to concat lines
vim.keymap.set("n", "J", "mzJ`z")

-- Change how navigation is handled
vim.keymap.set("n", "<C-d>", "<C-d>zz")
vim.keymap.set("n", "<C-u>", "<C-u>zz")

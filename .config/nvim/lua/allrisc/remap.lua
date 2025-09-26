-- Change to leader
vim.g.mapleader = ' '

-- Exit to the netrw
if vim.g.vscode then
    vim.keymap.set("n", "<leader>pv", function ()
        require("vscode").call('workbench.explorer.fileView.focus')
        require("vscode").call('workbench.files.action.collapseExplorerFolders')
    end)
else
    vim.keymap.set("n", "<leader>pv", ":Telescope file_browser path=%:p:h select_buffer=true<CR><Esc>")
end

-- Keep the cursor at the same point when using 'J' to concat lines
vim.keymap.set("n", "J", "mzJ`z")

-- Change how navigation is handled
vim.keymap.set("n", "<C-d>", "<C-d>zz")
vim.keymap.set("n", "<C-u>", "<C-u>zz")

-- Add keybindings for tabs
if vim.g.vscode then
    vim.keymap.set("n", "<leader>tt", function() require("vscode").call("welcome.showNewFileEntries") end)
    vim.keymap.set("n", "<leader>tc", function() require("vscode").call("workbench.action.revertAndCloseActiveEditor") end)
    vim.keymap.set("n", "<leader>tn", function() require("vscode").call("workbench.action.nextEditor") end)
    vim.keymap.set("n", "<leader>tp", function() require("vscode").call("workbench.action.previousEditor") end)
else
    vim.keymap.set("n", "<leader>tt", ":tabnew<CR><Esc>")
    vim.keymap.set("n", "<leader>tc", ":tabclose<CR><Esc>")
    vim.keymap.set("n", "<leader>tn", ":tabnext<CR><Esc>")
    vim.keymap.set("n", "<leader>tp", ":tabprev<CR><Esc>")
end

-- Change what keys are passed through in VSCode mode
if vim.g.vscode then
    require("vscode").update_config(
        {"vscode-neovim.ctrlKeysForInsertMode"},
        {{
            "a",
            "c",
            "d",
            "h",
            "j",
            "m",
            "o",
            "r",
            "t",
            "u",
            "w",
            "f",
            "p",
            "n",
        }},
        "global"
    )
end
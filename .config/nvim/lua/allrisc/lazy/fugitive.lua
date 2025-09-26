if vim.g.vscode then
    vim.keymap.set("n", "<leader>gs", function() require("vscode").call("workbench.scm.focus") end)
end

return {
    "tpope/vim-fugitive",
    cond = (function() return not vim.g.vscode end),
    config = function()
        vim.keymap.set("n", "<leader>gs", vim.cmd.Git)
    end
}

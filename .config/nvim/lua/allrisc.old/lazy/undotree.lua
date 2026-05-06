return {
    {
        "mbbill/undotree",
        cond = (function() return not vim.g.vscode end),

        config = function()
            vim.keymap.set("n", "<leader>u", vim.cmd.UndotreeToggle)
        end
    },
}

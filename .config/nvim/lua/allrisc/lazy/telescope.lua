git_project_files = function()
    local _, ret, _ = require("telescope.utils").get_os_command_output({ "git", "rev-parse", "--is-inside-work-tree" })
    if ret == 0 then
        require("telescope.builtin").git_files()
    else
        require("telescope.builtin").find_files()
    end
end

return {
    {
        "nvim-telescope/telescope.nvim",

        tag = "0.1.5",

        dependencies = {
            "nvim-lua/plenary.nvim"
        },

        config = function()
            require("telescope").setup({
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

            local builtin = require('telescope.builtin')
            vim.keymap.set('n', '<leader>pf', builtin.find_files, {})
            vim.keymap.set('n', '<C-p>', git_project_files, {})
            vim.keymap.set('n', '<leader>ps', function()
                builtin.grep_string({
                    search = vim.fn.input("Grep > "),
                    additional_args = { "--hidden" },
                    file_ignore_patterns = { ".git" },
                })
            end)
        end
    },
    {
        "nvim-telescope/telescope-file-browser.nvim",
        dependencies = { "nvim-telescope/telescope.nvim", "nvim-lua/plenary.nvim" },
        config = function ()
            require("telescope").load_extension("file_browser")
        end,
    }
}

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
                        theme = "ivy",
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
            vim.keymap.set('n', '<C-p>', builtin.git_files, {})
            vim.keymap.set('n', '<leader>ps', function()
                builtin.grep_string({ search = vim.fn.input("Grep > ") })
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

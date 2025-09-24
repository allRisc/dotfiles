vim.lsp.set_log_level "debug"

return {
    {
        "williamboman/mason.nvim",

        config = function()
            require("mason").setup()
        end
    },
    {
        "williamboman/mason-lspconfig.nvim",

        dependencies = {
            "williamboman/mason.nvim"
        },

        config = function()
            require("mason-lspconfig").setup({
                ensure_installed = {
                    "lua_ls",
                    "pyright",
                    "ruff",
                },
                automatic_enable = true;
            })
        end
    },
    {
        "neovim/nvim-lspconfig",
        dependencies = {
            "williamboman/mason.nvim",
            "williamboman/mason-lspconfig.nvim",
            "j-hui/fidget.nvim",
        },

        event = { "BufReadPost", "BufNewFile" },
        cmd = { "LspInfo", "LspInstall", "LspUninstall" },

        config = function()

            -- Key-binding
            vim.keymap.set("n", "ga", function() vim.lsp.buf.code_action() end)

            -- Diagnostic Setup
            vim.diagnostic.config({
                update_in_insert = true,
                virtual_text = true,
                float = {
                    focusable = false,
                    style = "minimal",
                    border = "rounded",
                    source = "always",
                    header = "",
                    prefix = "",
                },
            })

            -- LSP Configurations

            -- Ruff LSP
            vim.api.nvim_create_autocmd("LspAttach", {
                group = vim.api.nvim_create_augroup("lsp_attached_disable_ruff", { clear = true }),
                callback = function(args)
                    local client = vim.lsp.get_client_by_id(args.data.client_id)
                    if client == nil then
                        return
                    end
                    if client.name == 'ruff' then
                        -- Disable hover in favor of pyright
                        client.server_capabilities.hoverProvider = false
                    end
                end,
                desc = "LSP: Disable certain LSP capabilities from Ruff",
            })

            -- Lua (lua-language-server)
            vim.lsp.config('lua_ls', {
                settings = {
                    Lua = {
                        runtime = { version = 'Lua 5.1' },
                        diagnostics = {
                            globals = { 'bit', 'vim', 'it', 'describe', 'before_each', 'after_each' },
                        },
                    },
                },
            })

        end
    }
}

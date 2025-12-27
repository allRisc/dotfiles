if vim.env.USER == "a0504063" then
    return {
        "Exafunction/windsurf.vim",
        event = 'BufEnter',

        config = function()
            vim.cmd[[let g:codeium_server_config = {'portal_url': 'https://dleaiml001.itg.ti.com', 'api_url': 'https://dleaiml001.itg.ti.com/_route/api_server' }]]
        end
    }
else
    return {
        "github/copilot.vim",
    
        config = function()
            vim.keymap.set('i', '<C-f>', 'copilot#Accept("")', {
                expr = true,
                replace_keycodes = false
            })
            vim.g.copilot_no_tab_map = true
        end
    }
end

-- Run make when telescope-fzf-native is installed or updated
--   Needs to be here incase it is installed out of the lock file
vim.api.nvim_create_autocmd('PackChanged', { 
    callback = function(ev)
        -- Use available |event-data|
        local name, kind = ev.data.spec.name, ev.data.kind

        print(name)

        -- Run build script after plugin's code has changed
        if name == 'telescope-fzf-native.nvim' and (kind == 'install' or kind == 'update') then
            -- Append `:wait()` if you need synchronous execution
            vim.system({ 'make' }, { cwd = ev.data.path })
        end
    end
})

require("allrisc.plugins.common")
require("allrisc.plugins.theme")
require("allrisc.plugins.telescope")

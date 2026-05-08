-- Initial LSP Setup
local capabilities = vim.lsp.protocol.make_client_capabilities()
if capabilities.workspace then
  capabilities.workspace.didChangeWatchedFiles = nil
end

vim.lsp.config('*', {
  capabilities = capabilities,
})

vim.lsp.log.set_level("info")

-- Setup Completion
default_keymaps = {
    { keys = "gd", func = vim.lsp.buf.definition, desc = "Goto definition", has = "definitionProvider" },
    { keys = "K", func = vim.lsp.buf.hover, desc = "Hover Documentation", has = "hoverProvider"  },
    { keys = "<leader>vd", func = vim.diagnostic.open_float, desc = "Open Diagnoatic Float" },
}

local completion = vim.g.completion_mode or "native" -- or 'native' for built-in completion
vim.api.nvim_create_autocmd("LspAttach", {
	-- group = augroup("lsp_attach"),
	callback = function(args)
		local client = vim.lsp.get_client_by_id(args.data.client_id)
		local buf = args.buf
        -- Built-in completion
		if client then
			if completion == "native" and client:supports_method("textDocument/completion") then
				vim.lsp.completion.enable(true, client.id, args.buf )
			end

			-- Inlay hints
			if client:supports_method("textDocument/inlayHint") then
				vim.lsp.inlay_hint.enable(true, { bufnr = args.buf })
			end

            -- Document coloring
			if client:supports_method("textDocument/documentColor") then
	 	        vim.lsp.document_color.enable(true, { bufnr = buf })
			end

			for _, km in ipairs(default_keymaps) do
				-- Only bind if there's no `has` requirement, or the server supports it
				if not km.has or client.server_capabilities[km.has] then
					vim.keymap.set(
						km.mode or "n",
						km.keys,
						km.func,
						{ buffer = buf, desc = "LSP: " .. km.desc, nowait = km.nowait }
					)
				end
			end
		end
	end,
})

vim.lsp.enable({"lua_ls", "pyright", "svls", "bashls", "clangd", "zls"})


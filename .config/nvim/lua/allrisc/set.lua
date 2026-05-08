-- Line numbers and navigation
vim.opt.nu = true
vim.opt.relativenumber = true
vim.opt.wrap = false
vim.opt.scrolloff = 8      -- Keep 8 lines above/below the cursor
vim.opt.sidescrolloff = 8  -- Keep 8 columns left or right of the cursor

-- Indentation
vim.opt.tabstop = 4
vim.opt.softtabstop = 4
vim.opt.shiftwidth = 4
vim.opt.expandtab = true
vim.opt.smartindent = true
vim.opt.autoindent = true

-- File Handling
vim.opt.swapfile = false
vim.opt.backup = false

vim.opt.undodir = os.getenv("HOME") .. "/.vim/undodir"
vim.opt.undofile = true

-- Visual Settings
vim.opt.colorcolumn = "100"  -- Create a colored column at col 100 to encourage line wrapping

vim.opt.termguicolors = true  -- Enable 24-bit colors
vim.opt.signcolumn = "yes"    -- Always show sign column

-- Search Settings
vim.opt.ignorecase = true  -- Case insensitive search except when a capital letter is included
vim.opt.hlsearch = true    -- Highlight search results
vim.opt.incsearch = true   -- Incrementally show search results as you type

-- Folding settings
vim.opt.smoothscroll = true
vim.opt.foldmethod = "expr"
vim.opt.foldexpr = "v:lua.vim.treesitter.foldexpr()"
vim.opt.foldlevel = 99 -- Start with all folds open
vim.opt.formatoptions = "jcroqlnt"

-- Grep Settings
vim.opt.grepformat = "%f:%l:%c:%m"
vim.opt.grepprg = "rg --vimgrep"

-- Split behavior
vim.opt.splitbelow = true -- Horizontal splits go below
vim.opt.splitright = true -- Vertical splits go right
vim.opt.splitkeep = "screen"

-- Setup the file explorer
vim.g.netrw_banner = 0 -- Hide the netrw banner
vim.g.netrw_altv = 1 -- Create the split of the NetRW window to the left
vim.g.netrw_browse_split = 4 -- open files in the previous window
vim.g.netrw_liststyle = 3 -- Setup the default list style
vim.g.netrw_winsize = 14 -- Set the width of the netrw drawer

-- Setup folding to improve visual polish
vim.opt.fillchars = {
    foldopen = " ",
    foldclose = " ",
    fold = " ",
    foldsep = " ",
}

-- Create undo directory if it doesn't exist
local undodir = vim.fn.expand("~/.vim/undodir")
if vim.fn.isdirectory(undodir) == 0 then
    vim.fn.mkdir(undodir, "p")
end

-- Default Filetype Handling
vim.filetype.add({
  extension = {
    env = "dotenv",
  },
  filename = {
    [".env"] = "dotenv",
    ["env"] = "dotenv",
  },
  pattern = {
    ["[jt]sconfig.*.json"] = "jsonc",
    ["%.env%.[%w_.-]+"] = "dotenv",
  },
})

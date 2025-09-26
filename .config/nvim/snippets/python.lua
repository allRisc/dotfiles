local ls = require("luasnip")
local f = ls.function_node
local s = ls.s
local i = ls.insert_node
local t = ls.text_node
local d = ls.dynamic_node
local c = ls.choice_node
local sn = ls.sn

local ts_locals = require "nvim-treesitter.locals"
local ts_utils = require "nvim-treesitter.ts_utils"

local function get_node_text(node)
    print("get_node_text")
    return vim.treesitter.get_node_text(
        node,
        vim.api.nvim_get_current_buf()
    )
end

local function get_function_node()
    local cursor_node = ts_utils.get_node_at_cursor()
    if cursor_node == nil then
        return nil
    end
    local scope = ts_locals.get_scope_tree(cursor_node, 0)

    for _, v in ipairs(scope) do
        if
            v:type() == "function_definition"
        then
            return v
        end

        if
            v:type() == "class_definition" or
            v:type() == "module"
        then
            return nil
        end
    end
end

local docstring_args = function()
    local function_node = get_function_node()
    if function_node == nil then
        return sn(1)
    end

    local query = vim.treesitter.query.parse("python",
        [[
            (function_definition parameters: (parameters (identifier) @sparameter))
            (function_definition parameters: (parameters (typed_parameter (identifier) @tparameter (type) @ttype)))
            (function_definition parameters: (parameters (default_parameter (identifier) @dparameter value: (_) @dvalue)))
            (function_definition parameters: (parameters (typed_default_parameter (identifier) @tdparameter (type) @tdtype value: (_) @tdvalue)))
        ]]
    )
    local nodes = {}
    local insert_idx = 1

   for id, match, metadata in query:iter_matches(
        function_node,
        vim.api.nvim_get_current_buf()
    ) do
        local line_sn

        if (id == 1) then -- sparameter
            line_sn = sn(insert_idx, {
                t({ "", "" }),
                t("    "), t(get_node_text(match[1][1])), t(": "), i(1, "desc"),
            })
        elseif (id == 2) then -- tparameter
            line_sn = sn(insert_idx, {
                t({ "", "" }),
                t("    "), t(get_node_text(match[2][1])),
                t(" ("), t(get_node_text(match[3][1])), t("): "), i(1, "desc"),
            })
        elseif (id == 3) then -- dparameter
            line_sn = sn(insert_idx, {
                t({ "", "" }),
                t("    "), t(get_node_text(match[4][1])),
                t(" (optional): "), i(1, "desc"),
                t(" Defaults to "), t(get_node_text(match[5][1])), t("."),
            })
        else -- tdparameter
            line_sn = sn(insert_idx, {
                t({ "", "" }),
                t("    "), t(get_node_text(match[6][1])),
                t(" ("), t(get_node_text(match[7][1])), t(", optional): "), i(1, "desc"),
                t(" Defaults to "), t(get_node_text(match[8][1])), t("."),
            })
        end

        insert_idx = insert_idx + 1
        table.insert(nodes, line_sn)
    end

    if (#nodes > 0) then
        table.insert(nodes, 1, t({ "", "", "Args:", }))
    end

    return sn(1, nodes)
end

local docstring_returns = function()
    local function_node = get_function_node()
    if function_node == nil then
        return sn(1)
    end

    local query = vim.treesitter.query.parse(
        "python",
        "(function_definition return_type: (_) @rtype)"
    )

    for id, match, _ in query:iter_matches(
        function_node,
        vim.api.nvim_get_current_buf()
    ) do
        return sn(1, {
            t({ "", "", "Returns:", "" }),
            t("    "), t(get_node_text(match[1][1])), t(": "),
            i(1),
        })
    end

    return sn(1, {})
end
vim.keymap.set('n', '<leader>aa', docstring_returns)

return {
    s("\"\"\"", {
        t("\"\"\""), i(1, "desc"),
        d(2, docstring_args),
        d(3, docstring_returns),
        t({ "", "\"\"\"", "" }), i(0),
    }),
}

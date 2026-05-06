---
name: confluence-interaction
description: Interact with Confluence pages, spaces, and attachments via the `atlas confluence` CLI. Use when the user wants to read, update, list, or manage Confluence content from the command line. Use everytime the user wants confluence tasks performed.
---

# Rules for Confluence

1. Always check with a user before overwriting existing confluence page
2. When updating or creating a confluence page check if the space has a 'AGENTS' page. If it does then first read this page and use the instructions in it to guide your work.
3. Prefer the 'search' mechanism over the list mechanisms when trying to find a specific page.

# Confluence Interaction

Use `atlas confluence` subcommands to interact with Confluence. All commands support short aliases shown in parentheses.

## Search

```bash
atlas confluence search "<CQL>"
```

Search for content using the confluence query language.

Some example searchs:

```
space = "TEST"  # Will search for content with space a space title exactly equal to "TEST"
type = page and creator = jsmith and space = DEV  # Find all the pages in the 'DEV' space created by jsmith
type = page and title ~ design and space = "A Space"  # Fuzzy find all pages in the "A Space" with a title containing 'design'
space = "DEV" and label = 'dv'  # Find all content in the DEV space with a lable of dv
```

## Spaces

```bash
atlas confluence space list          # (s ls) — list all accessible spaces, returns space keys
atlas confluence space list SEARCH   # (s ls) — fuzzy search spaces by key, name, or description
```

You need a space key (e.g. `DS`) for all page and attachment commands. If you don't know the key, use `space list` with a search term to find it.

## Pages

The page identifier is always `SPACE-KEY/Page-Title`. Use quote when the title has spaces: `"DS/My Page"`.

```bash
atlas confluence page list SPACE-KEY                          # (p ls)  — list pages in a space
atlas confluence page view SPACE/title --format FORMAT        # (p v)   — read a page
atlas confluence page update SPACE/title --file PATH --format FORMAT  # (p up) — write a page
```

### View formats (--format)

`storage` (default, XML-like) | `view` | `export_view` | `styled_view` | `editor` | `plain` | `markdown`

Use `--format storage` when you need to read or process page content. Only use 'markdown' or 'export_view' when a user asks you to save them to a file.

### Making Changes

When making changes save the `storage` format to a temporary file, make changes to that xml file, and then upload the new changed file.

## Attachments

```bash
atlas confluence attachment list SPACE/title                      # (att ls) — list attachments
atlas confluence attachment upload --file PATH SPACE/title        # (att ul) — upload a file
atlas confluence attachment download SPACE/title ATTACHMENT-NAME  # (att dl) — download a file
atlas confluence attachment delete SPACE/title ATTACHMENT-NAME    # (att rm) — delete an attachment
```

## Key patterns

- To read a page into a local file: `atlas confluence p v SPACE/title --format markdown > output.md`
- To update a page from a local file: `atlas confluence p up SPACE/title --file input.md --format markdown`
- To pipe content: `cat content.md | atlas confluence p up SPACE/title --format markdown`
- Titles are case-sensitive. If a page isn't found, verify with `atlas confluence p ls SPACE-KEY`.

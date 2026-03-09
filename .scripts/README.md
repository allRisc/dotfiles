# Dotfiles Scripts

This directory contains a useful set of scripts and their tab completion code which I find generally useful.

## The Worktree Command - ``wt``

The ``wt`` command is a custom wrapper around git worktrees, designed to simplify the workflow of managing multiple branches simultaneously. It must be sourced (not executed) to enable directory changing functionality.

### Installation

Add the following to your ``.zshrc``:

```zsh
source /path/to/wt.sh
```

### Subcommands Overview

| Command Name | Usage | Description |
|--------------|-----------------------------|-------------|
| init         | `wt init <remote> [dest]`   | Does a bare clone of the remote into the destination if provided |
| switch       | `wt switch [-c] <branch>`   | Creates if necessary a worktree for the given branch and cd's to it |
| delete       | `wt delete [-f] <branch>`   | Remove the worktree for the given branch and delete any now empty directories |
| list         | `wt list`                   | List all worktrees in the current repository |
| update       | `wt update`                 | Fetch and prune remote branches, updating the bare repo |
| push         | `wt push [remote] [branch]` | Push the current worktree branch to the remote |
| version      | `wt version`                | Provides the version of the wt scripts |

---

### ``wt init``

```
wt init <remote> [dest]
```

Clones a bare git repository from the remote URL into the specified destination directory.

**Arguments:**
- `<remote>` - The git remote URL to clone (required)
- `[dest]` - The destination directory (optional)

**Behavior:**
- If no destination is provided, the repository name is extracted from the remote URL and `.git` is appended to create the destination directory name
- Creates a bare clone suitable for worktree management
- After cloning, changes directory to the new bare repository

**Examples:**
```zsh
# Clone with auto-generated destination name
wt init git@github.com:user/myrepo.git
# Creates: myrepo.git/

# Clone to specific destination  
wt init git@github.com:user/myrepo.git ~/projects/myrepo.git
```

---

### ``wt switch``

```
wt switch [-c] <branch>
```

Switch to a worktree for the specified branch, creating it if necessary.

**Arguments:**
- `-c` - Create a new branch (optional flag)
- `<branch>` - The branch name to switch to (required)

**Behavior:**
- If a worktree for the branch already exists, changes directory to it
- If no worktree exists but the branch exists remotely/locally, creates a new worktree and changes to it
- With `-c` flag, creates a new branch based on:
  - The current branch if already in a worktree
  - `main` or `master` (whichever exists) if in the bare repository root
- Worktrees are created inside the bare repository directory, named after the branch

**Examples:**
```zsh
# Switch to existing worktree or create one for existing branch
wt switch feature/my-feature

# Create a new branch and worktree
wt switch -c feature/new-feature
```

---

### ``wt delete``

```
wt delete [-f] <branch>
```

Remove the worktree for the specified branch.

**Arguments:**
- `-f` - Force deletion even if there are uncommitted changes (optional flag)
- `<branch>` - The branch name whose worktree should be deleted (required)

**Behavior:**
- Removes the worktree directory using `git worktree remove`
- Cleans up any empty parent directories left behind
- If currently in the worktree being deleted, changes directory to the bare repository root
- With `-f` flag, forces removal even with uncommitted changes

**Examples:**
```zsh
# Delete a worktree (fails if uncommitted changes)
wt delete feature/old-feature

# Force delete a worktree
wt delete -f feature/abandoned-work
```

---

### ``wt list``

```
wt list
```

List all worktrees associated with the current repository.

**Behavior:**
- Displays all worktrees with their paths, HEAD commits, and branch names
- Works from within any worktree or the bare repository root

**Example Output:**
```
/home/user/projects/myrepo.git                      (bare)
/home/user/projects/myrepo.git/main                 abc1234 [main]
/home/user/projects/myrepo.git/feature/login        def5678 [feature/login]
```

---

### ``wt update``

```
wt update
```

Fetch updates from the remote and prune stale references.

**Behavior:**
- Runs `git fetch --all --prune` in the bare repository
- Updates all remote tracking branches
- Removes references to branches that no longer exist on the remote

---

### ``wt push``

```
wt push [remote] [branch]
```

Push the current worktree's branch to a remote.

**Arguments:**
- `[remote]` - The remote to push to (default: `origin`)
- `[branch]` - The branch to push (default: current branch)

**Behavior:**
- Must be run from within a worktree (not the bare repository)
- Pushes the current branch to the specified remote
- Sets upstream tracking if not already configured

**Examples:**
```zsh
# Push current branch to origin
wt push

# Push to specific remote
wt push upstream

# Push specific branch to specific remote
wt push origin feature/my-feature
```

---

### ``wt version``

```
wt version
```

Display the current version of the wt script.

---

## Directory Structure

When using `wt`, your project structure will look like:

```
myrepo.git/                     # Bare repository (created by wt init)
    ├── HEAD
    ├── config
    ├── objects/
    ├── refs/
    ├── main/                   # Worktree for main branch
    │   └── (working files)
    ├── feature/                # Directory for feature branches
    │   └── my-feature/         # Worktree for feature/my-feature
    │       └── (working files)
    └── bugfix/                 # Directory for bugfix branches
        └── issue-123/          # Worktree for bugfix/issue-123
            └── (working files)
```


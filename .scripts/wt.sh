#!/usr/bin/env zsh
# wt - Git Worktree Manager
# This script must be sourced, not executed, to enable directory changing.
# Add to your .zshrc: source /path/to/wt.sh

WT_VERSION="1.0.0"

# Resolve command abbreviations to full command names
__wt_resolve_abbrev() {
    local abbrev="$1"
    local commands=("init" "switch" "delete" "list" "update" "push" "version" "help")
    
    # Check for exact match first
    for cmd in "${commands[@]}"; do
        if [[ "$abbrev" == "$cmd" ]]; then
            echo "$cmd"
            return 0
        fi
    done
    
    # Find matching commands (abbreviation must match start of command)
    local matches=()
    for cmd in "${commands[@]}"; do
        if [[ "$cmd" == "$abbrev"* ]]; then
            matches+=("$cmd")
        fi
    done
    
    # Handle results
    case ${#matches[@]} in
        0)
            # No match - return original
            echo "$abbrev"
            return 1
            ;;
        1)
            # Unique match found
            echo "${matches[1]}"
            return 0
            ;;
        *)
            # Ambiguous - warn and return original
            echo "wt: ambiguous command '$abbrev' (matches: ${matches[*]})" >&2
            echo "$abbrev"
            return 1
            ;;
    esac
}

# Main wt function
wt() {
    local raw_cmd="${1:-}"
    
    if [[ -z "$raw_cmd" ]]; then
        __wt_usage
        return 1
    fi
    
    shift
    
    # Resolve abbreviation to full command
    local cmd
    cmd=$(__wt_resolve_abbrev "$raw_cmd")
    local resolve_status=$?
    
    case "$cmd" in
        init)
            __wt_init "$@"
            ;;
        switch)
            __wt_switch "$@"
            ;;
        delete)
            __wt_delete "$@"
            ;;
        list)
            __wt_list "$@"
            ;;
        update)
            __wt_update "$@"
            ;;
        push)
            __wt_push "$@"
            ;;
        version)
            __wt_version
            ;;
        help|--help|-h)
            __wt_usage
            ;;
        *)
            echo "wt: unknown command '$cmd'" >&2
            __wt_usage
            return 1
            ;;
    esac
}

# Display usage information
__wt_usage() {
    cat <<EOF
wt - Git Worktree Manager v${WT_VERSION}

Usage: wt <command> [options]

Commands (can be abbreviated):
    init <remote> [dest]    Clone a bare repository for worktree use
    switch [-c] <branch>    Switch to or create a worktree for a branch
    delete [-f] <branch>    Remove a worktree
    list                    List all worktrees
    update                  Fetch and prune remote branches
    push [remote] [branch]  Push the current branch to remote
    version                 Show version information
    help                    Show this help message

Examples:
    wt sw feature-branch    (switch)
    wt del -f feature-branch (delete force)
    wt li                   (list)

Run 'wt <command> --help' for more information on a specific command.
EOF
}

# Find the bare repository root from current location
__wt_find_bare_root() {
    local dir="${1:-$(pwd)}"
    
    # Check if we're in a bare repo (HEAD, objects, refs at top level)
    if [[ -f "$dir/HEAD" && -d "$dir/objects" && -d "$dir/refs" ]]; then
        echo "$dir"
        return 0
    fi
    
    # Check if we're in a worktree - find the gitdir
    local git_dir
    if git_dir=$(git rev-parse --git-dir 2>/dev/null); then
        # For worktrees, git-dir points to .git/worktrees/<name>
        local common_dir
        if common_dir=$(git rev-parse --git-common-dir 2>/dev/null); then
            common_dir="$(cd "$common_dir" && pwd)"
            # If common_dir ends with .git, return its parent (the repo root)
            if [[ "$(basename "$common_dir")" == ".git" ]]; then
                dirname "$common_dir"
            else
                # It's a true bare repo
                echo "$common_dir"
            fi
            return 0
        fi
    fi
    
    return 1
}

# Get the git directory for git commands (may be .git subdir or bare repo root)
__wt_get_git_dir() {
    local repo_root
    if repo_root=$(__wt_find_bare_root); then
        # If there's a .git subdirectory, use that
        if [[ -d "$repo_root/.git" ]]; then
            echo "$repo_root/.git"
        else
            echo "$repo_root"
        fi
    else
        return 1
    fi
}

# Get the worktree base directory (the bare repo itself)
__wt_get_base_dir() {
    local bare_root
    if bare_root=$(__wt_find_bare_root); then
        echo "$bare_root"
    else
        return 1
    fi
}

# wt init - Clone a bare repository
__wt_init() {
    if [[ "$1" == "--help" || "$1" == "-h" ]]; then
        cat <<EOF
Usage: wt init <remote> [dest]

Clone a bare git repository for use with worktrees.

Arguments:
    <remote>    The git remote URL to clone
    [dest]      The destination directory (optional)

If no destination is provided, the repository name is extracted
from the remote URL and '.git' is appended.
EOF
        return 0
    fi
    
    local remote="$1"
    local dest="$2"
    
    if [[ -z "$remote" ]]; then
        echo "wt init: missing remote URL" >&2
        echo "Usage: wt init <remote> [dest]" >&2
        return 1
    fi
    
    # Extract repo name from remote if dest not provided
    if [[ -z "$dest" ]]; then
        # Handle various remote formats:
        # git@github.com:user/repo.git
        # https://github.com/user/repo.git
        # https://github.com/user/repo
        local repo_name
        repo_name=$(basename "$remote")
        repo_name="${repo_name%.git}"
        dest="${repo_name}.git"
    fi
    
    # Ensure dest ends with .git
    if [[ "$dest" != *.git ]]; then
        dest="${dest}.git"
    fi
    
    if [[ -e "$dest" ]]; then
        echo "wt init: destination '$dest' already exists" >&2
        return 1
    fi
    
    echo "Cloning bare repository to '$dest'..."
    if git clone --bare "$remote" "$dest"; then
        # Configure the bare repo for worktree use
        cd "$dest" || return 1
        
        # Set fetch to get all branches
        git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
        
        # Fetch to get remote tracking branches
        git fetch origin
        
        echo "Successfully initialized bare repository in '$dest'"
        echo "Use 'wt switch <branch>' to create a worktree"
    else
        echo "wt init: failed to clone repository" >&2
        return 1
    fi
}

# wt switch - Switch to or create a worktree
__wt_switch() {
    if [[ "$1" == "--help" || "$1" == "-h" ]]; then
        cat <<EOF
Usage: wt switch [-c] <branch>

Switch to or create a worktree for the specified branch.

Options:
    -c          Create a new branch

Arguments:
    <branch>    The branch name to switch to

If -c is specified, a new branch is created based on:
  - The current branch if in a worktree
  - main/master if in the bare repository root
EOF
        return 0
    fi
    
    local create_branch=0
    local branch=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -c)
                create_branch=1
                shift
                ;;
            -*)
                echo "wt switch: unknown option '$1'" >&2
                return 1
                ;;
            *)
                branch="$1"
                shift
                ;;
        esac
    done
    
    if [[ -z "$branch" ]]; then
        echo "wt switch: missing branch name" >&2
        echo "Usage: wt switch [-c] <branch>" >&2
        return 1
    fi
    
    local bare_root
    if ! bare_root=$(__wt_find_bare_root); then
        echo "wt switch: not in a git worktree repository" >&2
        return 1
    fi
    
    local git_dir
    git_dir=$(__wt_get_git_dir)
    
    # Worktrees are placed inside the bare repo directory
    local base_dir="$bare_root"
    
    # Determine worktree path - handle branches with slashes
    local worktree_path="${base_dir}/${branch}"
    
    # Check if worktree already exists by looking up the branch in git worktree list
    local existing_path
    existing_path=$(git --git-dir="$git_dir" worktree list --porcelain | \
        awk -v branch="$branch" '
            /^worktree / { path = substr($0, 10) }
            /^branch refs\/heads\// { 
                b = substr($0, 19)
                if (b == branch) print path
            }
        ')
    
    if [[ -n "$existing_path" ]]; then
        echo "Switching to existing worktree for '$branch'..."
        cd "$existing_path" || return 1
        return 0
    fi
    
    # Also check if the worktree directory already exists on disk
    if [[ -d "$worktree_path" ]]; then
        echo "Switching to existing worktree for '$branch'..."
        cd "$worktree_path" || return 1
        return 0
    fi
    
    # Creating new worktree
    if [[ $create_branch -eq 1 ]]; then
        # Determine the base branch for new branch
        local base_branch
        local current_branch
        
        # Check if we're in a worktree
        if current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null); then
            if [[ "$current_branch" != "HEAD" ]]; then
                base_branch="$current_branch"
            fi
        fi
        
        # If not in a worktree or detached HEAD, use main/master
        if [[ -z "$base_branch" ]]; then
            if git --git-dir="$git_dir" show-ref --verify --quiet refs/heads/main; then
                base_branch="main"
            elif git --git-dir="$git_dir" show-ref --verify --quiet refs/heads/master; then
                base_branch="master"
            elif git --git-dir="$git_dir" show-ref --verify --quiet refs/remotes/origin/main; then
                base_branch="origin/main"
            elif git --git-dir="$git_dir" show-ref --verify --quiet refs/remotes/origin/master; then
                base_branch="origin/master"
            else
                echo "wt switch: cannot determine base branch (no main or master found)" >&2
                return 1
            fi
        fi
        
        echo "Creating new branch '$branch' from '$base_branch'..."
        
        # Create parent directories if needed
        mkdir -p "$(dirname "$worktree_path")"
        
        if git --git-dir="$git_dir" worktree add -b "$branch" "$worktree_path" "$base_branch"; then
            cd "$worktree_path" || return 1
            
            # Set upstream if a matching branch exists on origin
            if git --git-dir="$git_dir" show-ref --verify --quiet "refs/remotes/origin/$branch" 2>/dev/null; then
                git branch --set-upstream-to="origin/$branch" "$branch"
            fi
            
            echo "Created and switched to new worktree for '$branch'"
        else
            echo "wt switch: failed to create worktree" >&2
            return 1
        fi
    else
        # Check if branch exists locally or remotely
        local is_local=0
        local branch_ref=""
        
        if git --git-dir="$git_dir" show-ref --verify --quiet "refs/heads/$branch"; then
            is_local=1
            branch_ref="$branch"
        elif git --git-dir="$git_dir" show-ref --verify --quiet "refs/remotes/origin/$branch"; then
            branch_ref="origin/$branch"
        else
            echo "wt switch: branch '$branch' does not exist" >&2
            echo "Use 'wt switch -c $branch' to create a new branch" >&2
            return 1
        fi
        
        echo "Creating worktree for '$branch'..."
        
        # Create parent directories if needed
        mkdir -p "$(dirname "$worktree_path")"
        
        if [[ $is_local -eq 1 ]]; then
            # Branch exists locally, just add the worktree
            if git --git-dir="$git_dir" worktree add "$worktree_path" "$branch"; then
                cd "$worktree_path" || return 1
                
                # Set upstream if a matching branch exists on origin and no upstream is set
                if git --git-dir="$git_dir" show-ref --verify --quiet "refs/remotes/origin/$branch" 2>/dev/null; then
                    if ! git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' >/dev/null 2>&1; then
                        git branch --set-upstream-to="origin/$branch" "$branch"
                    fi
                fi
                
                echo "Created and switched to worktree for '$branch'"
            else
                echo "wt switch: failed to create worktree" >&2
                return 1
            fi
        else
            # Branch only exists on remote, create local tracking branch
            if git --git-dir="$git_dir" worktree add --track -b "$branch" "$worktree_path" "$branch_ref"; then
                cd "$worktree_path" || return 1
                echo "Created and switched to worktree for '$branch'"
            else
                echo "wt switch: failed to create worktree" >&2
                return 1
            fi
        fi
    fi
}

# wt delete - Remove a worktree
__wt_delete() {
    if [[ "$1" == "--help" || "$1" == "-h" ]]; then
        cat <<EOF
Usage: wt delete [-f] <branch>

Remove the worktree for the specified branch.

Options:
    -f          Force removal even with uncommitted changes

Arguments:
    <branch>    The branch name whose worktree to remove
EOF
        return 0
    fi
    
    local force=0
    local branch=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -f)
                force=1
                shift
                ;;
            -*)
                echo "wt delete: unknown option '$1'" >&2
                return 1
                ;;
            *)
                branch="$1"
                shift
                ;;
        esac
    done
    
    if [[ -z "$branch" ]]; then
        echo "wt delete: missing branch name" >&2
        echo "Usage: wt delete [-f] <branch>" >&2
        return 1
    fi
    
    local bare_root
    if ! bare_root=$(__wt_find_bare_root); then
        echo "wt delete: not in a git worktree repository" >&2
        return 1
    fi
    
    local git_dir
    git_dir=$(__wt_get_git_dir)
    
    # Find the worktree path for this branch
    local worktree_path
    worktree_path=$(git --git-dir="$git_dir" worktree list --porcelain | \
        awk -v branch="$branch" '
            /^worktree / { path = substr($0, 10) }
            /^branch refs\/heads\// { 
                b = substr($0, 19)
                if (b == branch) print path
            }
        ')
    
    if [[ -z "$worktree_path" ]]; then
        echo "wt delete: no worktree found for branch '$branch'" >&2
        return 1
    fi
    
    # Check if we're currently in the worktree being deleted
    local current_dir
    current_dir=$(pwd)
    local in_deleted_worktree=0
    
    if [[ "$current_dir" == "$worktree_path"* ]]; then
        in_deleted_worktree=1
    fi
    
    # Remove the worktree
    local force_flag=""
    if [[ $force -eq 1 ]]; then
        force_flag="--force"
    fi
    
    echo "Removing worktree for '$branch'..."
    if git --git-dir="$git_dir" worktree remove $force_flag "$worktree_path"; then
        echo "Worktree removed successfully"
        
        # Clean up empty parent directories
        local parent_dir
        parent_dir=$(dirname "$worktree_path")
        # base_dir is the bare repo itself
        local base_dir="$bare_root"
        
        while [[ "$parent_dir" != "$base_dir" && -d "$parent_dir" ]]; do
            if [[ -z "$(ls -A "$parent_dir" 2>/dev/null)" ]]; then
                rmdir "$parent_dir" 2>/dev/null
                parent_dir=$(dirname "$parent_dir")
            else
                break
            fi
        done
        
        # If we were in the deleted worktree, move to bare root
        if [[ $in_deleted_worktree -eq 1 ]]; then
            echo "Returning to bare repository root..."
            cd "$bare_root" || return 1
        fi
    else
        echo "wt delete: failed to remove worktree" >&2
        echo "Use 'wt delete -f $branch' to force removal" >&2
        return 1
    fi
}

# wt list - List all worktrees
__wt_list() {
    if [[ "$1" == "--help" || "$1" == "-h" ]]; then
        cat <<EOF
Usage: wt list

List all worktrees in the current repository.
EOF
        return 0
    fi
    
    local git_dir
    if ! git_dir=$(__wt_get_git_dir); then
        echo "wt list: not in a git worktree repository" >&2
        return 1
    fi
    
    git --git-dir="$git_dir" worktree list
}

# wt update - Fetch and prune remote branches
__wt_update() {
    if [[ "$1" == "--help" || "$1" == "-h" ]]; then
        cat <<EOF
Usage: wt update

Fetch and prune remote branches, updating the bare repository.
EOF
        return 0
    fi
    
    local git_dir
    if ! git_dir=$(__wt_get_git_dir); then
        echo "wt update: not in a git worktree repository" >&2
        return 1
    fi
    
    echo "Fetching and pruning remote branches..."
    git --git-dir="$git_dir" fetch --all --prune
}

# wt push - Push current branch to remote
__wt_push() {
    if [[ "$1" == "--help" || "$1" == "-h" ]]; then
        cat <<EOF
Usage: wt push [remote] [branch]

Push the current worktree branch to a remote.

Arguments:
    [remote]    The remote to push to (default: origin)
    [branch]    The branch to push (default: current branch)
EOF
        return 0
    fi
    
    # Must be in a worktree, not bare repo
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        echo "wt push: not in a git repository" >&2
        return 1
    fi
    
    local is_bare
    is_bare=$(git rev-parse --is-bare-repository 2>/dev/null)
    if [[ "$is_bare" == "true" ]]; then
        echo "wt push: cannot push from bare repository" >&2
        echo "Switch to a worktree first with 'wt switch <branch>'" >&2
        return 1
    fi
    
    local remote="${1:-origin}"
    local branch="${2:-$(git rev-parse --abbrev-ref HEAD)}"
    
    if [[ "$branch" == "HEAD" ]]; then
        echo "wt push: cannot push detached HEAD" >&2
        return 1
    fi
    
    echo "Pushing '$branch' to '$remote'..."
    git push -u "$remote" "$branch"
}

# wt version - Show version
__wt_version() {
    echo "wt version $WT_VERSION"
}

# Tab completion for zsh
if [[ -n "$ZSH_VERSION" ]]; then
    _wt() {
        local -a commands
        commands=(
            'init:Clone a bare repository for worktree use'
            'switch:Switch to or create a worktree for a branch'
            'delete:Remove a worktree'
            'list:List all worktrees'
            'update:Fetch and prune remote branches'
            'push:Push the current branch to remote'
            'version:Show version information'
            'help:Show help message'
        )
        
        local -a switch_opts delete_opts
        switch_opts=('-c:Create a new branch')
        delete_opts=('-f:Force removal')
        
        _arguments -C \
            '1: :->command' \
            '*: :->args'
        
        case "$state" in
            command)
                _describe -t commands 'wt commands' commands
                ;;
            args)
                # Resolve the abbreviated command to its full name for completion
                local resolved_cmd
                resolved_cmd=$(__wt_resolve_abbrev "${words[2]}" 2>/dev/null) || resolved_cmd="${words[2]}"
                
                case "$resolved_cmd" in
                    switch)
                        _arguments \
                            '-c[Create a new branch]' \
                            '*: :__wt_complete_branches'
                        ;;
                    delete)
                        _arguments \
                            '-f[Force removal]' \
                            '*: :__wt_complete_worktree_branches'
                        ;;
                    push)
                        _arguments \
                            '1: :__wt_complete_remotes' \
                            '2: :__wt_complete_branches'
                        ;;
                    *)
                        ;;
                esac
                ;;
        esac
    }
    
    __wt_complete_branches() {
        local git_dir
        if git_dir=$(__wt_get_git_dir 2>/dev/null); then
            local -a branches
            branches=(${(f)"$(git --git-dir="$git_dir" for-each-ref --format='%(refname:short)' refs/heads refs/remotes/origin 2>/dev/null | sed 's|^origin/||' | sort -u)"})
            _describe -t branches 'branches' branches
        fi
    }
    
    __wt_complete_worktree_branches() {
        local git_dir
        if git_dir=$(__wt_get_git_dir 2>/dev/null); then
            local -a branches
            branches=(${(f)"$(git --git-dir="$git_dir" worktree list --porcelain 2>/dev/null | awk '/^branch refs\/heads\// { print substr($0, 19) }')"})
            _describe -t branches 'worktree branches' branches
        fi
    }
    
    __wt_complete_remotes() {
        local git_dir
        if git_dir=$(__wt_get_git_dir 2>/dev/null); then
            local -a remotes
            remotes=(${(f)"$(git --git-dir="$git_dir" remote 2>/dev/null)"})
            _describe -t remotes 'remotes' remotes
        fi
    }
    
    compdef _wt wt
fi

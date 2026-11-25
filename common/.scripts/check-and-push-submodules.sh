#!/usr/bin/env bash

# Check and push submodules recursively, then push parent repo
check_and_push_submodules() {
    local parent_repo=$(pwd)
    local failed=0
    
    # Helper function to check and push a branch if needed (for submodules)
    __check_submodule() {
        local repo_path="$1"
        local repo_name="$2"
        
        echo "Checking $repo_name..."
        echo "  Path: $repo_path"
        
        pushd "$repo_path" > /dev/null || return 1
        
        # Get current branch or HEAD state
        local current_branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
        
        # Check if we're in detached HEAD state
        if [ -z "$current_branch" ]; then
            echo "❌ ERROR: $repo_name is in detached HEAD state!"
            echo "Path: $repo_path"
            popd > /dev/null
            return 1
        fi
        
        echo "  Current branch: $current_branch"
        
        # Check if the branch exists on the remote
        if git ls-remote --heads origin "$current_branch" 2>/dev/null | grep -q "refs/heads/$current_branch"; then
            echo "  ✓ Branch '$current_branch' exists on remote origin"
        else
            echo "  ⚠ Branch '$current_branch' does NOT exist on remote origin"
            echo "  Attempting to push branch to origin..."
            
            if ! git push origin "$current_branch" 2>&1; then
                echo "❌ ERROR: Failed to push branch '$current_branch' to origin"
                echo "Repository: $repo_name"
                echo "Path: $repo_path"
                popd > /dev/null
                return 1
            fi
            
            echo "  ✓ Successfully pushed '$current_branch' to origin"
        fi
        
        popd > /dev/null
        echo ""
        return 0
    }
    
    # Helper function to push the current branch (for parent repo)
    __push_current_branch() {
        local repo_path="$1"
        local repo_name="$2"
        
        echo "Pushing $repo_name..."
        echo "  Path: $repo_path"
        
        pushd "$repo_path" > /dev/null || return 1
        
        # Get current branch
        local current_branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
        
        if [ -z "$current_branch" ]; then
            echo "❌ ERROR: $repo_name is in detached HEAD state!"
            echo "Path: $repo_path"
            popd > /dev/null
            return 1
        fi
        
        echo "  Current branch: $current_branch"
        echo "  Pushing to origin..."
        
        if ! git push origin "$current_branch" 2>&1; then
            echo "❌ ERROR: Failed to push branch '$current_branch' to origin"
            echo "Repository: $repo_name"
            echo "Path: $repo_path"
            popd > /dev/null
            return 1
        fi
        
        echo "  ✓ Successfully pushed '$current_branch' to origin"
        
        popd > /dev/null
        echo ""
        return 0
    }
    
    echo "=========================================="
    echo "Checking and Pushing Submodules"
    echo "=========================================="
    echo ""
    
    # Get list of all submodule paths
    local submodule_paths=$(git submodule foreach --recursive --quiet 'echo $PWD' 2>/dev/null || true)
    
    # Process each submodule
    if [ -n "$submodule_paths" ]; then
        while IFS= read -r submodule_path; do
            if [ -n "$submodule_path" ] && [ -d "$submodule_path" ]; then
                local submodule_name=$(basename "$submodule_path")
                if ! __check_submodule "$submodule_path" "submodule: $submodule_name"; then
                    return 1
                fi
            fi
        done <<< "$submodule_paths"
    else
        echo "No submodules found."
        echo ""
    fi
    
    echo "=========================================="
    echo "Pushing Parent Repository"
    echo "=========================================="
    echo ""
    
    # Return to parent repo and push it
    cd "$parent_repo" || return 1
    if ! __push_current_branch "$parent_repo" "parent repository"; then
        return 1
    fi
    
    echo "=========================================="
    echo "✓ All operations completed successfully!"
    echo "=========================================="
    
    return 0
}

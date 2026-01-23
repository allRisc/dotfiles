####################################################################################################
# Instant Prompt
####################################################################################################

####################################################################################################
# Get LS Colors if necessary
####################################################################################################
if [[ -v LS_COLORS ]]; then
    LS_COLORS=$(bash -c "echo \$LS_COLORS")
fi

####################################################################################################
# Setup the environment
####################################################################################################
[[ ! -f $HOME/.env ]] || source $HOME/.env
[[ ! -f $HOME/.secrets.sh ]] || source $HOME/.secrets.sh

####################################################################################################
# Setup the Tooling
####################################################################################################
[[ -f $HOME/.zsh_tools ]] && source $HOME/.zsh_tools

####################################################################################################
# Load Oh-My-Posh Config
####################################################################################################

eval "$(oh-my-posh init zsh --config $HOME/.config/ohmyposh/allrisc_omp.toml)"

####################################################################################################
# ZSH Plugins
####################################################################################################
zinit light zsh-users/zsh-syntax-highlighting
zinit light zsh-users/zsh-completions

# Configure auto suggestions and change to emac key binding
zinit light zsh-users/zsh-autosuggestions

bindkey -e
bindkey '^p' history-search-backward
bindkey '^n' history-search-forward

# FZF Completion Extension
zinit light Aloxaf/fzf-tab

####################################################################################################
# ZSH Snippets
####################################################################################################
zinit snippet OMZP::git

####################################################################################################
# Configure Completions
####################################################################################################
if [ ! -d $HOME/.zcompletions ]; then
    mkdir $HOME/.zcompletions
fi
fpath+=$HOME/.zcompletions

# Load Completions
autoload -Uz compinit && compinit

zinit cdreplay -q

# Get LS Colors
eval "$(dircolors)"

# Completion style
zstyle ':completion:*:default' list-colors ${(s.:.)LS_COLORS}
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zstyle ':completion:*:default' menu no

# FZF Completion Extensions
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-preview 'ls --color $realpath'

####################################################################################################
# Configure History
####################################################################################################
HISTSIZE=5000
HISTFILE=~/.zsh_history
SAVEHIST=$HISTSIZE
HISTDUP=erase
setopt appendhistory
setopt sharehistory
setopt hist_ignore_space
setopt hist_ignore_all_dups
setopt hist_save_no_dups
setopt hist_ignore_dups
setopt hist_find_no_dups

####################################################################################################
# Fix Home, End, Delete, and Forward/Backward (ctrl+left/right)
####################################################################################################
bindkey "^[[H"   beginning-of-line
bindkey "^[[F"   end-of-line
bindkey "^[[3~"  delete-char

bindkey "^[[1;5C" forward-word
bindkey "^[[1;5D" backward-word

####################################################################################################
# Aliases
####################################################################################################
[[ ! -f ~/.zsh_funcs ]] || source ~/.zsh_funcs
[[ ! -f ~/.zsh_aliases ]] || source ~/.zsh_aliases


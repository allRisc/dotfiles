####################################################################################################
# Instant Prompt
####################################################################################################
# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
    source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

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
# Setup the Prompt (PowerLevel10k)
####################################################################################################
zinit ice depth=1; zinit light romkatv/powerlevel10k

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

####################################################################################################
# Load Powerlevel10k Config
####################################################################################################

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh


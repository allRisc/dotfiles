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
# Setup the path
####################################################################################################
if [[ -f ~/.path.sh ]]; then
    source ~/.path.sh
fi

####################################################################################################
# ZInit Package Manager
####################################################################################################
# Set the directory we want to store zinit and plugins
ZINIT_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}/zinit/zinit.git"

# Download Zinit, if it's not there yet
if [ ! -d "$ZINIT_HOME" ]; then
    mkdir -p "$(dirname $ZINIT_HOME)"
    git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
fi

# Source/Load zinit
source "${ZINIT_HOME}/zinit.zsh"

####################################################################################################
# FZF (Fuzzy Finder Integration)
####################################################################################################
if [[ ! -f ~/.fzf.zsh ]]; then
    echo "Installing Fzf"
    git clone --depth 1 https://github.com/junegunn/fzf.git ~/.fzf
    ~/.fzf/install
fi
source ~/.fzf.zsh

# Install 'fd' a better find
if ! command -v fdfind 2>&1 > /dev/null; then
    echo "Installing fd (through the fd-find pacakge)"
    sudo apt install fd-find
fi

if [ ! -f ~/.local/bin/fd ]; then
    echo "Linking fd to fdfind"
    ln -s $(command -v fdfind) ~/.local/bin/fd
fi

# Use fd for listing FZF path candidates
_fzf_compgen_path () {
    fd --hidden --follow --exclude ".git" . "$1"
}

# Use fd to generate the list for directory completion
_fzf_compgen_dir () {
    fd --type d --hidden --follow --exclude ".git" . "$1"
}

####################################################################################################
# ZOxide (Better CD)
####################################################################################################

if [ ! -f ~/.local/bin/zoxide ]; then
    pushd ~/.local
    echo "Installing ZOxide"
    curl -sSfL https://raw.githubusercontent.com/ajeetdsouza/zoxide/main/install.sh | sh
    popd
fi

eval "$(zoxide init --cmd cd zsh)"

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
if [[ -f ~/.zsh_funcs ]]; then
    source ~/.zsh_funcs
fi

if [[ -f ~/.zsh_aliases ]]; then
    source ~/.zsh_aliases
fi

####################################################################################################
# Load pyenv if found
####################################################################################################
if [[ -d $HOME/.pyenv ]]; then
    export PYENV_ROOT="$HOME/.pyenv"
    [[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
    eval "$(pyenv init - zsh)"

    export VIRTUALENV_DISCOVERY="pyenv"    
fi

####################################################################################################
# Load Powerlevel10k Config
####################################################################################################

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

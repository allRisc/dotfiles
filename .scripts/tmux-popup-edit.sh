#!/usr/bin/env zsh
# tmux-popup-edit - A command which can be used to write 
#   a file in neovim from a tmux pop-up and have the text
#   placed in the terminal where the pop-up was launched
# This script must be sourced, not executed, to enable directory changing.
# Add to your .zshrc: source /path/to/tmux-popup-edit.sh

tmux-popup-edit() {
    TMPFILE="/tmp/$USER/tmux-popup-$$.tmp"
    mkdir -p "/tmp/$USER"

    nvim -c "startinsert" "$TMPFILE"

    if [ -s "$TMPFILE" ]; then
        CONTENTS=$(cat $TMPFILE)
        tmux send-keys -t $1 -I "$CONTENTS"
        sleep 0.01
    fi

    rm -f "$TMPFILE"
}

#!/bin/bash

allrisc_install() {
    if ! command -v nvim 2>&1 > /dev/null; then
        echo "Installing NeoVIM"
        pushd ~/Downloads
        curl -fL https://github.com/neovim/neovim/releases/latest/download/nvim-linux-x86_64.tar.gz -o nvim-linux-x86_64.tar.gz
        tar -xf nvim-linux-x86_64.tar.gz
        cp nvim-linux-x86_64/* $HOME/.local -r
        rm -rf nvim-linux-*
        popd
    fi

    if ! command -v git 2>&1 > /dev/null; then
        echo "Installing git"
	    sudo apt install git
    fi

    if ! command -v g++ 2>&1 > /dev/null; then
        echo "Installing G++"
	    sudo apt install g++
    fi

    if ! command -v make 2>&1 > /dev/null; then
        echo "Installing make"
	    sudo apt install make
    fi

    if ! command -v cmake 2>&1 > /dev/null; then
        echo "Installing cmake"
	    sudo apt install cmake
    fi

    if ! command -v lua-language-server 2>&1 > /dev/null; then
        echo "Installing lua_ls"
        pushd ~/Downloads
        version="3.18.2"
        curl -fL https://github.com/LuaLS/lua-language-server/releases/download/$version/lua-language-server-$version-linux-x64.tar.gz -o lua-language-server.tar.gz
        mkdir lua-language-server
        tar -xf lua-language-server.tar.gz -C lua-language-server/
        cp lua-language-server/* $HOME/.local -r
        rm -rf lua-language-server*
        popd
    fi

    if ! command -v uv 2>&1 > /dev/null; then
        echo "Installing UV"
        curl -LsSf https://astral.sh/uv/install.sh | sh
    fi

    if ! command -v pyright 2>&1 > /dev/null; then
        echo "Installing pyright-lsp"
        uv tool install pyright
    fi

    if ! command -v slang-server 2>&1 > /dev/null; then
        echo "Installing slang_server"
        pushd ~/Downloads/
        git clone https://github.com/hudson-trading/slang-server.git
        cd slang-server
        git submodule update --init --recursive
        cmake -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS="-Wno-maybe-uninitialized"
        cmake --build build -j4 --target slang_server
        cp build/bin/slang-server $HOME/.local/bin
        ..
        rm -rf slang-server
        popd
    fi

    if ! command -v tree-sitter 2>&1 > /dev/null; then
        echo "Installing tree-sitter"
        npm install -g tree-sitter-cli
    fi

    if ! command -v rg 2>&1 > /dev/null; then
	echo "Installing ripgrep"
	sudo apt install ripgrep
    fi
}

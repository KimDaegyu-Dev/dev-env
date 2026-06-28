#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -eq 0 ]]; then
  SUDO=()
else
  SUDO=(sudo)
fi

"${SUDO[@]}" apt-get update
"${SUDO[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y \
  build-essential \
  ca-certificates \
  curl \
  direnv \
  fd-find \
  fzf \
  git \
  jq \
  neovim \
  python-is-python3 \
  python3-pip \
  python3-venv \
  ripgrep \
  shellcheck \
  tmux \
  unzip \
  zip \
  zsh

mkdir -p "$HOME/.local/bin"
if command -v fdfind >/dev/null 2>&1 && ! command -v fd >/dev/null 2>&1; then
  ln -sf "$(command -v fdfind)" "$HOME/.local/bin/fd"
fi

echo
echo "WSL CLI tools installed successfully."
echo 'Add $HOME/.local/bin to PATH if it is not already available.'

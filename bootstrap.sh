#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ensure_node() {
  if command -v node >/dev/null 2>&1 && [[ "$(node -p 'Number(process.versions.node.split(`.`)[0])')" -ge 24 ]]; then
    return
  fi

  if [[ "$(uname -s)" == "Darwin" ]]; then
    if ! command -v brew >/dev/null 2>&1; then
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      if [[ -x /opt/homebrew/bin/brew ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
      fi
    fi
    brew install node@24
    export PATH="$(brew --prefix node@24)/bin:$PATH"
  else
    if ! command -v mise >/dev/null 2>&1; then
      curl -fsSL https://mise.run | sh
      export PATH="$HOME/.local/bin:$PATH"
    fi
    mise use --global node@24
    eval "$(mise activate bash)"
  fi
}

ensure_node

if [[ "$(uname -s)" == "Darwin" ]] && ! command -v brew >/dev/null 2>&1; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
fi

if ! command -v mise >/dev/null 2>&1; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    brew install mise
  else
    curl -fsSL https://mise.run | sh
    export PATH="$HOME/.local/bin:$PATH"
  fi
fi

corepack enable pnpm 2>/dev/null || npm install --global pnpm
cd "$REPO_ROOT"
pnpm install
pnpm build

mkdir -p "$HOME/.local/bin"
chmod +x "$REPO_ROOT/packages/cli/dist/index.js"
ln -sfn "$REPO_ROOT/packages/cli/dist/index.js" "$HOME/.local/bin/dev-env"

exec node "$REPO_ROOT/packages/cli/dist/index.js" setup "$@"

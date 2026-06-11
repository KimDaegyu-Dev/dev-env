#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/install-macos.sh --profile <common|frontend|rust|cpp|backend|ai-python|fullstack|graphics|java>
  bash scripts/install-macos.sh --open [path]

This script only installs VS Code extensions from recommendations and opens VS Code profiles.
It does not run destructive commands such as git add, git commit, docker compose down, or rm -rf.
USAGE
}

profile_name() {
  case "$1" in
    common) echo "Common" ;;
    frontend) echo "Frontend" ;;
    rust) echo "Rust" ;;
    cpp) echo "C++" ;;
    backend) echo "Backend" ;;
    ai-python) echo "AI(Python)" ;;
    fullstack) echo "Fullstack" ;;
    graphics) echo "Graphics" ;;
    java) echo "Java" ;;
    *) return 1 ;;
  esac
}

detect_profile_from_path() {
  case "$1" in
    *"/GitHub/Frontend/"*) echo "Frontend" ;;
    *"/GitHub/Rust/"*) echo "Rust" ;;
    *"/GitHub/C++/"*) echo "C++" ;;
    *"/GitHub/Backend/"*) echo "Backend" ;;
    *"/GitHub/AI-Python/"*) echo "AI(Python)" ;;
    *"/GitHub/Fullstack/"*) echo "Fullstack" ;;
    *"/GitHub/Graphics/"*) echo "Graphics" ;;
    *) echo "Default" ;;
  esac
}

install_extensions() {
  local profile="$1"
  local file="$ROOT_DIR/vscode/$profile/extensions.json"

  if [[ ! -f "$file" ]]; then
    echo "Unknown profile or missing extension file: $profile" >&2
    exit 1
  fi

  if ! command -v code >/dev/null 2>&1; then
    echo "VS Code CLI 'code' was not found. Install it from VS Code first." >&2
    exit 1
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is required to read extensions.json. Install Node.js first." >&2
    exit 1
  fi

  node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    for (const id of data.recommendations || []) console.log(id);
  ' "$file" | while IFS= read -r extension_id; do
    [[ -z "$extension_id" ]] && continue
    echo "Installing $extension_id"
    code --install-extension "$extension_id"
  done
}

open_with_detected_profile() {
  local target="${1:-$PWD}"
  local profile
  profile="$(detect_profile_from_path "$target")"
  echo "Opening $target with VS Code profile: $profile"
  code --profile "$profile" "$target"
}

if [[ $# -eq 0 ]]; then
  usage
  exit 0
fi

case "${1:-}" in
  --profile)
    [[ $# -ge 2 ]] || { usage; exit 1; }
    install_extensions "$2"
    ;;
  --open)
    open_with_detected_profile "${2:-$PWD}"
    ;;
  -h|--help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac

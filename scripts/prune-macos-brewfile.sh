#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  prune-macos-brewfile.sh <Brewfile> [--dry-run] [--zap] [--no-cleanup]

Examples:
  ./scripts/prune-macos-brewfile.sh apps/macos/Brewfile.ai
  ./scripts/prune-macos-brewfile.sh apps/macos/Brewfile.graphics --dry-run
  ./scripts/prune-macos-brewfile.sh apps/macos/Brewfile.design --zap

Options:
  --dry-run     Print what would be uninstalled without uninstalling.
  --zap         Use `brew uninstall --cask --zap` for casks.
  --no-cleanup  Skip `brew cleanup -s`.
EOF
}

BREWFILE=""
DRY_RUN=false
ZAP=false
CLEANUP=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --zap)
      ZAP=true
      shift
      ;;
    --no-cleanup)
      CLEANUP=false
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ -z "$BREWFILE" ]]; then
        BREWFILE="$1"
      else
        echo "ERROR: Unknown argument: $1"
        usage
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$BREWFILE" ]]; then
  usage
  exit 1
fi

if [[ ! -f "$BREWFILE" ]]; then
  echo "ERROR: Brewfile not found: $BREWFILE"
  exit 1
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "ERROR: brew command not found."
  exit 1
fi

run() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

extract_entries() {
  local kind="$1"

  # 지원 형태:
  # brew "name"
  # cask "name"
  # mas "Name", id: 123
  #
  # 주석 줄은 제외.
  sed -E 's/[[:space:]]+#.*$//' "$BREWFILE" |
    grep -E "^[[:space:]]*${kind}[[:space:]]+['\"][^'\"]+['\"]" |
    sed -E "s/^[[:space:]]*${kind}[[:space:]]+['\"]([^'\"]+)['\"].*$/\1/"
}

extract_mas_ids() {
  # mas "Xcode", id: 497799835
  sed -E 's/[[:space:]]+#.*$//' "$BREWFILE" |
    grep -E "^[[:space:]]*mas[[:space:]]+['\"][^'\"]+['\"].*id:[[:space:]]*[0-9]+" |
    sed -E "s/^.*id:[[:space:]]*([0-9]+).*$/\1/"
}

uninstall_formula() {
  local name="$1"

  if brew list --formula "$name" >/dev/null 2>&1; then
    echo "Uninstalling formula: $name"
    run brew uninstall --formula "$name"
  else
    echo "Formula not installed: $name"
  fi
}

uninstall_cask() {
  local name="$1"

  if brew list --cask "$name" >/dev/null 2>&1; then
    echo "Uninstalling cask: $name"

    if [[ "$ZAP" == true ]]; then
      run brew uninstall --cask --zap "$name"
    else
      run brew uninstall --cask "$name"
    fi
  else
    echo "Cask not installed: $name"
  fi
}

uninstall_mas() {
  local app_id="$1"

  if ! command -v mas >/dev/null 2>&1; then
    echo "mas command not found. Skipping Mac App Store app id: $app_id"
    return
  fi

  if mas list | awk '{print $1}' | grep -qx "$app_id"; then
    echo "Uninstalling Mac App Store app id: $app_id"

    # mas uninstall은 환경에 따라 동작이 제한될 수 있음.
    # 실패하면 Finder 또는 Launchpad에서 직접 삭제.
    run mas uninstall "$app_id" || {
      echo "WARN: mas uninstall failed for id: $app_id"
      echo "      Remove it manually from Finder or Launchpad."
    }
  else
    echo "Mac App Store app not installed: $app_id"
  fi
}

echo "Brewfile: $BREWFILE"
echo "Dry run:  $DRY_RUN"
echo "Zap:      $ZAP"
echo

echo "== Formulas =="
while IFS= read -r name; do
  [[ -z "$name" ]] && continue
  uninstall_formula "$name"
done < <(extract_entries "brew")

echo
echo "== Casks =="
while IFS= read -r name; do
  [[ -z "$name" ]] && continue
  uninstall_cask "$name"
done < <(extract_entries "cask")

echo
echo "== Mac App Store =="
while IFS= read -r app_id; do
  [[ -z "$app_id" ]] && continue
  uninstall_mas "$app_id"
done < <(extract_mas_ids)

if [[ "$CLEANUP" == true ]]; then
  echo
  echo "== Homebrew cleanup =="
  run brew cleanup -s

  echo
  echo "== Homebrew cache size =="
  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] du -sh \"$(brew --cache)\""
  else
    du -sh "$(brew --cache)" || true
  fi
fi

echo
echo "Done."

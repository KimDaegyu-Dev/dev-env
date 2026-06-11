#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VSCODE_DIR="$ROOT_DIR/vscode"

# folder name -> VS Code profile name
declare -A PROFILES=(
  ["frontend"]="Frontend"
  ["rust"]="Rust"
  ["cpp"]="C++"
  ["backend"]="Backend"
  ["ai-python"]="AI(Python)"
  ["fullstack"]="Fullstack"
  ["graphics"]="Graphics"
  ["java"]="Java"
)

ensure_code_cli() {
  if ! command -v code >/dev/null 2>&1; then
    echo "ERROR: 'code' command not found."
    echo "VS Code에서 Cmd+Shift+P → Shell Command: Install 'code' command in PATH를 실행하세요."
    exit 1
  fi
}

ensure_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "ERROR: 'jq' command not found."
    echo "macOS라면 다음으로 설치하세요:"
    echo "  brew install jq"
    exit 1
  fi
}

read_json_array() {
  local file="$1"
  local key="$2"

  if [[ ! -f "$file" ]]; then
    return 0
  fi

  jq -r ".${key}[]? // empty" "$file"
}

create_profile_if_needed() {
  local profile_name="$1"
  local scratch_dir="$ROOT_DIR/.tmp/vscode-profile-bootstrap/$profile_name"

  mkdir -p "$scratch_dir"

  echo
  echo "Ensuring profile exists: $profile_name"

  # VS Code는 --profile로 폴더를 열 때 해당 프로필이 없으면 빈 프로필을 생성합니다.
  code "$scratch_dir" --profile "$profile_name" --new-window >/dev/null 2>&1 || true
}

install_extension() {
  local profile_name="$1"
  local extension_id="$2"

  if [[ -z "$extension_id" ]]; then
    return 0
  fi

  echo "  + $extension_id"
  code --install-extension "$extension_id" --profile "$profile_name" --force
}

install_extensions_from_file() {
  local profile_name="$1"
  local file="$2"
  local label="$3"

  if [[ ! -f "$file" ]]; then
    echo "WARN: Missing $label file: $file"
    return 0
  fi

  echo
  echo "Installing $label recommendations from:"
  echo "  $file"

  read_json_array "$file" "recommendations" | while read -r extension_id; do
    install_extension "$profile_name" "$extension_id"
  done
}

print_review_needed() {
  local file="$1"
  local label="$2"

  if [[ ! -f "$file" ]]; then
    return 0
  fi

  local items
  items="$(read_json_array "$file" "reviewNeeded" || true)"

  if [[ -n "$items" ]]; then
    echo
    echo "Review needed extensions from $label:"
    echo "$items" | sed 's/^/  ? /'
  fi
}

apply_profile() {
  local slug="$1"
  local profile_name="${PROFILES[$slug]}"

  local common_file="$VSCODE_DIR/common/extensions.json"
  local profile_file="$VSCODE_DIR/$slug/extensions.json"

  echo
  echo "========================================"
  echo "Applying VS Code profile"
  echo "Profile: $profile_name"
  echo "Folder:  $slug"
  echo "========================================"

  create_profile_if_needed "$profile_name"

  install_extensions_from_file "$profile_name" "$common_file" "common"
  install_extensions_from_file "$profile_name" "$profile_file" "$slug"

  print_review_needed "$common_file" "common"
  print_review_needed "$profile_file" "$slug"

  echo
  echo "Installed extensions for $profile_name:"
  code --list-extensions --profile "$profile_name" | sed 's/^/  - /'
}

main() {
  ensure_code_cli
  ensure_jq

  local target="${1:-all}"

  if [[ "$target" == "all" ]]; then
    for slug in frontend rust cpp backend ai-python fullstack graphics java; do
      apply_profile "$slug"
    done
  else
    if [[ -z "${PROFILES[$target]+x}" ]]; then
      echo "ERROR: Unknown profile: $target"
      echo
      echo "Available profiles:"
      printf '  %s\n' "${!PROFILES[@]}" | sort
      echo
      echo "Example:"
      echo "  $0 frontend"
      exit 1
    fi

    apply_profile "$target"
  fi

  echo
  echo "Done."
}

main "$@"
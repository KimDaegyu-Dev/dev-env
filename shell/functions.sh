mkcd() {
  if [[ $# -ne 1 ]]; then
    echo "usage: mkcd <directory>" >&2
    return 2
  fi
  mkdir -p "$1" && cd "$1" || return
}

croot() {
  local root
  root="$(git rev-parse --show-toplevel 2>/dev/null)" || return 1
  cd "$root" || return
}

devsetup() {
  dev-env setup "$@"
}

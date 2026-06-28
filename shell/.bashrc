if [[ -z "${DEV_ENV_ROOT:-}" ]]; then
  _dev_env_shell_file="${BASH_SOURCE[0]}"
  [[ -L "$_dev_env_shell_file" ]] && _dev_env_shell_file="$(readlink "$_dev_env_shell_file")"
  export DEV_ENV_ROOT="$(cd "$(dirname "$_dev_env_shell_file")/.." && pwd)"
  unset _dev_env_shell_file
fi
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$HOME/.cargo/bin:$PATH"

[[ -r "$DEV_ENV_ROOT/shell/aliases.sh" ]] && source "$DEV_ENV_ROOT/shell/aliases.sh"
[[ -r "$DEV_ENV_ROOT/shell/functions.sh" ]] && source "$DEV_ENV_ROOT/shell/functions.sh"

command -v mise >/dev/null 2>&1 && eval "$(mise activate bash)"
command -v direnv >/dev/null 2>&1 && eval "$(direnv hook bash)"
command -v starship >/dev/null 2>&1 && eval "$(starship init bash)"

[[ -r "$HOME/.config/dev-env/local.bash" ]] && source "$HOME/.config/dev-env/local.bash"

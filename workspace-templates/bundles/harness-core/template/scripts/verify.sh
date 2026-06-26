#!/usr/bin/env sh
set -eu

mode="${1:-fast}"

set -- {{runtimeCommandPrefix}}
runtime_bin="$1"
if ! command -v "$runtime_bin" >/dev/null 2>&1; then
  echo "Missing runtime command: $runtime_bin" >&2
  echo "Install the runtime for {{runtime}} before running verification." >&2
  exit 127
fi

has_script() {
  script_name="$1"
  node -e "const fs=require('fs'); const p='package.json'; if(!fs.existsSync(p)) process.exit(1); const pkg=JSON.parse(fs.readFileSync(p,'utf8')); process.exit(pkg.scripts && pkg.scripts[process.argv[1]] ? 0 : 1)" "$script_name"
}

run_script() {
  script_name="$1"
  if has_script "$script_name"; then
    echo ">> {{runtimeCommandPrefix}} $script_name"
    {{runtimeCommandPrefix}} "$script_name"
  else
    echo "skip: package script '$script_name' is not defined"
  fi
}

echo "== Verify: $mode =="

case "$mode" in
  fast)
    run_script "format:check"
    run_script "lint"
    run_script "typecheck"
    run_script "test"
    ;;
  full)
    run_script "build"
    run_script "test:e2e"
    ./scripts/harness-doctor.sh
    ;;
  *)
    echo "Usage: ./scripts/verify.sh fast|full" >&2
    exit 1
    ;;
esac

echo "verify $mode complete"

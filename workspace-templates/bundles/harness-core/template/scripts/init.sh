#!/usr/bin/env sh
set -eu

echo "== Harness init =="
echo "Project: {{projectName}}"
echo "Runtime: {{runtime}}"

set -- {{runtimeCommandPrefix}}
runtime_bin="$1"
if ! command -v "$runtime_bin" >/dev/null 2>&1; then
  echo "Missing runtime command: $runtime_bin" >&2
  echo "Install the runtime for {{runtime}} before running init." >&2
  exit 127
fi

if [ -f ".env.example" ] && [ ! -f ".env" ]; then
  echo "No .env found. Create one from .env.example when the project requires local secrets."
fi

if [ -f "package.json" ]; then
  echo "Installing runtime dependencies:"
  echo "  {{runtimeInstallCommand}}"
  {{runtimeInstallCommand}}
fi

if [ -f "docker-compose.yml" ]; then
  echo "Local services are available with:"
  echo "  docker compose up -d"
fi

echo "Running harness doctor..."
./scripts/harness-doctor.sh

echo "Init complete."
echo "Resume with: ./scripts/agent-status.sh"

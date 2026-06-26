#!/usr/bin/env bash
set -euo pipefail

if command -v slangc >/dev/null 2>&1; then
  mkdir -p assets/shaders/generated
  find assets/shaders -type f -name '*.slang' -print0 | while IFS= read -r -d '' shader; do
    out="assets/shaders/generated/$(basename "$shader" .slang).spv"
    slangc "$shader" -target spirv -o "$out"
  done
  exit 0
fi

if command -v glslc >/dev/null 2>&1; then
  mkdir -p assets/shaders/generated
  find assets/shaders -type f \( -name '*.vert' -o -name '*.frag' -o -name '*.comp' \) -print0 | while IFS= read -r -d '' shader; do
    out="assets/shaders/generated/$(basename "$shader").spv"
    glslc "$shader" -o "$out"
  done
  exit 0
fi

echo "No shader compiler found. Install Slang or Vulkan SDK glslc." >&2
exit 1

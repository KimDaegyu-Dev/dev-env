#!/usr/bin/env sh
set -eu

echo "== Agent Status =="
echo "Project: {{projectName}}"
echo "Runtime: {{runtime}}"
echo "Packs: {{packs}}"
echo "Bundles: {{bundles}}"
echo ""

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Branch:"
  git branch --show-current 2>/dev/null || true
  echo ""
  echo "Recent commits:"
  git log --oneline -12 2>/dev/null || true
  echo ""
else
  echo "Git: not initialized"
  echo ""
fi

echo "Feature summary:"
node <<'NODE'
const fs = require("fs");
const file = "feature_list.json";
if (!fs.existsSync(file)) {
  console.log("- feature_list.json missing");
  process.exit(0);
}
const features = JSON.parse(fs.readFileSync(file, "utf8"));
const counts = new Map();
for (const feature of features) {
  counts.set(feature.status, (counts.get(feature.status) ?? 0) + 1);
}
for (const [status, count] of [...counts.entries()].sort()) {
  console.log(`- ${status}: ${count}`);
}
const active = features.filter((feature) => feature.status === "active");
const blocked = features.filter((feature) => feature.status === "blocked");
if (active.length > 0) {
  console.log("\nActive:");
  for (const feature of active) console.log(`- ${feature.id}: ${feature.title} (${feature.task_path})`);
}
if (blocked.length > 0) {
  console.log("\nBlocked:");
  for (const feature of blocked) console.log(`- ${feature.id}: ${feature.title} (${feature.task_path})`);
}
NODE

echo ""
echo "Human handoffs:"
find tasks/human -maxdepth 1 -type f -name 'HUMAN-BLOCKED-*.md' ! -name 'HUMAN-BLOCKED-template.md' -print 2>/dev/null | sort || true

echo ""
echo "Next:"
echo "1. cat AGENTS.md"
echo "2. cat docs/00-project-map.md"
echo "3. cat docs/01-current-state.md"
echo "4. Choose exactly one unfinished feature from feature_list.json"

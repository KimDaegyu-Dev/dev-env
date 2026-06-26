#!/usr/bin/env sh
set -eu

node <<'NODE'
const fs = require("fs");
const path = require("path");

const allowedStatuses = new Set([
  "planned",
  "active",
  "blocked",
  "ready-for-review",
  "passing",
  "reverted",
]);

const requiredFiles = [
  "AGENTS.md",
  "feature_list.json",
  "docs/00-project-map.md",
  "docs/01-current-state.md",
  "docs/policies/tool-permissions.md",
  "scripts/agent-status.sh",
  "scripts/verify.sh",
  "scripts/harness-doctor.sh",
];

const errors = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    errors.push(`missing required file: ${file}`);
  }
}

let features = [];
try {
  features = JSON.parse(fs.readFileSync("feature_list.json", "utf8"));
  if (!Array.isArray(features)) {
    errors.push("feature_list.json must be an array");
    features = [];
  }
} catch (error) {
  errors.push(`feature_list.json is invalid JSON: ${error.message}`);
}

const activeFeatures = features.filter((feature) => feature.status === "active");
if (activeFeatures.length > 1) {
  errors.push(`only one active feature is allowed, found ${activeFeatures.length}`);
}

for (const feature of features) {
  for (const field of [
    "id",
    "priority",
    "title",
    "status",
    "task_path",
    "risk",
    "acceptance_criteria",
    "verification",
    "evidence",
    "human_gate",
  ]) {
    if (!(field in feature)) {
      errors.push(`${feature.id ?? "unknown feature"} missing field: ${field}`);
    }
  }

  if (!allowedStatuses.has(feature.status)) {
    errors.push(`${feature.id}: invalid status '${feature.status}'`);
  }

  if (feature.task_path && !fs.existsSync(feature.task_path)) {
    errors.push(`${feature.id}: task_path does not exist: ${feature.task_path}`);
  }

  if (feature.status === "passing" && (!Array.isArray(feature.evidence) || feature.evidence.length === 0)) {
    errors.push(`${feature.id}: passing status requires at least one evidence entry`);
  }

  if (feature.task_path && fs.existsSync(feature.task_path)) {
    for (const name of ["task.yaml", "EXEC_PLAN.md", "RESULTS.md"]) {
      const target = path.join(feature.task_path, name);
      if (!fs.existsSync(target)) {
        errors.push(`${feature.id}: missing task package file: ${target}`);
      }
    }
  }
}

const humanDir = "tasks/human";
if (fs.existsSync(humanDir)) {
  const cards = fs
    .readdirSync(humanDir)
    .filter((name) => name.startsWith("HUMAN-BLOCKED-") && name.endsWith(".md") && name !== "HUMAN-BLOCKED-template.md");

  if (cards.length > 0) {
    const linked = features.some(
      (feature) => feature.status === "blocked" || (feature.human_gate && feature.human_gate !== null),
    );
    if (!linked) {
      errors.push("human handoff cards exist but no feature is blocked or linked to a human_gate");
    }
  }
}

if (errors.length > 0) {
  console.error("Harness doctor failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Harness doctor passed.");
NODE

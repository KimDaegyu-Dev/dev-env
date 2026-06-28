#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const vscodeDir = path.join(rootDir, "vscode");

function stateRoot() {
  if (process.env.DEV_ENV_STATE_HOME) return path.resolve(process.env.DEV_ENV_STATE_HOME);
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "dev-env");
  }
  if (process.platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"),
      "dev-env",
    );
  }
  return path.join(
    process.env.XDG_STATE_HOME ?? path.join(os.homedir(), ".local", "state"),
    "dev-env",
  );
}

const profiles = {
  frontend: "Frontend",
  rust: "Rust",
  cpp: "C++",
  backend: "Backend",
  "ai-python": "AI(Python)",
  fullstack: "Fullstack",
  graphics: "Graphics",
  java: "Java",
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      recommendations: [],
      reviewNeeded: [],
    };
  }

  const raw = fs.readFileSync(filePath, "utf8");

  try {
    const parsed = JSON.parse(raw);

    return {
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      reviewNeeded: Array.isArray(parsed.reviewNeeded) ? parsed.reviewNeeded : [],
    };
  } catch (error) {
    throw new Error(`Invalid JSON: ${filePath}\n${error.message}`);
  }
}

function ensureCodeCli() {
  const result = spawnSync("code", ["--version"], {
    stdio: "ignore",
    shell: false,
  });

  if (result.error || result.status !== 0) {
    console.error("ERROR: 'code' command not found.");
    console.error(
      "VS Code에서 Cmd+Shift+P → Shell Command: Install 'code' command in PATH를 실행하세요.",
    );
    process.exit(1);
  }
}

function createProfileIfNeeded(profileName) {
  const scratchDir = path.join(stateRoot(), "cache", "vscode-profile-bootstrap", profileName);

  fs.mkdirSync(scratchDir, { recursive: true });

  console.log(`\nEnsuring profile exists: ${profileName}`);

  // VS Code는 --profile로 폴더를 열 때 해당 프로필이 없으면 빈 프로필을 생성합니다.
  spawnSync("code", [scratchDir, "--profile", profileName, "--new-window"], {
    stdio: "ignore",
    shell: false,
  });
}

function installExtension(profileName, extensionId) {
  if (!extensionId || typeof extensionId !== "string") {
    return;
  }

  console.log(`  + ${extensionId}`);
  run("code", ["--install-extension", extensionId, "--profile", profileName, "--force"]);
}

function installExtensionsFromJson(profileName, filePath, label) {
  const data = readJson(filePath);

  console.log(`\nInstalling ${label} recommendations from:`);
  console.log(`  ${filePath}`);

  for (const extensionId of data.recommendations) {
    installExtension(profileName, extensionId);
  }

  if (data.reviewNeeded.length > 0) {
    console.log(`\nReview needed extensions from ${label}:`);
    for (const extensionId of data.reviewNeeded) {
      console.log(`  ? ${extensionId}`);
    }
  }
}

function applyProfile(slug) {
  const profileName = profiles[slug];

  if (!profileName) {
    throw new Error(`Unknown profile slug: ${slug}`);
  }

  const commonFile = path.join(vscodeDir, "common", "extensions.json");
  const profileFile = path.join(vscodeDir, slug, "extensions.json");

  console.log("");
  console.log("========================================");
  console.log("Applying VS Code profile");
  console.log(`Profile: ${profileName}`);
  console.log(`Folder:  ${slug}`);
  console.log("========================================");

  createProfileIfNeeded(profileName);

  installExtensionsFromJson(profileName, commonFile, "common");
  installExtensionsFromJson(profileName, profileFile, slug);

  console.log(`\nInstalled extensions for ${profileName}:`);
  run("code", ["--list-extensions", "--profile", profileName]);
}

function main() {
  ensureCodeCli();

  const target = process.argv[2] ?? "all";

  if (target === "all") {
    for (const slug of [
      "frontend",
      "rust",
      "cpp",
      "backend",
      "ai-python",
      "fullstack",
      "graphics",
      "java",
    ]) {
      applyProfile(slug);
    }
    return;
  }

  if (!profiles[target]) {
    console.error(`ERROR: Unknown profile slug: ${target}`);
    console.error("");
    console.error("Available:");
    for (const slug of Object.keys(profiles)) {
      console.error(`  ${slug}`);
    }
    process.exit(1);
  }

  applyProfile(target);
}

main();

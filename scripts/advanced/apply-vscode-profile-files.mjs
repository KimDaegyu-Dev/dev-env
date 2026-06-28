#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// scripts/advanced/apply-vscode-profile-files.mjs 기준 repo root
const DEFAULT_REPO_ROOT = path.resolve(__dirname, "..", "..");

function devEnvStateRoot() {
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

const PROFILE_ORDER = [
  "frontend",
  "rust",
  "cpp",
  "backend",
  "ai-python",
  "fullstack",
  "graphics",
  "java",
];

const DEFAULT_PROFILE_NAMES = {
  frontend: "Frontend",
  rust: "Rust",
  cpp: "C++",
  backend: "Backend",
  "ai-python": "AI(Python)",
  fullstack: "Fullstack",
  graphics: "Graphics",
  java: "Java",
};

const PROFILE_FILES = ["settings.json", "keybindings.json", "tasks.json", "mcp.json"];

const RUN_TIMESTAMP = createTimestamp();

function log(message = "") {
  console.log(message);
}

function warn(message) {
  console.warn(`WARN: ${message}`);
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function printHelp() {
  console.log(`
Usage:
  node scripts/advanced/apply-vscode-profile-files.mjs [profile] [options]

Profiles:
  all
  frontend
  rust
  cpp
  backend
  ai-python
  fullstack
  graphics
  java

Options:
  --dry-run                   Print actions without writing files
  --no-extensions             Do not install extensions via VS Code CLI
  --scan                      Scan VS Code internal profiles and exit
  --init-map                  Create vscode/profile-map.json template and exit
  --create-missing-profiles   If profile id is missing, create VS Code profile and update profile-map.json
  --sync-extensions           Uninstall extensions not listed in recommendations or keepInstalled
  --prune-review-needed       With --sync-extensions, also allow removing reviewNeeded extensions
  --repo-root <path>          Repository root path
  --vscode-user-dir <path>    VS Code User directory path
  --app <name>                code | insiders | codium
  -h, --help                  Show help

Examples:
  node scripts/advanced/apply-vscode-profile-files.mjs --scan
  node scripts/advanced/apply-vscode-profile-files.mjs --init-map
  node scripts/advanced/apply-vscode-profile-files.mjs all --dry-run
  node scripts/advanced/apply-vscode-profile-files.mjs all --create-missing-profiles
  node scripts/advanced/apply-vscode-profile-files.mjs frontend --create-missing-profiles
  node scripts/advanced/apply-vscode-profile-files.mjs ai-python --sync-extensions --dry-run
  node scripts/advanced/apply-vscode-profile-files.mjs ai-python --sync-extensions
  node scripts/advanced/apply-vscode-profile-files.mjs all --no-extensions
`);
}

function parseArgs(argv) {
  const args = {
    profile: "all",
    repoRoot: DEFAULT_REPO_ROOT,
    vscodeUserDir: null,
    app: "code",
    dryRun: false,
    noExtensions: false,
    scan: false,
    initMap: false,
    createMissingProfiles: false,
    syncExtensions: false,
    pruneReviewNeeded: false,
  };

  const rest = [...argv];

  while (rest.length > 0) {
    const arg = rest.shift();

    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--no-extensions") {
      args.noExtensions = true;
    } else if (arg === "--scan") {
      args.scan = true;
    } else if (arg === "--init-map") {
      args.initMap = true;
    } else if (arg === "--create-missing-profiles") {
      args.createMissingProfiles = true;
    } else if (arg === "--sync-extensions") {
      args.syncExtensions = true;
    } else if (arg === "--prune-review-needed") {
      args.pruneReviewNeeded = true;
    } else if (arg === "--repo-root") {
      const value = rest.shift();
      if (!value) fail("--repo-root requires a value.");
      args.repoRoot = path.resolve(value);
    } else if (arg === "--vscode-user-dir") {
      const value = rest.shift();
      if (!value) fail("--vscode-user-dir requires a value.");
      args.vscodeUserDir = path.resolve(value);
    } else if (arg === "--app") {
      const value = rest.shift();
      if (!value) fail("--app requires a value.");
      if (!["code", "insiders", "codium"].includes(value)) {
        fail("--app must be one of: code, insiders, codium");
      }
      args.app = value;
    } else if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    } else if (arg.startsWith("-")) {
      fail(`Unknown option: ${arg}`);
    } else {
      args.profile = arg;
    }
  }

  return args;
}

function detectVSCodeUserDir(app) {
  const platform = os.platform();
  const home = os.homedir();

  if (platform === "darwin") {
    const appDirName =
      app === "insiders" ? "Code - Insiders" : app === "codium" ? "VSCodium" : "Code";

    return path.join(home, "Library", "Application Support", appDirName, "User");
  }

  if (platform === "win32") {
    const appData = process.env.APPDATA;
    if (!appData) {
      fail("%APPDATA% is not set.");
    }

    const appDirName =
      app === "insiders" ? "Code - Insiders" : app === "codium" ? "VSCodium" : "Code";

    return path.join(appData, appDirName, "User");
  }

  if (platform === "linux") {
    if (app === "insiders") {
      return path.join(home, ".config", "Code - Insiders", "User");
    }

    if (app === "codium") {
      return path.join(home, ".config", "VSCodium", "User");
    }

    return path.join(home, ".config", "Code", "User");
  }

  fail(`Unsupported platform: ${platform}`);
}

function getCodeCommand(app) {
  if (app === "insiders") return "code-insiders";
  if (app === "codium") return "codium";
  return "code";
}

function ensureCodeCli(app) {
  const command = getCodeCommand(app);
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
    shell: false,
  });

  if (result.error || result.status !== 0) {
    fail(
      `'${command}' command not found. ` +
        "VS Code에서 Cmd+Shift+P → Shell Command: Install 'code' command in PATH를 실행하세요.",
    );
  }

  return command;
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    if (raw.trim() === "") return fallback;
    return JSON.parse(raw);
  } catch (error) {
    fail(`Invalid JSON: ${filePath}\n${error.message}`);
  }
}

function writeJson(filePath, data, dryRun) {
  const text = `${JSON.stringify(data, null, 2)}\n`;

  if (dryRun) {
    log(`[dry-run] write JSON: ${filePath}`);
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base, override) {
  if (isPlainObject(base) && isPlainObject(override)) {
    const result = { ...base };

    for (const [key, value] of Object.entries(override)) {
      if (Object.hasOwn(result, key)) {
        result[key] = deepMerge(result[key], value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  // 배열과 scalar는 profile 값이 common 값을 덮어쓴다.
  return override;
}

function mergeSettings(commonPath, profilePath) {
  const common = readJson(commonPath, {});
  const profile = readJson(profilePath, {});

  if (!isPlainObject(common)) fail(`Expected object JSON: ${commonPath}`);
  if (!isPlainObject(profile)) fail(`Expected object JSON: ${profilePath}`);

  return deepMerge(common, profile);
}

function mergeKeybindings(commonPath, profilePath) {
  const common = readJson(commonPath, []);
  const profile = readJson(profilePath, []);

  if (!Array.isArray(common)) fail(`Expected array JSON: ${commonPath}`);
  if (!Array.isArray(profile)) fail(`Expected array JSON: ${profilePath}`);

  return [...common, ...profile];
}

function mergeTasks(commonPath, profilePath) {
  const common = readJson(commonPath, {});
  const profile = readJson(profilePath, {});

  if (!isPlainObject(common)) fail(`Expected object JSON: ${commonPath}`);
  if (!isPlainObject(profile)) fail(`Expected object JSON: ${profilePath}`);

  const result = {};
  result.version = profile.version || common.version || "2.0.0";

  const tasks = [];

  if (Array.isArray(common.tasks)) {
    tasks.push(...common.tasks);
  }

  if (Array.isArray(profile.tasks)) {
    tasks.push(...profile.tasks);
  }

  result.tasks = tasks;

  const inputs = [];

  if (Array.isArray(common.inputs)) {
    inputs.push(...common.inputs);
  }

  if (Array.isArray(profile.inputs)) {
    inputs.push(...profile.inputs);
  }

  if (inputs.length > 0) {
    result.inputs = inputs;
  }

  for (const source of [common, profile]) {
    for (const [key, value] of Object.entries(source)) {
      if (!["version", "tasks", "inputs"].includes(key)) {
        result[key] = value;
      }
    }
  }

  return result;
}

function mergeMcp(commonPath, profilePath) {
  const common = readJson(commonPath, {});
  const profile = readJson(profilePath, {});

  if (!isPlainObject(common)) fail(`Expected object JSON: ${commonPath}`);
  if (!isPlainObject(profile)) fail(`Expected object JSON: ${profilePath}`);

  return deepMerge(common, profile);
}

function createTimestamp() {
  const now = new Date();

  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function backupPath(_repoRoot, slug, relativeName) {
  return path.join(
    devEnvStateRoot(),
    "backups",
    "vscode-profiles",
    RUN_TIMESTAMP,
    slug,
    relativeName,
  );
}

function backupFile(repoRoot, slug, target, relativeName, dryRun) {
  if (!fs.existsSync(target)) {
    return;
  }

  const dst = backupPath(repoRoot, slug, relativeName);

  if (dryRun) {
    log(`[dry-run] backup file: ${target} -> ${dst}`);
    return;
  }

  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(target, dst);
}

function copyDirRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function backupDir(repoRoot, slug, target, relativeName, dryRun) {
  if (!fs.existsSync(target)) {
    return;
  }

  const dst = backupPath(repoRoot, slug, relativeName);

  if (dryRun) {
    log(`[dry-run] backup dir: ${target} -> ${dst}`);
    return;
  }

  copyDirRecursive(target, dst);
}

function copySnippets(repoRoot, vscodeDir, slug, targetProfileDir, dryRun) {
  const commonSnippets = path.join(vscodeDir, "common", "snippets");
  const profileSnippets = path.join(vscodeDir, slug, "snippets");
  const targetSnippets = path.join(targetProfileDir, "snippets");

  backupDir(repoRoot, slug, targetSnippets, "snippets", dryRun);

  if (dryRun) {
    log(`[dry-run] ensure dir: ${targetSnippets}`);
  } else {
    fs.mkdirSync(targetSnippets, { recursive: true });
  }

  const sourceDirs = [
    ["common", commonSnippets],
    [slug, profileSnippets],
  ];

  for (const [label, sourceDir] of sourceDirs) {
    if (!fs.existsSync(sourceDir)) {
      continue;
    }

    const files = fs
      .readdirSync(sourceDir)
      .filter((name) => name.endsWith(".json"))
      .sort();

    for (const fileName of files) {
      const source = path.join(sourceDir, fileName);
      const target = path.join(targetSnippets, fileName);

      log(`Copy snippet [${label}]: ${source} -> ${target}`);

      if (!dryRun) {
        fs.copyFileSync(source, target);
      }
    }
  }
}

function readExtensions(filePath) {
  const data = readJson(filePath, {
    recommendations: [],
    reviewNeeded: [],
    keepInstalled: [],
  });

  if (!isPlainObject(data)) {
    fail(`Expected object JSON: ${filePath}`);
  }

  const recommendations = data.recommendations ?? [];
  const reviewNeeded = data.reviewNeeded ?? [];
  const keepInstalled = data.keepInstalled ?? [];

  if (!Array.isArray(recommendations)) {
    fail(`Expected recommendations array: ${filePath}`);
  }

  if (!Array.isArray(reviewNeeded)) {
    fail(`Expected reviewNeeded array: ${filePath}`);
  }

  if (!Array.isArray(keepInstalled)) {
    fail(`Expected keepInstalled array: ${filePath}`);
  }

  return {
    recommendations,
    reviewNeeded,
    keepInstalled,
  };
}

function runCodeInstall(codeCommand, profileName, extensionId, dryRun) {
  const args = ["--install-extension", extensionId, "--profile", profileName, "--force"];

  if (dryRun) {
    log(`[dry-run] ${codeCommand} ${args.join(" ")}`);
    return true;
  }

  const result = spawnSync(codeCommand, args, {
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    warn(
      `Failed to run '${codeCommand}' for extension '${extensionId}'. ` +
        `VS Code CLI가 PATH에 있는지 확인하세요.\n${result.error.message}`,
    );
    return false;
  }

  if (result.status !== 0) {
    warn(
      `Failed to install extension '${extensionId}' for profile '${profileName}'. ` +
        `Exit code: ${result.status}`,
    );
    return false;
  }

  return true;
}
function listInstalledExtensions(codeCommand, profileName, dryRun) {
  const args = ["--list-extensions", "--profile", profileName];

  if (dryRun) {
    log(`[dry-run] reading installed extensions: ${codeCommand} ${args.join(" ")}`);
  }

  const result = spawnSync(codeCommand, args, {
    encoding: "utf8",
    shell: false,
  });

  if (result.error) {
    warn(`Failed to list extensions for profile '${profileName}'. ` + `${result.error.message}`);
    return [];
  }

  if (result.status !== 0) {
    warn(
      `Failed to list extensions for profile '${profileName}'. ` + `Exit code: ${result.status}`,
    );
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function runCodeUninstall(codeCommand, profileName, extensionId, dryRun) {
  const args = ["--uninstall-extension", extensionId, "--profile", profileName];

  if (dryRun) {
    log(`[dry-run] ${codeCommand} ${args.join(" ")}`);
    return true;
  }

  const result = spawnSync(codeCommand, args, {
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    warn(
      `Failed to run '${codeCommand}' for uninstall '${extensionId}'. ` + `${result.error.message}`,
    );
    return false;
  }

  if (result.status !== 0) {
    warn(
      `Failed to uninstall extension '${extensionId}' from profile '${profileName}'. ` +
        `Exit code: ${result.status}`,
    );
    return false;
  }

  return true;
}

function collectExtensionPolicy(vscodeDir, slug) {
  const files = [
    ["common", path.join(vscodeDir, "common", "extensions.json")],
    [slug, path.join(vscodeDir, slug, "extensions.json")],
  ];

  const recommendations = new Set();
  const reviewNeeded = new Set();
  const keepInstalled = new Set();
  const reviewLabels = [];

  for (const [label, filePath] of files) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const data = readExtensions(filePath);

    for (const extensionId of data.recommendations) {
      recommendations.add(extensionId);
    }

    for (const extensionId of data.reviewNeeded) {
      reviewNeeded.add(extensionId);
      reviewLabels.push(`${label}: ${extensionId}`);
    }

    for (const extensionId of data.keepInstalled) {
      keepInstalled.add(extensionId);
    }
  }

  return {
    recommendations,
    reviewNeeded,
    keepInstalled,
    reviewLabels,
  };
}

function installExtensions({ vscodeDir, slug, profileName, codeCommand, dryRun }) {
  const policy = collectExtensionPolicy(vscodeDir, slug);
  const failed = [];

  for (const extensionId of policy.recommendations) {
    log(`Install extension [${profileName}]: ${extensionId}`);
    const ok = runCodeInstall(codeCommand, profileName, extensionId, dryRun);

    if (!ok) {
      failed.push(extensionId);
    }
  }

  if (policy.reviewLabels.length > 0) {
    log("");
    log(`Review needed extensions for ${profileName}:`);
    for (const item of policy.reviewLabels) {
      log(`  ? ${item}`);
    }
  }

  if (failed.length > 0) {
    log("");
    warn(`Failed extensions for ${profileName}:`);
    for (const extensionId of failed) {
      log(`  ! ${extensionId}`);
    }
  }
}

function syncExtensions({ vscodeDir, slug, profileName, codeCommand, dryRun, pruneReviewNeeded }) {
  const policy = collectExtensionPolicy(vscodeDir, slug);

  const desired = new Set(policy.recommendations);
  const protectedExtensions = new Set(policy.keepInstalled);

  // reviewNeeded는 기본적으로 "검토만 필요하지만 지우지는 않는" 확장으로 취급한다.
  // --prune-review-needed를 붙이면 reviewNeeded도 제거 후보가 될 수 있다.
  if (!pruneReviewNeeded) {
    for (const extensionId of policy.reviewNeeded) {
      protectedExtensions.add(extensionId);
    }
  }

  const installed = listInstalledExtensions(codeCommand, profileName, dryRun);

  const toRemove = installed.filter((extensionId) => {
    if (desired.has(extensionId)) return false;
    if (protectedExtensions.has(extensionId)) return false;
    return true;
  });

  if (policy.reviewLabels.length > 0) {
    log("");
    log(`Review needed extensions for ${profileName}:`);
    for (const item of policy.reviewLabels) {
      log(`  ? ${item}`);
    }
  }

  if (policy.keepInstalled.size > 0) {
    log("");
    log(`Keep installed extensions for ${profileName}:`);
    for (const extensionId of policy.keepInstalled) {
      log(`  = ${extensionId}`);
    }
  }

  if (toRemove.length > 0) {
    log("");
    warn(`Extensions to remove from ${profileName}:`);
    for (const extensionId of toRemove) {
      log(`  - ${extensionId}`);
    }
  } else {
    log("");
    log(`No extensions to remove from ${profileName}.`);
  }

  const uninstallFailed = [];

  for (const extensionId of toRemove) {
    const ok = runCodeUninstall(codeCommand, profileName, extensionId, dryRun);

    if (!ok) {
      uninstallFailed.push(extensionId);
    }
  }

  if (uninstallFailed.length > 0) {
    log("");
    warn(`Failed to uninstall extensions for ${profileName}:`);
    for (const extensionId of uninstallFailed) {
      log(`  ! ${extensionId}`);
    }
  }

  installExtensions({
    vscodeDir,
    slug,
    profileName,
    codeCommand,
    dryRun,
  });
}

function loadProfileMap(vscodeDir) {
  const filePath = path.join(vscodeDir, "profile-map.json");

  if (!fs.existsSync(filePath)) {
    fail(
      "Missing vscode/profile-map.json. 먼저 --init-map으로 템플릿을 만들거나, --create-missing-profiles와 함께 --init-map을 먼저 실행하세요.",
    );
  }

  const data = readJson(filePath, {});

  if (!isPlainObject(data)) {
    fail("vscode/profile-map.json must be an object.");
  }

  return data;
}

function saveProfileMap(vscodeDir, profileMap, dryRun) {
  const filePath = path.join(vscodeDir, "profile-map.json");

  if (dryRun) {
    log(`[dry-run] update profile-map.json: ${filePath}`);
    return;
  }

  writeJson(filePath, profileMap, false);
}

function getProfileMapEntry(profileMap, slug) {
  const existing = profileMap[slug];

  if (!isPlainObject(existing)) {
    profileMap[slug] = {
      name: DEFAULT_PROFILE_NAMES[slug],
      id: "TODO",
    };

    return profileMap[slug];
  }

  if (!existing.name) {
    existing.name = DEFAULT_PROFILE_NAMES[slug];
  }

  if (!existing.id) {
    existing.id = "TODO";
  }

  return existing;
}

function listInternalProfileIds(vscodeUserDir) {
  const profilesDir = path.join(vscodeUserDir, "profiles");

  if (!fs.existsSync(profilesDir)) {
    return new Set();
  }

  const ids = fs
    .readdirSync(profilesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== "builtin");

  return new Set(ids);
}

function sanitizeFileName(value) {
  return value.replace(/[<>:"/\\|?*]+/g, "_");
}

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // VS Code가 profile 폴더를 생성할 시간을 주기 위한 짧은 busy wait.
  }
}

function ensureProfileCreated({ profileName, vscodeUserDir, codeCommand, dryRun }) {
  const before = listInternalProfileIds(vscodeUserDir);

  const scratchDir = path.join(
    devEnvStateRoot(),
    "cache",
    "vscode-profile-bootstrap",
    sanitizeFileName(profileName),
  );

  if (dryRun) {
    log(`[dry-run] create profile if missing: ${profileName}`);
    log(`[dry-run] ${codeCommand} "${scratchDir}" --profile "${profileName}" --new-window`);
    return null;
  }

  fs.mkdirSync(scratchDir, { recursive: true });

  const result = spawnSync(codeCommand, [scratchDir, "--profile", profileName, "--new-window"], {
    stdio: "ignore",
    shell: false,
  });

  if (result.error) {
    fail(
      `Failed to run '${codeCommand}'. VS Code CLI가 PATH에 있는지 확인하세요.\n${result.error.message}`,
    );
  }

  sleepSync(1800);

  const after = listInternalProfileIds(vscodeUserDir);
  const created = [...after].filter((id) => !before.has(id));

  if (created.length === 1) {
    return created[0];
  }

  if (created.length > 1) {
    fail(
      `More than one profile folder was created while creating "${profileName}": ${created.join(
        ", ",
      )}`,
    );
  }

  return null;
}

function resolveProfileId({
  profileMap,
  vscodeDir,
  slug,
  vscodeUserDir,
  codeCommand,
  dryRun,
  createMissingProfiles,
}) {
  const entry = getProfileMapEntry(profileMap, slug);
  const profileName = entry.name || DEFAULT_PROFILE_NAMES[slug];

  let profileId = entry.id;

  if (typeof profileId === "string" && profileId.length > 0 && profileId !== "TODO") {
    return {
      profileName,
      profileId,
    };
  }

  if (!createMissingProfiles) {
    fail(
      `Profile id missing for "${slug}" (${profileName}).\n` +
        `vscode/profile-map.json에 id를 채우거나, --create-missing-profiles 옵션을 사용하세요.`,
    );
  }

  log("");
  log(`Profile id missing for "${slug}" (${profileName}).`);
  log("Trying to create VS Code profile automatically...");

  const createdId = ensureProfileCreated({
    profileName,
    vscodeUserDir,
    codeCommand,
    dryRun,
  });

  if (createdId) {
    profileId = createdId;
    entry.id = createdId;

    log(`Created profile "${profileName}" with internal id: ${createdId}`);
    saveProfileMap(vscodeDir, profileMap, dryRun);

    return {
      profileName,
      profileId,
    };
  }

  if (dryRun) {
    return {
      profileName,
      profileId: "DRY_RUN_PROFILE_ID",
    };
  }

  fail(
    `Could not detect newly created profile id for "${profileName}".\n` +
      `가능한 원인:\n` +
      `1. 이미 VS Code 안에 "${profileName}" 프로필이 존재해서 새 폴더가 생성되지 않았습니다.\n` +
      `2. VS Code가 profile 폴더 생성을 아직 flush하지 않았습니다.\n\n` +
      `해결 방법:\n` +
      `- VS Code에서 "${profileName}" 프로필로 전환한 뒤 Preferences: Open User Settings (JSON)의 경로를 확인하세요.\n` +
      `- 그 경로의 profiles/<id>/settings.json 중 <id>를 vscode/profile-map.json에 직접 입력하세요.\n`,
  );
}

function applyProfile({
  repoRoot,
  vscodeDir,
  vscodeUserDir,
  profileMap,
  slug,
  dryRun,
  installExt,
  codeCommand,
  createMissingProfiles,
  syncExtensionsMode,
  pruneReviewNeeded,
}) {
  const { profileName, profileId } = resolveProfileId({
    profileMap,
    vscodeDir,
    slug,
    vscodeUserDir,
    codeCommand,
    dryRun,
    createMissingProfiles,
  });

  const sourceProfileDir = path.join(vscodeDir, slug);
  const targetProfileDir = path.join(vscodeUserDir, "profiles", profileId);

  if (!fs.existsSync(sourceProfileDir)) {
    fail(`Source profile folder not found: ${sourceProfileDir}`);
  }

  if (!fs.existsSync(targetProfileDir) && !dryRun) {
    fail(
      `Target VS Code profile folder not found: ${targetProfileDir}\n` +
        `VS Code에서 '${profileName}' 프로필이 존재하는지 확인하세요.`,
    );
  }

  log("");
  log("=".repeat(72));
  log(`Apply profile: ${profileName}`);
  log(`Slug:          ${slug}`);
  log(`Target ID:     ${profileId}`);
  log(`Target dir:    ${targetProfileDir}`);
  log("=".repeat(72));

  const commonDir = path.join(vscodeDir, "common");

  for (const fileName of PROFILE_FILES) {
    const commonPath = path.join(commonDir, fileName);
    const profilePath = path.join(sourceProfileDir, fileName);
    const targetPath = path.join(targetProfileDir, fileName);

    let merged;

    if (fileName === "settings.json") {
      merged = mergeSettings(commonPath, profilePath);
    } else if (fileName === "keybindings.json") {
      merged = mergeKeybindings(commonPath, profilePath);
    } else if (fileName === "tasks.json") {
      merged = mergeTasks(commonPath, profilePath);
    } else if (fileName === "mcp.json") {
      merged = mergeMcp(commonPath, profilePath);
    } else {
      continue;
    }

    backupFile(repoRoot, slug, targetPath, fileName, dryRun);
    writeJson(targetPath, merged, dryRun);
  }

  copySnippets(repoRoot, vscodeDir, slug, targetProfileDir, dryRun);

  if (installExt) {
    if (syncExtensionsMode) {
      syncExtensions({
        vscodeDir,
        slug,
        profileName,
        codeCommand,
        dryRun,
        pruneReviewNeeded,
      });
    } else {
      installExtensions({
        vscodeDir,
        slug,
        profileName,
        codeCommand,
        dryRun,
      });
    }
  }
}

function scanProfiles(vscodeUserDir) {
  const profilesDir = path.join(vscodeUserDir, "profiles");

  log(`VS Code User dir: ${vscodeUserDir}`);
  log(`Profiles dir:     ${profilesDir}`);
  log("");

  if (!fs.existsSync(profilesDir)) {
    fail(`Profiles directory not found: ${profilesDir}`);
  }

  const entries = fs
    .readdirSync(profilesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const name of entries) {
    const profileDir = path.join(profilesDir, name);
    log(`- ${name}`);

    for (const fileName of [
      "settings.json",
      "keybindings.json",
      "tasks.json",
      "mcp.json",
      "extensions.json",
    ]) {
      if (fs.existsSync(path.join(profileDir, fileName))) {
        log(`  has ${fileName}`);
      }
    }

    const snippetsDir = path.join(profileDir, "snippets");
    if (fs.existsSync(snippetsDir)) {
      const count = fs
        .readdirSync(snippetsDir)
        .filter((fileName) => fileName.endsWith(".json")).length;

      log(`  has snippets/ (${count} files)`);
    }
  }
}

function createMapTemplate(vscodeDir, vscodeUserDir, dryRun) {
  const profilesDir = path.join(vscodeUserDir, "profiles");

  let detectedProfileIds = [];

  if (fs.existsSync(profilesDir)) {
    detectedProfileIds = fs
      .readdirSync(profilesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => name !== "builtin")
      .sort();
  }

  const data = {
    _instructions: [
      "각 프로필의 id를 TODO에서 실제 VS Code 내부 profile ID로 바꾸세요.",
      "id가 TODO인 상태에서 --create-missing-profiles 옵션을 사용하면 스크립트가 새 프로필 생성을 시도하고 id를 자동 기록합니다.",
      "단, 이미 같은 이름의 프로필이 VS Code에 존재하면 새 폴더가 생성되지 않아 자동 감지가 실패할 수 있습니다.",
      "이 경우 VS Code에서 해당 프로필로 전환한 뒤 Preferences: Open User Settings (JSON)의 경로에서 profiles/<id>/settings.json의 <id>를 확인해 직접 입력하세요.",
      "아래 _detectedProfileIds는 현재 발견된 내부 폴더 목록입니다.",
    ],
    _detectedProfileIds: detectedProfileIds,
  };

  for (const slug of PROFILE_ORDER) {
    data[slug] = {
      name: DEFAULT_PROFILE_NAMES[slug],
      id: "TODO",
    };
  }

  const target = path.join(vscodeDir, "profile-map.json");

  if (fs.existsSync(target)) {
    fail(`Refusing to overwrite existing file: ${target}`);
  }

  writeJson(target, data, dryRun);
  log(`Created template: ${target}`);
}

function validateTargetProfiles(profile) {
  if (profile === "all") {
    return PROFILE_ORDER;
  }

  if (!PROFILE_ORDER.includes(profile)) {
    fail(`Unknown profile: ${profile}`);
  }

  return [profile];
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const repoRoot = path.resolve(args.repoRoot);
  const vscodeDir = path.join(repoRoot, "vscode");
  const vscodeUserDir = args.vscodeUserDir
    ? path.resolve(args.vscodeUserDir)
    : detectVSCodeUserDir(args.app);

  if (!fs.existsSync(vscodeDir)) {
    fail(`Repo vscode directory not found: ${vscodeDir}`);
  }

  const codeCommand = ensureCodeCli(args.app);

  if (args.scan) {
    scanProfiles(vscodeUserDir);
    return;
  }

  if (args.initMap) {
    createMapTemplate(vscodeDir, vscodeUserDir, args.dryRun);
    return;
  }

  const targets = validateTargetProfiles(args.profile);
  const profileMap = loadProfileMap(vscodeDir);

  if (args.pruneReviewNeeded && !args.syncExtensions) {
    warn("--prune-review-needed has no effect without --sync-extensions.");
  }

  log("IMPORTANT: VS Code를 완전히 종료한 상태에서 실행하는 것을 권장합니다.");
  log(`Repo root:                 ${repoRoot}`);
  log(`VS Code User dir:          ${vscodeUserDir}`);
  log(`VS Code CLI:               ${codeCommand}`);
  log(`Dry run:                   ${args.dryRun}`);
  log(`Install extensions:        ${!args.noExtensions}`);
  log(`Sync extensions:           ${args.syncExtensions}`);
  log(`Prune reviewNeeded:        ${args.pruneReviewNeeded}`);
  log(`Create missing profiles:   ${args.createMissingProfiles}`);

  for (const slug of targets) {
    applyProfile({
      repoRoot,
      vscodeDir,
      vscodeUserDir,
      profileMap,
      slug,
      dryRun: args.dryRun,
      installExt: !args.noExtensions,
      codeCommand,
      createMissingProfiles: args.createMissingProfiles,
      syncExtensionsMode: args.syncExtensions,
      pruneReviewNeeded: args.pruneReviewNeeded,
    });
  }

  log("");
  log("Done.");
  log(
    "VS Code를 다시 실행해서 프로필별 settings/snippets/tasks/mcp/keybindings가 적용됐는지 확인하세요.",
  );
}

main();

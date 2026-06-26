#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const templatesRoot = path.join(repoRoot, "workspace-templates");

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".md",
  ".mjs",
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
  ".tf",
]);

function parseArgs(argv) {
  const args = {
    runtime: "pnpm",
    dryRun: false,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (token === "--force") {
      args.force = true;
      continue;
    }

    if (token === "--no-harness") {
      args.harness = false;
      continue;
    }

    if (token === "--list") {
      args.list = true;
      continue;
    }

    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${token}`);
    }

    args[key] = value;
    index += 1;
  }

  return args;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON: ${path.relative(repoRoot, filePath)}\n${error.message}`);
  }
}

function listDirectories(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function printList() {
  console.log("Presets:");
  for (const preset of fs.readdirSync(path.join(templatesRoot, "presets")).sort()) {
    if (preset.endsWith(".json")) {
      const data = readJson(path.join(templatesRoot, "presets", preset));
      console.log(`  ${data.name}: ${data.description}`);
    }
  }

  console.log("\nPacks:");
  for (const packName of ["common", ...listDirectories(path.join(templatesRoot, "packs"))]) {
    const pack = loadPack(packName);
    console.log(`  ${pack.name}: ${pack.description}`);
  }

  console.log("\nBundles:");
  for (const bundleName of listDirectories(path.join(templatesRoot, "bundles"))) {
    const bundle = loadBundle(bundleName);
    console.log(`  ${bundle.name}: ${bundle.description}`);
  }

  console.log("\nRuntimes:");
  for (const runtimeName of listDirectories(path.join(templatesRoot, "runtimes"))) {
    const runtime = loadRuntime(runtimeName);
    console.log(`  ${runtime.name}: ${runtime.description}`);
  }
}

function loadPreset(name) {
  const filePath = path.join(templatesRoot, "presets", `${name}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Unknown preset: ${name}`);
  }

  return readJson(filePath);
}

function packDirectory(name) {
  if (name === "common") {
    return path.join(templatesRoot, "common");
  }

  return path.join(templatesRoot, "packs", name);
}

function loadPack(name) {
  const directory = packDirectory(name);
  const manifestPath = path.join(directory, "pack.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Unknown pack: ${name}`);
  }

  return {
    ...readJson(manifestPath),
    id: name,
    directory,
    templateRoot: fs.existsSync(path.join(directory, "template"))
      ? path.join(directory, "template")
      : directory,
  };
}

function loadRuntime(name) {
  const directory = path.join(templatesRoot, "runtimes", name);
  const manifestPath = path.join(directory, "pack.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Unknown runtime: ${name}`);
  }

  return {
    ...readJson(manifestPath),
    id: `runtime:${name}`,
    directory,
    templateRoot: path.join(directory, "template"),
  };
}

function loadBundle(name) {
  const directory = path.join(templatesRoot, "bundles", name);
  const manifestPath = path.join(directory, "bundle.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Unknown bundle: ${name}`);
  }

  return {
    ...readJson(manifestPath),
    id: `bundle:${name}`,
    directory,
    templateRoot: path.join(directory, "template"),
  };
}

function resolvePacks(initialPackNames) {
  const resolved = [];
  const seen = new Set();

  function visit(name) {
    if (seen.has(name)) {
      return;
    }

    const pack = loadPack(name);
    for (const dependency of pack.dependsOn ?? []) {
      visit(dependency);
    }

    seen.add(name);
    resolved.push(pack);
  }

  for (const name of initialPackNames) {
    if (name === "common") {
      visit("common");
    } else {
      visit(name);
    }
  }

  if (!seen.has("common")) {
    resolved.unshift(loadPack("common"));
  }

  return resolved;
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(absolute));
      continue;
    }

    if (entry.isFile()) {
      files.push(absolute);
    }
  }

  return files.sort();
}

function targetRelativePath(pack, sourceFile) {
  const relative = path.relative(pack.templateRoot, sourceFile).split(path.sep).join("/");

  if (pack.id === "common") {
    if (
      relative === "pack.json" ||
      relative === "PACK.md" ||
      relative.startsWith("docs/chagelog/") ||
      relative.startsWith("docs/fix-log/") ||
      relative.startsWith("docs/roadmaps/") ||
      relative.startsWith("docs/todo/") ||
      relative.startsWith("docs/work-log/")
    ) {
      return null;
    }

    if (relative === "README.workspace.md") {
      return "README.md";
    }

    if (relative.startsWith("docs/adr/")) {
      return `docs/ADR/${relative.slice("docs/adr/".length)}`;
    }
  }

  if (relative.startsWith("template/")) {
    return relative.slice("template/".length);
  }

  return relative;
}

function isTextFile(filePath) {
  return textExtensions.has(path.extname(filePath)) || path.basename(filePath).startsWith(".");
}

function applyPlaceholders(content, context) {
  return content
    .replaceAll("{{projectName}}", context.projectName)
    .replaceAll("{{runtime}}", context.runtime)
    .replaceAll("{{packs}}", context.packs.join(", "))
    .replaceAll("{{bundles}}", context.bundles.join(", "))
    .replaceAll("{{harness}}", context.harness)
    .replaceAll("{{runtimeInstallCommand}}", context.runtimeInstallCommand)
    .replaceAll("{{runtimeDevCommand}}", context.runtimeDevCommand)
    .replaceAll("{{runtimeCommandPrefix}}", context.runtimeCommandPrefix);
}

function readTemplateFile(filePath, context) {
  const buffer = fs.readFileSync(filePath);
  if (!isTextFile(filePath)) {
    return buffer;
  }

  return applyPlaceholders(buffer.toString("utf8"), context);
}

function mergeArrays(left, right) {
  const result = [...left];
  const seen = new Set(left.map((item) => JSON.stringify(item)));

  for (const item of right) {
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

function deepMerge(left, right) {
  if (Array.isArray(left) && Array.isArray(right)) {
    return mergeArrays(left, right);
  }

  if (
    left &&
    right &&
    typeof left === "object" &&
    typeof right === "object" &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const output = { ...left };
    for (const [key, value] of Object.entries(right)) {
      output[key] = key in output ? deepMerge(output[key], value) : value;
    }
    return output;
  }

  return right;
}

function mergeJson(existing, incoming) {
  return `${JSON.stringify(deepMerge(JSON.parse(existing), JSON.parse(incoming)), null, 2)}\n`;
}

function mergeTasks(existing, incoming) {
  const left = JSON.parse(existing);
  const right = JSON.parse(incoming);
  const tasksByLabel = new Map();

  for (const task of left.tasks ?? []) {
    if (task.label) {
      tasksByLabel.set(task.label, task);
    }
  }

  for (const task of right.tasks ?? []) {
    if (!task.label || !tasksByLabel.has(task.label)) {
      if (task.label) {
        tasksByLabel.set(task.label, task);
      }
    }
  }

  return `${JSON.stringify(
    {
      ...deepMerge(left, right),
      tasks: [...tasksByLabel.values()],
    },
    null,
    2,
  )}\n`;
}

function appendUnique(existing, incoming) {
  const lines = existing.split(/\r?\n/);
  const seen = new Set(lines);

  for (const line of incoming.split(/\r?\n/)) {
    if (!seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function mergeContent(rule, existing, incoming) {
  if (Buffer.isBuffer(existing) || Buffer.isBuffer(incoming)) {
    throw new Error("Cannot merge binary content");
  }

  if (rule === "deep") {
    return mergeJson(existing, incoming);
  }

  if (rule === "appendTasks") {
    return mergeTasks(existing, incoming);
  }

  if (rule === "appendUnique") {
    return appendUnique(existing, incoming);
  }

  if (rule === "replace") {
    return incoming;
  }

  throw new Error(`Unknown merge rule: ${rule}`);
}

function collectFiles(packs, context) {
  const planned = new Map();
  const operations = [];

  for (const pack of packs) {
    for (const sourceFile of walkFiles(pack.templateRoot)) {
      const target = targetRelativePath(pack, sourceFile);
      if (!target) {
        continue;
      }

      const incoming = readTemplateFile(sourceFile, context);
      const existing = planned.get(target);
      const rule = pack.merge?.[target];

      if (!existing) {
        planned.set(target, { content: incoming, pack: pack.id });
        operations.push({ action: "add", target, pack: pack.id });
        continue;
      }

      if (rule) {
        const merged = mergeContent(rule, existing.content, incoming);
        planned.set(target, { content: merged, pack: `${existing.pack},${pack.id}` });
        operations.push({ action: "merge", target, pack: pack.id, rule });
        continue;
      }

      const same =
        Buffer.isBuffer(existing.content) || Buffer.isBuffer(incoming)
          ? Buffer.compare(Buffer.from(existing.content), Buffer.from(incoming)) === 0
          : existing.content === incoming;

      if (!same) {
        throw new Error(
          `Template conflict for ${target}: ${existing.pack} already provided content, ${pack.id} cannot overwrite it`,
        );
      }
    }
  }

  return { planned, operations };
}

function setScript(scripts, name, command) {
  scripts[name] = command;
}

function finalizePackageJson(planned, context) {
  const file = planned.get("package.json");
  if (!file || Buffer.isBuffer(file.content)) {
    return;
  }

  const packageJson = JSON.parse(file.content);
  const scripts = packageJson.scripts ?? {};
  const has = (packName) => context.packs.includes(packName);
  const run = context.runtimeCommandPrefix;

  if (has("frontend")) {
    setScript(scripts, "frontend:dev", "vite");
    setScript(scripts, "frontend:build", "vite build");
    setScript(scripts, "frontend:test", "vitest run");
    setScript(scripts, "frontend:e2e", "playwright test");
    setScript(scripts, "frontend:storybook", "storybook dev -p 6006");
    setScript(scripts, "frontend:storybook:build", "storybook build");
  }

  if (has("backend")) {
    setScript(scripts, "backend:dev", "nest start --watch");
    setScript(scripts, "backend:build", "nest build");
    setScript(scripts, "backend:test", "vitest run");
    setScript(scripts, "backend:start", "node dist/main.js");
  }

  if (has("computer-graphics")) {
    setScript(scripts, "graphics:check", "cargo check");
    setScript(scripts, "graphics:build", "cargo build");
    setScript(scripts, "graphics:test", "cargo test");
    setScript(scripts, "graphics:shaders", "bash scripts/compile-shaders.sh");
  }

  if (has("3d-graphics")) {
    setScript(scripts, "3d:assets", "node scripts/check-assets.mjs");
    setScript(scripts, "3d:visual", "playwright test --project=chromium");
  }

  if (has("ui-ux")) {
    setScript(scripts, "ui:tokens", "node scripts/check-design-tokens.mjs");
    setScript(scripts, "ui:a11y", "echo \"Add axe or Playwright accessibility checks\"");
  }

  if (has("visual-design")) {
    setScript(scripts, "design:check", "node scripts/check-design-assets.mjs");
    setScript(scripts, "design:export", "echo \"Add design export automation\"");
  }

  if (has("tauri")) {
    setScript(scripts, "tauri:dev", "tauri dev");
    setScript(scripts, "tauri:build", "tauri build");
  }

  if (has("frontend") && has("backend")) {
    setScript(scripts, "dev", "echo \"Run frontend:dev and backend:dev in separate terminals\"");
    setScript(scripts, "build", `${run} frontend:build && ${run} backend:build`);
    setScript(scripts, "test", `${run} frontend:test && ${run} backend:test`);
  } else if (has("tauri")) {
    setScript(scripts, "dev", `${run} tauri:dev`);
    setScript(scripts, "build", `${run} tauri:build`);
  } else if (has("frontend")) {
    setScript(scripts, "dev", `${run} frontend:dev`);
    setScript(scripts, "build", `${run} frontend:build`);
    setScript(scripts, "test", `${run} frontend:test`);
  } else if (has("backend")) {
    setScript(scripts, "dev", `${run} backend:dev`);
    setScript(scripts, "build", `${run} backend:build`);
    setScript(scripts, "test", `${run} backend:test`);
  } else if (has("computer-graphics")) {
    setScript(scripts, "dev", "echo \"Run graphics:check, graphics:build, or graphics:shaders\"");
    setScript(scripts, "build", "cargo build");
    setScript(scripts, "typecheck", "cargo check");
    setScript(scripts, "test", "cargo test");
  }

  packageJson.scripts = scripts;
  planned.set("package.json", {
    ...file,
    content: `${JSON.stringify(packageJson, null, 2)}\n`,
  });
}

function formatList(items) {
  if (!items || items.length === 0) {
    return "- None.\n";
  }

  return items.map((item) => `- ${item}`).join("\n") + "\n";
}

function buildBoundariesDoc(packs, context) {
  const domainPacks = packs.filter(
    (pack) => pack.id !== "common" && pack.kind !== "runtime" && !pack.id.startsWith("bundle:"),
  );
  const sections = domainPacks.map((pack) => {
    const boundary = pack.boundary ?? {};
    return `## ${pack.name}

${pack.description}

### Owns

${formatList(boundary.owns)}
### Does Not Own

${formatList(boundary.doesNotOwn)}
### Handoffs

${formatList(boundary.handoffs)}
### Public Interfaces

${formatList(boundary.interfaces)}
`;
  });

  return `# Domain Boundaries

Generated for \`${context.projectName}\`.

Domain packs define ownership. Library bundles provide implementation choices inside those boundaries.

${sections.join("\n")}`;
}

function buildLibrariesDoc(bundles, context) {
  const sections = bundles.map((bundle) => {
    return `## ${bundle.name}

${bundle.description}

### Includes

${formatList(bundle.includes)}
### Default Scripts

${formatList(
  Object.entries(bundle.scripts ?? {}).map(([name, command]) => `\`${name}\`: \`${command}\``),
)}
`;
  });

  return `# Library Bundles

Generated for \`${context.projectName}\`.

Bundles are reusable library and tooling sets. Prefer selecting a bundle over hand-adding the same dependencies in every project.

${sections.length > 0 ? sections.join("\n") : "- No bundles selected.\n"}`;
}

function addGeneratedDocs(planned, packs, bundles, context) {
  planned.set("docs/BOUNDARIES.md", {
    content: buildBoundariesDoc(packs, context),
    pack: "generator",
  });
  planned.set("docs/LIBRARIES.md", {
    content: buildLibrariesDoc(bundles, context),
    pack: "generator",
  });
}

function writeWorkspace(planned, outputDir, options) {
  const conflicts = [];

  for (const [relative, file] of planned) {
    const target = path.join(outputDir, relative);
    if (fs.existsSync(target) && !options.force) {
      const existing = fs.readFileSync(target);
      const incoming = Buffer.isBuffer(file.content)
        ? Buffer.from(file.content)
        : Buffer.from(file.content, "utf8");
      if (Buffer.compare(existing, incoming) !== 0) {
        conflicts.push(relative);
      }
    }
  }

  if (conflicts.length > 0) {
    throw new Error(
      `Output conflicts. Re-run with --force only if you want to overwrite:\n${conflicts
        .map((file) => `  - ${file}`)
        .join("\n")}`,
    );
  }

  if (options.dryRun) {
    return;
  }

  fs.mkdirSync(outputDir, { recursive: true });

  for (const [relative, file] of planned) {
    const target = path.join(outputDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
    if (isExecutableTemplatePath(relative)) {
      fs.chmodSync(target, 0o755);
    }
  }
}

function isExecutableTemplatePath(relativePath) {
  return relativePath.endsWith(".sh") || relativePath.startsWith(".githooks/");
}

function normalizeProjectName(name) {
  if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new Error("--name must contain only letters, numbers, dots, underscores, and hyphens");
  }

  return name;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    printList();
    return;
  }

  const projectName = normalizeProjectName(args.name);
  const runtime = loadRuntime(args.runtime);

  let selectedPackNames = [];
  let selectedBundleNames = [];
  if (args.preset) {
    const preset = loadPreset(args.preset);
    selectedPackNames = preset.packs ?? [];
    selectedBundleNames = preset.bundles ?? [];
  }

  if (args.packs) {
    selectedPackNames.push(
      ...args.packs
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    );
  }

  if (args.bundles) {
    selectedBundleNames.push(
      ...args.bundles
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    );
  }

  if (selectedPackNames.length === 0) {
    throw new Error("Provide --preset <name> or --packs <comma,separated,packs>");
  }

  const resolvedPacks = resolvePacks(selectedPackNames);
  const commonPack = resolvedPacks.find((pack) => pack.id === "common");
  const domainPacks = resolvedPacks.filter((pack) => pack.id !== "common");
  const bundles = [...new Set(selectedBundleNames)].map(loadBundle);
  const harnessEnabled = args.harness !== false;
  const harnessBundles = harnessEnabled ? [loadBundle("harness-core")] : [];
  const packs = [
    commonPack,
    { ...runtime, kind: "runtime" },
    ...domainPacks,
    ...bundles,
    ...harnessBundles,
  ].filter(Boolean);
  const context = {
    projectName,
    runtime: args.runtime,
    packs: resolvedPacks.map((pack) => pack.id),
    bundles: bundles.map((bundle) => bundle.name),
    harness: harnessEnabled ? "enabled" : "disabled",
    runtimeInstallCommand: runtime.scripts?.install ?? `${args.runtime} install`,
    runtimeDevCommand: runtime.scripts?.dev ?? `${args.runtime} dev`,
    runtimeCommandPrefix: runtime.scripts?.commandPrefix ?? args.runtime,
  };

  const outputDir = path.resolve(args.output ?? args["out-dir"] ?? path.join(process.cwd(), projectName));
  const { planned, operations } = collectFiles(packs, context);
  finalizePackageJson(planned, context);
  addGeneratedDocs(planned, resolvedPacks, bundles, context);

  writeWorkspace(planned, outputDir, args);

  console.log(args.dryRun ? "Dry run complete." : "Workspace created.");
  console.log(`Name:    ${projectName}`);
  console.log(`Output:  ${outputDir}`);
  console.log(`Runtime: ${args.runtime}`);
  console.log(`Packs:   ${resolvedPacks.map((pack) => pack.id).join(", ")}`);
  console.log(`Bundles: ${bundles.length > 0 ? bundles.map((bundle) => bundle.name).join(", ") : "none"}`);
  console.log(`Harness: ${harnessEnabled ? "enabled" : "disabled"}`);
  console.log(`Files:   ${planned.size}`);
  console.log("");
  console.log("Operations:");
  for (const operation of operations) {
    const rule = operation.rule ? ` (${operation.rule})` : "";
    console.log(`  ${operation.action.padEnd(5)} ${operation.target} <- ${operation.pack}${rule}`);
  }
  console.log("");
  console.log("Next:");
  console.log(`  cd ${outputDir}`);
  console.log(`  ${context.runtimeInstallCommand}`);
  console.log(`  ${context.runtimeDevCommand}`);
  if (harnessEnabled) {
    console.log(`  ./scripts/agent-status.sh`);
  }
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}

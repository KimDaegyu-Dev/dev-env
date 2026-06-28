import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  findPackageIds,
  parseAptUpgradable,
  parsePackageLines,
  runtimeSatisfies,
} from "./adapters.js";
import { commandExists, runCapture } from "./command.js";
import { expandPath } from "./config.js";
import { installAction, uninstallAction, updateAction } from "./packages.js";
import { generateNativeManifest } from "./manifests.js";
import {
  detectPlatform,
  machineMatchesPlatform,
  providerPlatform,
  selectMachine,
} from "./platform.js";
import type {
  Action,
  CommandAction,
  ConfigBundle,
  LinkAction,
  Machine,
  PackageProvider,
  Plan,
} from "./schema.js";
import { ensureStateDirectories, loadManagedPackages, savePlan } from "./state.js";

function newPlan(
  operation: Plan["operation"],
  machine: Machine,
  config: ConfigBundle,
  actions: Action[],
  warnings: string[] = [],
): Plan {
  const now = new Date();
  const plan: Plan = {
    id: randomUUID(),
    operation,
    machineId: machine.id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    configRevision: config.revision,
    actions,
    warnings,
  };
  savePlan(plan);
  return plan;
}

function selectPlanMachine(config: ConfigBundle, machineId?: string): Machine {
  const machine = selectMachine(config, machineId);
  if (!machineMatchesPlatform(machine)) {
    const platform = detectPlatform();
    throw new Error(
      `Machine ${machine.id} does not match this host (${platform.os}${platform.wsl ? ", WSL" : ""}).`,
    );
  }
  return machine;
}

export function installedPackageKeys(providers: PackageProvider[]): Set<string> {
  const installed = new Set<string>();
  if (providers.some((provider) => provider.manager === "brew") && commandExists("brew")) {
    const output = runCapture("brew", ["list", "--formula", "-1"]).stdout;
    for (const id of parsePackageLines(output)) installed.add(`brew:${id}`);
  }
  if (providers.some((provider) => provider.manager === "brew-cask") && commandExists("brew")) {
    const output = runCapture("brew", ["list", "--cask", "-1"]).stdout;
    for (const id of parsePackageLines(output)) installed.add(`brew-cask:${id}`);
  }
  if (providers.some((provider) => provider.manager === "winget") && commandExists("winget")) {
    const output = runCapture("winget", ["list", "--source", "winget"]).stdout;
    const ids = providers.filter((item) => item.manager === "winget").map((item) => item.id);
    for (const id of findPackageIds(output, ids)) {
      installed.add(`winget:${id}`);
    }
  }
  if (providers.some((provider) => provider.manager === "apt") && commandExists("dpkg-query")) {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: dpkg expands this token, JavaScript must not.
    const output = runCapture("dpkg-query", ["-W", "-f=${binary:Package}\\n"]).stdout;
    const packageNames = parsePackageLines(output);
    for (const provider of providers) {
      if (provider.manager === "apt" && packageNames.has(provider.id)) {
        installed.add(`apt:${provider.id}`);
      }
    }
  }
  return installed;
}

function outdatedPackageKeys(providers: PackageProvider[]): Set<string> {
  const outdated = new Set<string>();
  if (providers.some((provider) => provider.manager === "brew") && commandExists("brew")) {
    const output = runCapture("brew", ["outdated", "--formula", "--quiet"]).stdout;
    for (const id of parsePackageLines(output)) outdated.add(`brew:${id}`);
  }
  if (providers.some((provider) => provider.manager === "brew-cask") && commandExists("brew")) {
    const output = runCapture("brew", ["outdated", "--cask", "--quiet"]).stdout;
    for (const id of parsePackageLines(output)) outdated.add(`brew-cask:${id}`);
  }
  if (providers.some((provider) => provider.manager === "winget") && commandExists("winget")) {
    const output = runCapture("winget", ["upgrade", "--source", "winget"]).stdout;
    const ids = providers.filter((item) => item.manager === "winget").map((item) => item.id);
    for (const id of findPackageIds(output, ids)) {
      outdated.add(`winget:${id}`);
    }
  }
  if (providers.some((provider) => provider.manager === "apt") && commandExists("apt")) {
    const output = runCapture("apt", ["list", "--upgradable"]).stdout;
    const names = parseAptUpgradable(output);
    for (const provider of providers) {
      if (provider.manager === "apt" && names.has(provider.id)) outdated.add(`apt:${provider.id}`);
    }
  }
  return outdated;
}

export function selectedPackages(config: ConfigBundle, machine: Machine, profiles?: string[]) {
  const activeProfiles = new Set(profiles?.length ? profiles : machine.profiles);
  const platform = providerPlatform();
  return config.packages.packages.flatMap((item) => {
    if (!item.profiles.some((profile) => activeProfiles.has(profile))) return [];
    const provider = item.providers[platform];
    return provider ? [{ item, provider }] : [];
  });
}

function miseInstallAction(): CommandAction {
  const platform = detectPlatform();
  if (platform.os === "macos") {
    return {
      id: "runtime-install-mise",
      kind: "command",
      category: "runtime",
      title: "Install mise",
      privileged: false,
      mutates: true,
      command: "brew",
      args: ["install", "mise"],
    };
  }
  if (platform.os === "windows") {
    return {
      id: "runtime-install-mise",
      kind: "command",
      category: "runtime",
      title: "Install mise",
      privileged: false,
      mutates: true,
      command: "winget",
      args: ["install", "--id", "jdx.mise", "--exact", "--accept-package-agreements"],
    };
  }
  return {
    id: "runtime-install-mise",
    kind: "command",
    category: "runtime",
    title: "Install mise",
    privileged: false,
    mutates: true,
    command: "sh",
    args: ["-c", "curl -fsSL https://mise.run | sh"],
  };
}

function runtimeActions(config: ConfigBundle): CommandAction[] {
  const actions: CommandAction[] = [];
  const miseInstalled = commandExists("mise");
  const platform = detectPlatform();
  const miseCommand = miseInstalled
    ? "mise"
    : platform.os === "linux"
      ? path.join(os.homedir(), ".local", "bin", "mise")
      : platform.os === "windows"
        ? path.join(
            process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"),
            "Microsoft",
            "WinGet",
            "Links",
            "mise.exe",
          )
        : "mise";
  if (!miseInstalled) actions.push(miseInstallAction());
  let index = 0;
  for (const [tool, version] of Object.entries(config.runtimes.tools)) {
    const current = miseInstalled ? runCapture("mise", ["current", tool]).stdout.trim() : "";
    const satisfied = runtimeSatisfies(version, current);
    if (satisfied) continue;
    actions.push({
      id: `runtime-${index++}-${tool}`,
      kind: "command",
      category: "runtime",
      title: `Use ${tool}@${version}`,
      privileged: false,
      mutates: true,
      command: miseCommand,
      args: ["use", "--global", `${tool}@${version}`],
    });
  }
  return actions;
}

const vscodeProfileNames: Record<string, string> = {
  frontend: "Frontend",
  rust: "Rust",
  cpp: "C++",
  backend: "Backend",
  "ai-python": "AI(Python)",
  fullstack: "Fullstack",
  graphics: "Graphics",
  java: "Java",
};

export function vscodeProfileNeedsApply(repoRoot: string, slug: string): boolean {
  const profileName = vscodeProfileNames[slug] ?? slug;
  const installed = new Set(
    runCapture("code", ["--list-extensions", "--profile", profileName])
      .stdout.split(/\r?\n/)
      .map((item) => item.toLowerCase())
      .filter(Boolean),
  );
  const recommendations: string[] = [];
  for (const file of [
    path.join(repoRoot, "vscode", "common", "extensions.json"),
    path.join(repoRoot, "vscode", slug, "extensions.json"),
  ]) {
    if (!fs.existsSync(file)) continue;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { recommendations?: string[] };
    recommendations.push(...(parsed.recommendations ?? []));
  }
  return recommendations.some((extension) => !installed.has(extension.toLowerCase()));
}

export function linkActions(
  config: ConfigBundle,
  machine: Machine,
): { actions: LinkAction[]; warnings: string[] } {
  const actions: LinkAction[] = [];
  const warnings: string[] = [];
  for (const link of config.links.links) {
    if (!link.enabled || !link.machines.includes(machine.id)) continue;
    let linkPath: string;
    let targetPath: string;
    try {
      const context = { repoRoot: config.repoRoot, paths: machine.paths };
      linkPath = expandPath(link.linkPath, context);
      targetPath = expandPath(link.targetPath, context);
    } catch (error) {
      warnings.push(`${link.id}: ${(error as Error).message}`);
      continue;
    }
    if (!fs.existsSync(targetPath)) {
      warnings.push(`${link.id}: target is unavailable: ${targetPath}`);
      continue;
    }
    if (fs.existsSync(linkPath)) {
      try {
        const current = fs.realpathSync(linkPath);
        const target = fs.realpathSync(targetPath);
        if (path.resolve(current) === path.resolve(target)) continue;
      } catch {
        // Existing non-link entries are backed up during apply.
      }
    }
    actions.push({
      id: `link-${link.id}`,
      kind: "link",
      category: "link",
      title: `Link ${linkPath} → ${targetPath}`,
      privileged: false,
      mutates: true,
      linkId: link.id,
      linkPath,
      targetPath,
      linkKind: link.kind,
      ...(link.windowsMode ? { windowsMode: link.windowsMode } : {}),
      backupExisting: fs.existsSync(linkPath),
    });
  }
  return { actions, warnings };
}

export async function createSetupPlan(
  config: ConfigBundle,
  options: { machineId?: string; profiles?: string[]; only?: string[] } = {},
): Promise<Plan> {
  const machine = selectPlanMachine(config, options.machineId);
  const only = new Set(options.only ?? ["packages", "runtimes", "shell", "links", "vscode"]);
  const actions: Action[] = [];
  const warnings: string[] = [];

  if (only.has("packages")) {
    const nativeManifest = generateNativeManifest(config, machine, options.profiles);
    const selected = selectedPackages(config, machine, options.profiles);
    const installed = installedPackageKeys(selected.map(({ provider }) => provider));
    const missing = selected.filter(
      ({ provider }) => !installed.has(`${provider.manager}:${provider.id}`),
    );
    if (machine.selectors.os === "macos" && missing.length > 0) {
      actions.push({
        id: "package-homebrew-bundle",
        kind: "command",
        category: "package",
        title: "Install declared Homebrew formulae and applications",
        privileged: false,
        mutates: true,
        command: "brew",
        args: ["bundle", `--file=${nativeManifest}`, "--no-upgrade"],
        packages: missing.map(({ item, provider }) => ({
          logicalId: item.id,
          manager: provider.manager,
          providerId: provider.id,
        })),
      });
    } else if (missing.some(({ provider }) => provider.manager === "apt")) {
      actions.push({
        id: "package-apt-refresh",
        kind: "command",
        category: "system",
        title: "Refresh the APT package index",
        privileged: true,
        mutates: true,
        command: "apt-get",
        args: ["update"],
      });
    }
    if (machine.selectors.os !== "macos") {
      let index = 0;
      for (const { item, provider } of missing) {
        actions.push(installAction(item.id, provider, index));
        index += 1;
      }
    }
  }
  if (only.has("runtimes")) actions.push(...runtimeActions(config));
  if (only.has("links") || only.has("shell")) {
    const links = linkActions(config, machine);
    actions.push(...links.actions);
    warnings.push(...links.warnings);
    if (only.has("shell") && commandExists("git")) {
      const gitConfigPath = expandPath("~/.config/dev-env/gitconfig", {
        repoRoot: config.repoRoot,
        paths: machine.paths,
      });
      const ignorePath = expandPath("~/.config/dev-env/gitignore_global", {
        repoRoot: config.repoRoot,
        paths: machine.paths,
      });
      const includes = runCapture("git", [
        "config",
        "--global",
        "--get-all",
        "include.path",
      ]).stdout;
      if (!includes.split(/\r?\n/).includes(gitConfigPath)) {
        actions.push({
          id: "git-include-shared",
          kind: "command",
          category: "system",
          title: "Include the shared Git configuration without changing identity",
          privileged: false,
          mutates: true,
          command: "git",
          args: ["config", "--global", "--add", "include.path", gitConfigPath],
        });
      }
      const currentIgnore = runCapture("git", [
        "config",
        "--global",
        "--get",
        "core.excludesfile",
      ]).stdout.trim();
      if (currentIgnore !== ignorePath) {
        actions.push({
          id: "git-global-ignore",
          kind: "command",
          category: "system",
          title: "Configure the shared global Git ignore file",
          privileged: false,
          mutates: true,
          command: "git",
          args: ["config", "--global", "core.excludesfile", ignorePath],
        });
      }
    }
  }
  if (only.has("vscode") && commandExists("code")) {
    for (const profile of machine.vscodeProfiles) {
      if (vscodeProfileNeedsApply(config.repoRoot, profile)) {
        actions.push({
          id: `vscode-${profile}`,
          kind: "command",
          category: "vscode",
          title: `Apply VS Code profile ${profile}`,
          privileged: false,
          mutates: true,
          command: "node",
          args: ["scripts/apply-vscode-profiles.mjs", profile],
          cwd: config.repoRoot,
        });
      }
    }
  }
  return newPlan("setup", machine, config, actions, warnings);
}

export async function createUpdatePlan(
  config: ConfigBundle,
  options: { machineId?: string; profiles?: string[] } = {},
): Promise<Plan> {
  const machine = selectPlanMachine(config, options.machineId);
  const actions: Action[] = [];
  const selected = selectedPackages(config, machine, options.profiles);
  const providers = selected.map(({ provider }) => provider);
  const installed = installedPackageKeys(providers);
  const outdated = outdatedPackageKeys(providers);
  let index = 0;
  for (const { item, provider } of selected) {
    const key = `${provider.manager}:${provider.id}`;
    if (installed.has(key) && outdated.has(key)) {
      actions.push(updateAction(item.id, provider, index));
    }
    index += 1;
  }
  if (commandExists("mise")) {
    const miseOutdated = runCapture("mise", ["outdated"]).stdout.trim();
    if (miseOutdated) {
      actions.push({
        id: "runtime-update-mise",
        kind: "command",
        category: "runtime",
        title: "Update mise-managed runtimes within configured ranges",
        privileged: false,
        mutates: true,
        command: "mise",
        args: ["upgrade"],
      });
    }
  }
  if (commandExists("code")) {
    actions.push({
      id: "vscode-update-extensions",
      kind: "command",
      category: "vscode",
      title: "Update VS Code extensions",
      privileged: false,
      mutates: true,
      command: "code",
      args: ["--update-extensions"],
    });
  }
  return newPlan("update", machine, config, actions);
}

export async function createCleanupPlan(
  config: ConfigBundle,
  options: { machineId?: string } = {},
): Promise<Plan> {
  const machine = selectPlanMachine(config, options.machineId);
  const platform = providerPlatform();
  const declared = new Set(
    config.packages.packages.flatMap((item) => {
      const provider = item.providers[platform];
      return provider ? [`${provider.manager}:${provider.id}`] : [];
    }),
  );
  const actions: Action[] = [];
  let index = 0;
  for (const entry of loadManagedPackages()) {
    if (declared.has(`${entry.manager}:${entry.providerId}`)) continue;
    actions.push(
      uninstallAction(
        entry.logicalId,
        { manager: entry.manager as PackageProvider["manager"], id: entry.providerId },
        index++,
      ),
    );
  }
  const detected = detectPlatform();
  if (detected.os === "macos" && commandExists("brew")) {
    actions.push({
      id: "cleanup-brew-cache",
      kind: "command",
      category: "cleanup",
      title: "Clean old Homebrew downloads and versions",
      privileged: false,
      mutates: true,
      command: "brew",
      args: ["cleanup", "-s"],
    });
  } else if (detected.os === "linux" && commandExists("apt-get")) {
    actions.push({
      id: "cleanup-apt-autoremove",
      kind: "command",
      category: "cleanup",
      title: "Remove unneeded APT dependencies",
      privileged: true,
      mutates: true,
      command: "apt-get",
      args: ["autoremove", "-y"],
    });
  }
  return newPlan("cleanup", machine, config, actions);
}

export function createLinksPlan(config: ConfigBundle, machineId?: string): Plan {
  const machine = selectPlanMachine(config, machineId);
  const links = linkActions(config, machine);
  return newPlan("links", machine, config, links.actions, links.warnings);
}

export function createRestorePlan(config: ConfigBundle, linkId: string, machineId?: string): Plan {
  const machine = selectPlanMachine(config, machineId);
  const declaredLink = config.links.links.find(
    (link) => link.id === linkId && link.machines.includes(machine.id),
  );
  if (!declaredLink) throw new Error(`Link is not declared for ${machine.id}: ${linkId}`);
  const backupRoot = path.join(ensureStateDirectories(), "backups");
  const metadataFile = path.join(backupRoot, `${declaredLink.id}-latest.json`);
  if (!fs.existsSync(metadataFile)) throw new Error(`No backup metadata found for link: ${linkId}`);
  const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf8")) as {
    linkPath: string;
    backupPath: string | null;
  };
  if (!metadata.backupPath || !fs.existsSync(metadata.backupPath)) {
    throw new Error(`No restorable backup found for link: ${linkId}`);
  }
  const expectedLinkPath = expandPath(declaredLink.linkPath, {
    repoRoot: config.repoRoot,
    paths: machine.paths,
  });
  const resolvedBackup = path.resolve(metadata.backupPath);
  if (
    path.resolve(metadata.linkPath) !== path.resolve(expectedLinkPath) ||
    !resolvedBackup.startsWith(`${path.resolve(backupRoot)}${path.sep}`)
  ) {
    throw new Error(`Backup metadata failed safety validation for link: ${linkId}`);
  }
  return newPlan("restore", machine, config, [
    {
      id: `restore-${linkId}`,
      kind: "restore-link",
      category: "link",
      title: `Restore backup for ${linkId}`,
      privileged: false,
      mutates: true,
      linkId,
      linkPath: metadata.linkPath,
      backupPath: metadata.backupPath,
    },
  ]);
}

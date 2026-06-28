import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runtimeSatisfies } from "./adapters.js";
import { commandExists, runCapture } from "./command.js";
import { expandPath } from "./config.js";
import { managerCommand } from "./packages.js";
import { installedPackageKeys, selectedPackages, vscodeProfileNeedsApply } from "./planner.js";
import {
  detectPlatform,
  machineMatchesPlatform,
  providerPlatform,
  selectMachine,
} from "./platform.js";
import type { ConfigBundle, DoctorResult } from "./schema.js";
import { ensureStateDirectories } from "./state.js";

export async function runDoctor(config: ConfigBundle, machineId?: string): Promise<DoctorResult[]> {
  const machine = selectMachine(config, machineId);
  const platform = detectPlatform();
  const machineMatches = machineMatchesPlatform(machine, platform);
  const providerKey = providerPlatform(platform);
  const results: DoctorResult[] = [
    {
      id: "config",
      category: "configuration",
      status: "pass",
      current: `valid schema, revision ${config.revision.slice(0, 12)}`,
      expected: "all YAML files conform to schemaVersion 1",
      fixable: false,
    },
    {
      id: "machine",
      category: "system",
      status: machineMatches ? "pass" : "failure",
      current: `${platform.hostname} → ${machine.id}`,
      expected: "machine selector matches the current host",
      fixable: true,
      ...(!machineMatches
        ? { recommendation: "Select the matching machine or update config/machines.yaml." }
        : {}),
    },
  ];

  try {
    const state = ensureStateDirectories();
    fs.accessSync(state, fs.constants.R_OK | fs.constants.W_OK);
    results.push({
      id: "state-directory",
      category: "system",
      status: "pass",
      current: `${state} is readable and writable`,
      expected: "state, logs, plans and backups can be persisted outside the repository",
      fixable: false,
    });
  } catch (error) {
    results.push({
      id: "state-directory",
      category: "system",
      status: "failure",
      current: (error as Error).message,
      expected: "state directory is readable and writable",
      fixable: true,
      recommendation: "Correct ownership and permissions for the dev-env state directory.",
    });
  }

  const requiredManagers = new Set<string>();
  for (const item of config.packages.packages) {
    if (!item.profiles.some((profile) => machine.profiles.includes(profile))) continue;
    const provider = item.providers[providerKey];
    if (provider) requiredManagers.add(managerCommand(provider.manager));
  }
  for (const manager of requiredManagers) {
    const installed = commandExists(manager);
    results.push({
      id: `manager-${manager}`,
      category: "package-manager",
      status: installed ? "pass" : "failure",
      current: installed ? "available" : "missing",
      expected: `${manager} is available on PATH`,
      fixable: true,
      ...(!installed ? { recommendation: "Run dev-env setup from the platform bootstrap." } : {}),
    });
  }

  const selected = selectedPackages(config, machine);
  const installedPackages = installedPackageKeys(selected.map(({ provider }) => provider));
  for (const { item, provider } of selected) {
    const installed = installedPackages.has(`${provider.manager}:${provider.id}`);
    results.push({
      id: `package-${item.id}`,
      category: "package",
      status: installed ? "pass" : "warning",
      current: installed ? "installed" : "missing",
      expected: `${provider.manager}:${provider.id}`,
      fixable: true,
      ...(!installed ? { recommendation: `Run dev-env setup --profile ${item.profiles[0]}.` } : {}),
    });
  }

  const miseInstalled = commandExists("mise");
  results.push({
    id: "mise",
    category: "runtime",
    status: miseInstalled ? "pass" : "failure",
    current: miseInstalled ? runCapture("mise", ["--version"]).stdout.trim() : "missing",
    expected: "mise manages declared runtime versions",
    fixable: true,
    ...(!miseInstalled ? { recommendation: "Run dev-env setup --only runtimes." } : {}),
  });

  if (miseInstalled) {
    for (const [tool, expected] of Object.entries(config.runtimes.tools)) {
      const current = runCapture("mise", ["current", tool]).stdout.trim();
      const satisfied = runtimeSatisfies(expected, current);
      results.push({
        id: `runtime-${tool}`,
        category: "runtime",
        status: satisfied ? "pass" : "warning",
        current: current || "not installed",
        expected,
        fixable: true,
        ...(!satisfied ? { recommendation: `mise use --global ${tool}@${expected}` } : {}),
      });
    }
  }

  for (const link of config.links.links) {
    if (!link.enabled || !link.machines.includes(machine.id)) continue;
    try {
      const context = { repoRoot: config.repoRoot, paths: machine.paths };
      const linkPath = expandPath(link.linkPath, context);
      const targetPath = expandPath(link.targetPath, context);
      const targetAvailable = fs.existsSync(targetPath);
      let correct = false;
      if (fs.existsSync(linkPath)) {
        try {
          correct =
            path.resolve(fs.realpathSync(linkPath)) === path.resolve(fs.realpathSync(targetPath));
        } catch {
          correct = false;
        }
      }
      results.push({
        id: `link-${link.id}`,
        category: "link",
        status: !targetAvailable ? "warning" : correct ? "pass" : "failure",
        current: !targetAvailable
          ? "target unavailable"
          : correct
            ? "linked"
            : "missing or different",
        expected: `${linkPath} → ${targetPath}`,
        fixable: targetAvailable,
        ...(!targetAvailable
          ? { recommendation: "Connect the external volume or correct the machine path." }
          : !correct
            ? { recommendation: "Run dev-env links apply." }
            : {}),
      });
    } catch (error) {
      results.push({
        id: `link-${link.id}`,
        category: "link",
        status: "warning",
        current: (error as Error).message,
        expected: "path tokens resolve",
        fixable: false,
      });
    }
  }

  results.push({
    id: "vscode",
    category: "editor",
    status: commandExists("code") ? "pass" : "warning",
    current: commandExists("code") ? "code CLI available" : "code CLI missing",
    expected: "VS Code CLI available",
    fixable: true,
    ...(!commandExists("code")
      ? { recommendation: "Install VS Code or enable its shell command." }
      : {}),
  });

  if (commandExists("git")) {
    const includePath = expandPath("~/.config/dev-env/gitconfig", {
      repoRoot: config.repoRoot,
      paths: machine.paths,
    });
    const includes = runCapture("git", ["config", "--global", "--get-all", "include.path"]).stdout;
    results.push({
      id: "git-include",
      category: "shell",
      status: includes.split(/\r?\n/).includes(includePath) ? "pass" : "warning",
      current: includes.trim() || "not configured",
      expected: includePath,
      fixable: true,
      recommendation: "Run dev-env setup --only shell.",
    });
  }

  const activeRoot = process.env.DEV_ENV_ROOT ? path.resolve(process.env.DEV_ENV_ROOT) : null;
  const expectedRoot = path.resolve(config.repoRoot);
  results.push({
    id: "shell-activation",
    category: "shell",
    status: activeRoot === expectedRoot ? "pass" : "warning",
    current: activeRoot ?? "DEV_ENV_ROOT is not active in this process",
    expected: expectedRoot,
    fixable: true,
    ...(activeRoot !== expectedRoot
      ? { recommendation: "Run dev-env setup --only shell, then start a new shell." }
      : {}),
  });

  for (const profile of machine.vscodeProfiles) {
    const needsApply = commandExists("code") && vscodeProfileNeedsApply(config.repoRoot, profile);
    results.push({
      id: `vscode-profile-${profile}`,
      category: "editor",
      status: !commandExists("code") ? "skipped" : needsApply ? "warning" : "pass",
      current: !commandExists("code")
        ? "code CLI missing"
        : needsApply
          ? "extensions missing"
          : "ready",
      expected: "all declared recommendations installed",
      fixable: true,
      ...(needsApply ? { recommendation: "Run dev-env setup --only vscode." } : {}),
    });
  }

  try {
    const stats = fs.statfsSync(config.repoRoot);
    const availableGb = Number(stats.bavail * stats.bsize) / 1024 ** 3;
    results.push({
      id: "disk-space",
      category: "system",
      status: availableGb >= 5 ? "pass" : "warning",
      current: `${availableGb.toFixed(1)} GB available`,
      expected: "at least 5 GB available",
      fixable: false,
    });
  } catch {
    results.push({
      id: "disk-space",
      category: "system",
      status: "skipped",
      current: `unavailable on ${os.platform()}`,
      expected: "filesystem capacity readable",
      fixable: false,
    });
  }
  return results;
}

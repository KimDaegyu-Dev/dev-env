import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "yaml";
import {
  checksConfigSchema,
  type ConfigBundle,
  linksConfigSchema,
  machinesConfigSchema,
  packagesConfigSchema,
  runtimesConfigSchema,
} from "./schema.js";

const configFiles = ["machines", "packages", "runtimes", "links", "checks"] as const;

function readConfig(repoRoot: string, name: (typeof configFiles)[number]): unknown {
  const filePath = path.join(repoRoot, "config", `${name}.yaml`);
  return parse(fs.readFileSync(filePath, "utf8"));
}

function assertUnique(values: string[], label: string): void {
  const duplicate = values.find((value, index) => values.indexOf(value) !== index);
  if (duplicate) throw new Error(`Duplicate ${label}: ${duplicate}`);
}

export function parseConfigData(
  raw: Record<(typeof configFiles)[number], unknown>,
  repoRoot: string,
): Pick<ConfigBundle, (typeof configFiles)[number]> {
  const machines = machinesConfigSchema.parse(raw.machines);
  const packages = packagesConfigSchema.parse(raw.packages);
  const runtimes = runtimesConfigSchema.parse(raw.runtimes);
  const links = linksConfigSchema.parse(raw.links);
  const checks = checksConfigSchema.parse(raw.checks);
  assertUnique(
    machines.machines.map((machine) => machine.id),
    "machine id",
  );
  assertUnique(
    packages.packages.map((item) => item.id),
    "package id",
  );
  assertUnique(
    links.links.map((link) => link.id),
    "link id",
  );
  assertUnique(
    checks.checks.map((check) => check.id),
    "check id",
  );
  const machineIds = new Set(machines.machines.map((machine) => machine.id));
  for (const link of links.links) {
    for (const machineId of link.machines) {
      if (!machineIds.has(machineId)) {
        throw new Error(`Link ${link.id} references unknown machine: ${machineId}`);
      }
    }
  }
  const validationEnvironment = {
    HOME: "/home/dev-env",
    USERPROFILE: "C:\\Users\\dev-env",
    LOCALAPPDATA: "C:\\Users\\dev-env\\AppData\\Local",
    APPDATA: "C:\\Users\\dev-env\\AppData\\Roaming",
  };
  for (const machine of machines.machines) {
    const context = {
      repoRoot,
      paths: machine.paths,
      home:
        machine.selectors.os === "windows" ? validationEnvironment.USERPROFILE : "/home/dev-env",
      env: validationEnvironment,
    };
    for (const value of Object.values(machine.paths)) expandPath(value, context);
    for (const link of links.links.filter((item) => item.machines.includes(machine.id))) {
      expandPath(link.linkPath, context);
      expandPath(link.targetPath, context);
    }
  }

  return {
    machines,
    packages,
    runtimes,
    links,
    checks,
  };
}

export function loadConfig(repoRoot: string): ConfigBundle {
  const raw = Object.fromEntries(
    configFiles.map((name) => [name, readConfig(repoRoot, name)]),
  ) as Record<(typeof configFiles)[number], unknown>;
  const serialized = configFiles
    .map((name) => fs.readFileSync(path.join(repoRoot, "config", `${name}.yaml`), "utf8"))
    .join("\n---\n");
  const data = parseConfigData(raw, repoRoot);

  return {
    ...data,
    revision: createHash("sha256").update(serialized).digest("hex"),
    repoRoot,
  };
}

export function expandPath(
  value: string,
  context: {
    repoRoot: string;
    paths: Record<string, string>;
    home?: string;
    env?: NodeJS.ProcessEnv;
  },
  resolving = new Set<string>(),
): string {
  if (/\$\(|`/.test(value)) throw new Error("Command substitution is not allowed in paths");
  if (/\$(?!\{)/.test(value)) throw new Error("Only braced path tokens are allowed");
  const environment = context.env ?? process.env;
  const home = context.home ?? environment.HOME ?? environment.USERPROFILE ?? os.homedir();
  let expanded =
    value === "~" || value.startsWith("~/") || value.startsWith("~\\")
      ? path.join(home, value.slice(1))
      : value;

  expanded = expanded.replace(/\$\{([^}]+)\}/g, (_match, token: string) => {
    if (token === "repoRoot") return context.repoRoot;
    if (token === "HOME") return home;
    if (token.startsWith("paths.")) {
      const key = token.slice("paths.".length);
      const pathValue = context.paths[key];
      if (!pathValue) throw new Error(`Unknown machine path: ${token}`);
      if (resolving.has(key)) throw new Error(`Circular machine path reference: ${token}`);
      return expandPath(pathValue, context, new Set([...resolving, key]));
    }
    if (["USERPROFILE", "LOCALAPPDATA", "APPDATA"].includes(token)) {
      const envValue = environment[token];
      if (!envValue) throw new Error(`Environment variable is not set: ${token}`);
      return envValue;
    }
    throw new Error(`Unsupported path token: ${token}`);
  });

  const normalized = path.normalize(expanded);
  if (!path.posix.isAbsolute(normalized) && !path.win32.isAbsolute(normalized)) {
    throw new Error(`Path must be absolute after expansion: ${value}`);
  }
  return normalized;
}

export function validateConfig(repoRoot: string): { valid: true; revision: string } {
  const config = loadConfig(repoRoot);
  return { valid: true, revision: config.revision };
}

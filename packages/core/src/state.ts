import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { planSchema, type Plan, type RunResult } from "./schema.js";

export function stateRoot(env = process.env): string {
  if (env.DEV_ENV_STATE_HOME) return path.resolve(env.DEV_ENV_STATE_HOME);
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "dev-env");
  }
  if (process.platform === "win32") {
    return path.join(env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "dev-env");
  }
  return path.join(env.XDG_STATE_HOME ?? path.join(os.homedir(), ".local", "state"), "dev-env");
}

export function ensureStateDirectories(): string {
  const root = stateRoot();
  for (const directory of ["plans", "runs", "backups", "cache"]) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }
  return root;
}

export function savePlan(plan: Plan): string {
  const root = ensureStateDirectories();
  const file = path.join(root, "plans", `${plan.id}.json`);
  fs.writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  return file;
}

export function loadPlan(planId: string): Plan {
  const file = path.join(ensureStateDirectories(), "plans", `${planId}.json`);
  return planSchema.parse(JSON.parse(fs.readFileSync(file, "utf8"))) as Plan;
}

export function saveRun(run: RunResult): void {
  const root = ensureStateDirectories();
  fs.writeFileSync(
    path.join(root, "runs", `${new Date().toISOString().replaceAll(":", "-")}-${run.planId}.json`),
    `${JSON.stringify(run, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(path.join(root, "cache", "last-run.json"), `${JSON.stringify(run, null, 2)}\n`);
}

export type ManagedPackage = {
  logicalId: string;
  manager: string;
  providerId: string;
  installedAt: string;
};

export function loadManagedPackages(): ManagedPackage[] {
  const file = path.join(ensureStateDirectories(), "managed-packages.json");
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8")) as ManagedPackage[];
}

export function recordManagedPackage(entry: ManagedPackage): void {
  const entries = loadManagedPackages().filter(
    (item) => !(item.manager === entry.manager && item.providerId === entry.providerId),
  );
  entries.push(entry);
  fs.writeFileSync(
    path.join(ensureStateDirectories(), "managed-packages.json"),
    `${JSON.stringify(entries, null, 2)}\n`,
  );
}

export function removeManagedPackage(manager: string, providerId: string): void {
  const entries = loadManagedPackages().filter(
    (item) => !(item.manager === manager && item.providerId === providerId),
  );
  fs.writeFileSync(
    path.join(ensureStateDirectories(), "managed-packages.json"),
    `${JSON.stringify(entries, null, 2)}\n`,
  );
}

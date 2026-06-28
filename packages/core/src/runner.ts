import fs from "node:fs";
import path from "node:path";
import { runStreaming } from "./command.js";
import { loadConfig } from "./config.js";
import type { Action, ActionResult, Plan, RunResult } from "./schema.js";
import {
  ensureStateDirectories,
  recordManagedPackage,
  removeManagedPackage,
  saveRun,
} from "./state.js";

export type OutputHandler = (event: {
  actionId: string;
  stream: "stdout" | "stderr" | "status";
  text: string;
}) => void;

function entryExists(target: string): boolean {
  try {
    fs.lstatSync(target);
    return true;
  } catch {
    return false;
  }
}

function removeAbandonedLock(lockFile: string): void {
  if (!fs.existsSync(lockFile)) return;
  try {
    const metadata = JSON.parse(fs.readFileSync(lockFile, "utf8")) as { pid?: number };
    if (!Number.isInteger(metadata.pid)) return;
    try {
      process.kill(metadata.pid as number, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") fs.rmSync(lockFile, { force: true });
    }
  } catch {
    // An unreadable or malformed lock is preserved for manual inspection.
  }
}

export function executeLink(
  action: Extract<Action, { kind: "link" }>,
  state = ensureStateDirectories(),
): {
  stdout: string;
  stderr: string;
} {
  let backupPath = "";
  fs.mkdirSync(path.dirname(action.linkPath), { recursive: true });
  if (entryExists(action.linkPath)) {
    backupPath = path.join(
      state,
      "backups",
      `${new Date().toISOString().replaceAll(":", "-")}-${action.linkId}`,
    );
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.renameSync(action.linkPath, backupPath);
  }
  const type =
    process.platform === "win32" && action.linkKind === "directory"
      ? action.windowsMode === "symlink"
        ? "dir"
        : "junction"
      : action.linkKind === "directory"
        ? "dir"
        : "file";
  fs.symlinkSync(action.targetPath, action.linkPath, type);
  const metadata = {
    linkId: action.linkId,
    linkPath: action.linkPath,
    targetPath: action.targetPath,
    backupPath: backupPath || null,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(state, "backups", `${action.linkId}-latest.json`),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  return { stdout: `Linked ${action.linkPath} → ${action.targetPath}\n`, stderr: "" };
}

export function executeRestore(action: Extract<Action, { kind: "restore-link" }>) {
  if (entryExists(action.linkPath)) fs.rmSync(action.linkPath, { recursive: true, force: true });
  fs.renameSync(action.backupPath, action.linkPath);
  return { stdout: `Restored ${action.linkPath}\n`, stderr: "" };
}

async function executeAction(action: Action, onOutput?: OutputHandler): Promise<ActionResult> {
  const startedAt = new Date().toISOString();
  onOutput?.({ actionId: action.id, stream: "status", text: `Starting: ${action.title}` });
  try {
    let result: { exitCode: number; stdout: string; stderr: string };
    if (action.kind === "command") {
      const command = action.privileged && process.platform !== "win32" ? "sudo" : action.command;
      const args =
        action.privileged && process.platform !== "win32"
          ? [action.command, ...action.args]
          : action.args;
      result = await runStreaming(command, args, {
        ...(action.cwd ? { cwd: action.cwd } : {}),
        onOutput: (stream, text) => onOutput?.({ actionId: action.id, stream, text }),
      });
    } else {
      const output = action.kind === "link" ? executeLink(action) : executeRestore(action);
      result = { exitCode: 0, ...output };
      onOutput?.({ actionId: action.id, stream: "stdout", text: output.stdout });
    }

    if (result.exitCode === 0 && action.kind === "command") {
      const packages = [...(action.package ? [action.package] : []), ...(action.packages ?? [])];
      for (const managedPackage of packages) {
        if (action.category === "cleanup") {
          removeManagedPackage(managedPackage.manager, managedPackage.providerId);
        } else {
          recordManagedPackage({
            ...managedPackage,
            installedAt: new Date().toISOString(),
          });
        }
      }
    }
    return {
      actionId: action.id,
      status: result.exitCode === 0 ? "success" : "failure",
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      actionId: action.id,
      status: "failure",
      exitCode: null,
      stdout: "",
      stderr: (error as Error).message,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }
}

export async function executePlan(
  plan: Plan,
  repoRoot: string,
  onOutput?: OutputHandler,
): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  if (Date.parse(plan.expiresAt) < Date.now()) throw new Error(`Plan expired: ${plan.id}`);
  const currentConfig = loadConfig(repoRoot);
  if (currentConfig.revision !== plan.configRevision) {
    throw new Error("Configuration changed after this plan was created. Create a new plan.");
  }
  const state = ensureStateDirectories();
  const lockFile = path.join(state, "execution.lock");
  removeAbandonedLock(lockFile);
  let lockDescriptor: number | undefined;
  try {
    lockDescriptor = fs.openSync(lockFile, "wx");
    fs.writeFileSync(
      lockDescriptor,
      `${JSON.stringify({ planId: plan.id, pid: process.pid, startedAt: new Date().toISOString() })}\n`,
    );
  } catch (error) {
    if (lockDescriptor !== undefined) {
      fs.closeSync(lockDescriptor);
      fs.rmSync(lockFile, { force: true });
      throw error;
    }
    throw new Error(`Another dev-env mutation is already running (${lockFile}).`);
  }
  const results: ActionResult[] = [];
  try {
    for (const action of plan.actions) {
      const result = await executeAction(action, onOutput);
      results.push(result);
      if (result.status === "failure") break;
    }
  } finally {
    fs.closeSync(lockDescriptor);
    fs.rmSync(lockFile, { force: true });
  }
  const run: RunResult = {
    planId: plan.id,
    status: results.every((result) => result.status === "success") ? "success" : "failure",
    startedAt,
    finishedAt: new Date().toISOString(),
    results,
  };
  saveRun(run);
  return run;
}

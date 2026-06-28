import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeLink, executeRestore } from "./runner.js";
import type { LinkAction, RestoreLinkAction } from "./schema.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("link backup and restore", () => {
  it("round-trips an existing directory", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dev-env-restore-"));
    roots.push(root);
    const state = path.join(root, "state");
    const target = path.join(root, "external");
    const linkPath = path.join(root, "models");
    fs.mkdirSync(state, { recursive: true });
    fs.mkdirSync(target);
    fs.mkdirSync(linkPath);
    fs.writeFileSync(path.join(linkPath, "original.txt"), "original");
    const action: LinkAction = {
      id: "link-test",
      kind: "link",
      category: "link",
      title: "test",
      privileged: false,
      mutates: true,
      linkId: "test",
      linkPath,
      targetPath: target,
      linkKind: "directory",
      ...(process.platform === "win32" ? { windowsMode: "junction" as const } : {}),
      backupExisting: true,
    };
    executeLink(action, state);
    expect(fs.realpathSync(linkPath)).toBe(fs.realpathSync(target));
    const metadata = JSON.parse(
      fs.readFileSync(path.join(state, "backups", "test-latest.json"), "utf8"),
    );
    const restore: RestoreLinkAction = {
      id: "restore-test",
      kind: "restore-link",
      category: "link",
      title: "restore",
      privileged: false,
      mutates: true,
      linkId: "test",
      linkPath,
      backupPath: metadata.backupPath,
    };
    executeRestore(restore);
    expect(fs.readFileSync(path.join(linkPath, "original.txt"), "utf8")).toBe("original");
  });
});

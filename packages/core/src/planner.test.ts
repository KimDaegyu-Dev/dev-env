import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRestorePlan, createSetupPlan, linkActions } from "./planner.js";
import { detectPlatform } from "./platform.js";
import { executeLink } from "./runner.js";
import type { ConfigBundle, Machine } from "./schema.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  delete process.env.DEV_ENV_STATE_HOME;
});

function fixture(targetPath: string, linkPath: string) {
  const platform = detectPlatform();
  const machine: Machine = {
    id: "test-machine",
    selectors: { os: platform.os },
    profiles: ["base"],
    vscodeProfiles: [],
    paths: {},
  };
  const config = {
    repoRoot: "/repo",
    links: {
      schemaVersion: 1,
      links: [
        {
          id: "test-link",
          machines: [machine.id],
          linkPath,
          targetPath,
          kind: "directory",
          enabled: true,
        },
      ],
    },
  } as unknown as ConfigBundle;
  return { config, machine };
}

describe("linkActions", () => {
  it("warns without mutating when a target volume is unavailable", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dev-env-link-"));
    temporaryDirectories.push(root);
    const { config, machine } = fixture(path.join(root, "missing"), path.join(root, "link"));
    const result = linkActions(config, machine);
    expect(result.actions).toHaveLength(0);
    expect(result.warnings[0]).toContain("target is unavailable");
    expect(fs.existsSync(path.join(root, "link"))).toBe(false);
  });

  it("does not plan an already-correct link", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dev-env-link-"));
    temporaryDirectories.push(root);
    const target = path.join(root, "target");
    const link = path.join(root, "link");
    fs.mkdirSync(target);
    fs.symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
    const { config, machine } = fixture(target, link);
    expect(linkActions(config, machine).actions).toHaveLength(0);
  });

  it("produces an empty second setup plan after convergence", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dev-env-idempotent-"));
    temporaryDirectories.push(root);
    process.env.DEV_ENV_STATE_HOME = path.join(root, "state");
    const target = path.join(root, "target");
    const link = path.join(root, "link");
    fs.mkdirSync(target);
    const { config, machine } = fixture(target, link);
    Object.assign(config, {
      revision: "fixture-revision",
      machines: { schemaVersion: 1, machines: [machine] },
      packages: { schemaVersion: 1, packages: [] },
      runtimes: { schemaVersion: 1, tools: {} },
      checks: { schemaVersion: 1, checks: [] },
    });
    const first = await createSetupPlan(config, { machineId: machine.id, only: ["links"] });
    expect(first.actions).toHaveLength(1);
    executeLink(
      first.actions[0] as Extract<(typeof first.actions)[number], { kind: "link" }>,
      path.join(root, "state"),
    );
    const second = await createSetupPlan(config, { machineId: machine.id, only: ["links"] });
    expect(second.actions).toHaveLength(0);
  });

  it("rejects restore ids that are not declared for the machine", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dev-env-restore-safe-"));
    temporaryDirectories.push(root);
    process.env.DEV_ENV_STATE_HOME = path.join(root, "state");
    const { config, machine } = fixture(path.join(root, "target"), path.join(root, "link"));
    Object.assign(config, {
      revision: "fixture-revision",
      machines: { schemaVersion: 1, machines: [machine] },
    });
    expect(() => createRestorePlan(config, "../../unsafe", machine.id)).toThrow(
      "Link is not declared",
    );
  });
});

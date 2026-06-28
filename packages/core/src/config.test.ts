import path from "node:path";
import { describe, expect, it } from "vitest";
import { expandPath } from "./config.js";

describe("expandPath", () => {
  it("expands repo, home and machine path references", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: This is the configuration syntax under test.
    const result = expandPath("${paths.comfy}/models", {
      repoRoot: "/repo",
      home: "/home/dev",
      paths: { comfy: "~/ComfyUI" },
      env: {},
    });
    expect(result).toBe(path.normalize("/home/dev/ComfyUI/models"));
  });

  it("rejects unknown interpolation", () => {
    expect(() =>
      // biome-ignore lint/suspicious/noTemplateCurlyInString: This is the invalid configuration syntax under test.
      expandPath("${SECRET}/models", { repoRoot: "/repo", home: "/home/dev", paths: {} }),
    ).toThrow("Unsupported path token");
  });

  it("rejects command substitutions and circular machine paths", () => {
    expect(() => expandPath("$(whoami)/models", { repoRoot: "/repo", paths: {} })).toThrow(
      "Command substitution",
    );
    const circularPath = `\${paths.a}`;
    expect(() =>
      expandPath(circularPath, { repoRoot: "/repo", paths: { a: circularPath } }),
    ).toThrow("Circular machine path reference");
  });

  it("rejects unbraced variables and relative paths", () => {
    expect(() => expandPath("$HOME/models", { repoRoot: "/repo", paths: {} })).toThrow(
      "Only braced path tokens",
    );
    expect(() => expandPath("relative/models", { repoRoot: "/repo", paths: {} })).toThrow(
      "Path must be absolute",
    );
  });
});

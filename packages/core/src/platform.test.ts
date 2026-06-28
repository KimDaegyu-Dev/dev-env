import { describe, expect, it } from "vitest";
import type { ConfigBundle } from "./schema.js";
import { selectMachine } from "./platform.js";

const config = {
  machines: {
    schemaVersion: 1,
    machines: [
      {
        id: "wsl",
        selectors: { os: "linux", wsl: true },
        profiles: ["base"],
        vscodeProfiles: [],
        paths: {},
      },
      {
        id: "linux",
        selectors: { os: "linux", wsl: false },
        profiles: ["base"],
        vscodeProfiles: [],
        paths: {},
      },
    ],
  },
} as unknown as ConfigBundle;

describe("selectMachine", () => {
  it("distinguishes WSL from native Linux", () => {
    expect(selectMachine(config, undefined, { os: "linux", hostname: "pc", wsl: true }).id).toBe(
      "wsl",
    );
  });
});

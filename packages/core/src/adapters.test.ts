import { describe, expect, it } from "vitest";
import {
  findPackageIds,
  parseAptUpgradable,
  parsePackageLines,
  runtimeSatisfies,
} from "./adapters.js";

describe("package manager output adapters", () => {
  it("parses Homebrew line output", () => {
    expect([...parsePackageLines("git\nripgrep\n\n")]).toEqual(["git", "ripgrep"]);
  });

  it("finds stable WinGet identifiers independent of table spacing", () => {
    const output = "Git  2.50  Git.Git  2.51  winget\nPowerToys  Microsoft.PowerToys  0.90";
    expect([...findPackageIds(output, ["Git.Git", "Microsoft.PowerToys", "Missing.App"])]).toEqual([
      "Git.Git",
      "Microsoft.PowerToys",
    ]);
  });

  it("parses APT upgradable packages", () => {
    const output =
      "Listing... Done\ngit/jammy-updates 1:2.43 amd64 [upgradable]\ncurl/jammy 8.0 amd64";
    expect([...parseAptUpgradable(output)]).toEqual(["git", "curl"]);
  });
});

describe("runtimeSatisfies", () => {
  it.each([
    ["24", "24.13.0", true],
    ["3.12", "python 3.12.9", true],
    ["temurin-17", "temurin-17.0.15+6", true],
    ["24", "22.14.0", false],
    ["stable", "1.90.0", true],
  ])("matches %s against %s", (expected, current, result) => {
    expect(runtimeSatisfies(expected, current)).toBe(result);
  });
});

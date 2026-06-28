import { describe, expect, it } from "vitest";
import { renderAptPackages, renderBrewfile, renderWinget } from "./manifests.js";
import type { ConfigBundle, Machine } from "./schema.js";

const config = {
  packages: {
    schemaVersion: 1,
    packages: [
      {
        id: "git",
        profiles: ["base"],
        providers: {
          macos: { manager: "brew", id: "git" },
          windows: { manager: "winget", id: "Git.Git" },
          ubuntu: { manager: "apt", id: "git" },
        },
      },
      {
        id: "chrome",
        profiles: ["base"],
        providers: {
          macos: { manager: "brew-cask", id: "google-chrome" },
          windows: { manager: "winget", id: "Google.Chrome" },
        },
      },
    ],
  },
} as unknown as ConfigBundle;

function machine(os: Machine["selectors"]["os"]): Machine {
  return { id: os, selectors: { os }, profiles: ["base"], vscodeProfiles: [], paths: {} };
}

describe("native package manifests", () => {
  it("renders Brew formulae and casks", () => {
    expect(renderBrewfile(config, machine("macos"))).toContain('brew "git"');
    expect(renderBrewfile(config, machine("macos"))).toContain('cask "google-chrome"');
  });

  it("renders a valid WinGet import document", () => {
    const document = JSON.parse(renderWinget(config, machine("windows")));
    expect(document.Sources[0].Packages).toEqual([
      { PackageIdentifier: "Git.Git" },
      { PackageIdentifier: "Google.Chrome" },
    ]);
  });

  it("renders an APT package list", () => {
    expect(renderAptPackages(config, machine("linux"))).toBe("git\n");
  });
});

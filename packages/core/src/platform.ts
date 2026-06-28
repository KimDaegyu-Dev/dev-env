import fs from "node:fs";
import os from "node:os";
import type { ConfigBundle, Machine, OperatingSystem } from "./schema.js";

export type PlatformInfo = {
  os: OperatingSystem;
  hostname: string;
  wsl: boolean;
};

export function detectPlatform(): PlatformInfo {
  const platform = process.platform;
  const detectedOs: OperatingSystem =
    platform === "darwin" ? "macos" : platform === "win32" ? "windows" : "linux";
  let wsl = Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP);
  if (!wsl && detectedOs === "linux") {
    try {
      wsl = /microsoft|wsl/i.test(fs.readFileSync("/proc/version", "utf8"));
    } catch {
      wsl = false;
    }
  }
  return { os: detectedOs, hostname: os.hostname(), wsl };
}

export function machineMatchesPlatform(machine: Machine, platform = detectPlatform()): boolean {
  if (machine.selectors.os !== platform.os) return false;
  if (machine.selectors.wsl !== undefined && machine.selectors.wsl !== platform.wsl) return false;
  if (machine.selectors.hostname && machine.selectors.hostname !== platform.hostname) return false;
  return true;
}

export function selectMachine(
  config: ConfigBundle,
  explicitId?: string,
  platform = detectPlatform(),
): Machine {
  if (explicitId) {
    const explicit = config.machines.machines.find((machine) => machine.id === explicitId);
    if (!explicit) throw new Error(`Unknown machine: ${explicitId}`);
    return explicit;
  }

  const exact = config.machines.machines.find(
    (machine) => machine.selectors.hostname && machineMatchesPlatform(machine, platform),
  );
  if (exact) return exact;

  const generic = config.machines.machines.find(
    (machine) => !machine.selectors.hostname && machineMatchesPlatform(machine, platform),
  );
  if (generic) return generic;

  throw new Error(
    `No machine configuration matches ${platform.hostname} (${platform.os}${platform.wsl ? ", WSL" : ""})`,
  );
}

export function providerPlatform(platform = detectPlatform()): "macos" | "windows" | "ubuntu" {
  return platform.os === "macos" ? "macos" : platform.os === "windows" ? "windows" : "ubuntu";
}

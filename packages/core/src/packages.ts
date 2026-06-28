import type { CommandAction, PackageProvider } from "./schema.js";

export function managerCommand(manager: PackageProvider["manager"]): string {
  if (manager === "brew" || manager === "brew-cask") return "brew";
  if (manager === "winget") return "winget";
  return "apt-get";
}

export function installAction(
  logicalId: string,
  provider: PackageProvider,
  index: number,
): CommandAction {
  let args: string[];
  let privileged = false;
  if (provider.manager === "brew") args = ["install", provider.id];
  else if (provider.manager === "brew-cask") args = ["install", "--cask", provider.id];
  else if (provider.manager === "winget") {
    args = [
      "install",
      "--id",
      provider.id,
      "--exact",
      "--accept-package-agreements",
      "--accept-source-agreements",
      "--disable-interactivity",
    ];
  } else {
    args = ["install", "-y", provider.id];
    privileged = true;
  }

  return {
    id: `package-install-${index}-${logicalId}`,
    kind: "command",
    category: "package",
    title: `Install ${logicalId} (${provider.id})`,
    privileged,
    mutates: true,
    command: managerCommand(provider.manager),
    args,
    package: { logicalId, manager: provider.manager, providerId: provider.id },
  };
}

export function updateAction(
  logicalId: string,
  provider: PackageProvider,
  index: number,
): CommandAction {
  let args: string[];
  let privileged = false;
  if (provider.manager === "brew") args = ["upgrade", provider.id];
  else if (provider.manager === "brew-cask") args = ["upgrade", "--cask", provider.id];
  else if (provider.manager === "winget") {
    args = [
      "upgrade",
      "--id",
      provider.id,
      "--exact",
      "--accept-package-agreements",
      "--accept-source-agreements",
      "--disable-interactivity",
    ];
  } else {
    args = ["install", "--only-upgrade", "-y", provider.id];
    privileged = true;
  }
  return {
    id: `package-update-${index}-${logicalId}`,
    kind: "command",
    category: "package",
    title: `Update ${logicalId} (${provider.id})`,
    privileged,
    mutates: true,
    command: managerCommand(provider.manager),
    args,
  };
}

export function uninstallAction(
  logicalId: string,
  provider: PackageProvider,
  index: number,
): CommandAction {
  let args: string[];
  let privileged = false;
  if (provider.manager === "brew" || provider.manager === "brew-cask") {
    args = ["uninstall", provider.id];
  } else if (provider.manager === "winget") {
    args = ["uninstall", "--id", provider.id, "--exact", "--disable-interactivity"];
  } else {
    args = ["remove", "-y", provider.id];
    privileged = true;
  }
  return {
    id: `package-remove-${index}-${logicalId}`,
    kind: "command",
    category: "cleanup",
    title: `Remove managed package ${logicalId} (${provider.id})`,
    privileged,
    mutates: true,
    command: managerCommand(provider.manager),
    args,
    package: { logicalId, manager: provider.manager, providerId: provider.id },
  };
}

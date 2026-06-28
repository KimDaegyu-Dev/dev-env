export function parsePackageLines(output: string): Set<string> {
  return new Set(
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

export function findPackageIds(output: string, ids: string[]): Set<string> {
  const tokens = new Set(output.toLowerCase().split(/\s+/).filter(Boolean));
  return new Set(ids.filter((id) => tokens.has(id.toLowerCase())));
}

export function parseAptUpgradable(output: string): Set<string> {
  return new Set(
    output
      .split(/\r?\n/)
      .filter((line) => line.includes("/"))
      .map((line) => line.split("/")[0]?.trim())
      .filter((name): name is string => Boolean(name)),
  );
}

export function runtimeSatisfies(expected: string, current: string): boolean {
  const normalized = current.trim().toLowerCase();
  if (!normalized) return false;
  if (expected === "latest" || expected === "stable") return true;
  const numericPrefix = expected.match(/\d+(?:\.\d+)?/)?.[0];
  if (!numericPrefix) return normalized.includes(expected.toLowerCase());
  const versionPattern = new RegExp(`(?:^|[^0-9])${numericPrefix.replace(".", "\\.")}(?:\\.|$)`);
  return versionPattern.test(normalized);
}

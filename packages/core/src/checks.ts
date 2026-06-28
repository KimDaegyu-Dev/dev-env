import { commandExists, runCapture } from "./command.js";
import type { ConfigBundle, DoctorResult } from "./schema.js";

export async function runChecks(
  config: ConfigBundle,
  mode: "check" | "format" = "check",
): Promise<DoctorResult[]> {
  const results: DoctorResult[] = [];
  for (const check of config.checks.checks) {
    const args = mode === "format" ? check.formatArgs : check.checkArgs;
    if (!args) {
      results.push({
        id: check.id,
        category: "check",
        status: "skipped",
        current: "no format command configured",
        expected: "optional",
        fixable: false,
      });
      continue;
    }
    if (!commandExists(check.command)) {
      results.push({
        id: check.id,
        category: "check",
        status: check.required ? "failure" : "skipped",
        current: `${check.command} is not installed`,
        expected: check.required ? "required" : "optional",
        fixable: true,
      });
      continue;
    }
    const output = runCapture(check.command, args, config.repoRoot);
    results.push({
      id: check.id,
      category: "check",
      status: output.status === 0 ? "pass" : "failure",
      current:
        output.status === 0 ? "passed" : (output.stderr || output.stdout).trim().slice(0, 1000),
      expected: `${check.command} ${args.join(" ")} exits successfully`,
      fixable: mode === "check" && Boolean(check.formatArgs),
      ...(output.status !== 0 && check.formatArgs ? { recommendation: "Run dev-env format." } : {}),
    });
  }
  return results;
}

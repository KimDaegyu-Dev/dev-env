#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import {
  createCleanupPlan,
  createLinksPlan,
  createRestorePlan,
  createSetupPlan,
  createUpdatePlan,
  executePlan,
  loadConfig,
  loadPlan,
  runChecks,
  runDoctor,
  generateNativeManifest,
  selectMachine,
  stateRoot,
  type DoctorResult,
  type Plan,
} from "@dev-env/core";
import { startDashboardServer } from "@dev-env/server";
import { Command, Option } from "commander";

function findRepoRoot(start = process.cwd()): string {
  let current = path.resolve(start);
  while (true) {
    const packageFile = path.join(current, "package.json");
    if (fs.existsSync(packageFile)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8")) as { name?: string };
        if (pkg.name === "dev-env-control-plane") return current;
      } catch {
        // Continue searching parent directories.
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  if (fs.existsSync(path.join(moduleRoot, "config"))) return moduleRoot;
  throw new Error("Could not locate the dev-env repository root.");
}

const repoRoot = findRepoRoot();

function printPlan(plan: Plan): void {
  console.log(`\nPlan ${plan.id}`);
  console.log(`Operation: ${plan.operation}`);
  console.log(`Machine:   ${plan.machineId}`);
  console.log(`Expires:   ${plan.expiresAt}`);
  if (plan.actions.length === 0) console.log("\nNo changes required.");
  for (const warning of plan.warnings) console.warn(`WARN: ${warning}`);
  for (const [index, action] of plan.actions.entries()) {
    console.log(
      `${String(index + 1).padStart(2)}. ${action.privileged ? "[admin] " : ""}${action.title}`,
    );
  }
}

async function confirm(question: string): Promise<boolean> {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(`${question} [y/N] `);
  prompt.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function maybeApply(plan: Plan, options: { apply?: boolean; yes?: boolean }): Promise<void> {
  printPlan(plan);
  if (plan.actions.length === 0) return;
  if (!options.apply) {
    console.log(`\nPreview only. Apply with: dev-env apply-plan ${plan.id}`);
    return;
  }
  if (!process.stdin.isTTY && !options.yes) {
    throw new Error("Non-interactive mutation requires both --apply and --yes.");
  }
  if (process.stdin.isTTY && !options.yes && !(await confirm("Apply this plan?"))) {
    console.log("Cancelled.");
    return;
  }
  const run = await executePlan(plan, repoRoot, ({ stream, text }) => {
    if (stream === "stderr") process.stderr.write(text);
    else console.log(stream === "status" ? `\n${text}` : text.trimEnd());
  });
  console.log(`\nRun status: ${run.status}`);
  if (run.status === "failure") process.exitCode = 1;
}

function printResults(results: DoctorResult[]): void {
  for (const result of results) {
    const marker = { pass: "PASS", warning: "WARN", failure: "FAIL", skipped: "SKIP" }[
      result.status
    ];
    console.log(
      `${marker.padEnd(4)}  ${result.category.padEnd(16)} ${result.id}: ${result.current}`,
    );
    if (result.recommendation) console.log(`      → ${result.recommendation}`);
  }
}

function commonMutationOptions(command: Command): Command {
  return command
    .option("--machine <id>", "machine configuration id")
    .option("--apply", "apply the generated plan")
    .option("--yes", "skip the interactive confirmation");
}

const program = new Command()
  .name("dev-env")
  .description("Declarative cross-platform development environment control plane")
  .version("0.1.0");

commonMutationOptions(
  program
    .command("setup")
    .description("Plan or apply the declared machine environment")
    .addOption(new Option("--profile <names...>", "package profiles"))
    .option("--only <targets>", "comma-separated packages,runtimes,links,shell,vscode"),
).action(async (options) => {
  const config = loadConfig(repoRoot);
  const plan = await createSetupPlan(config, {
    ...(options.machine ? { machineId: options.machine } : {}),
    ...(options.profile ? { profiles: options.profile as string[] } : {}),
    ...(options.only
      ? {
          only: String(options.only)
            .split(",")
            .map((item) => item.trim()),
        }
      : {}),
  });
  await maybeApply(plan, options);
});

program
  .command("doctor")
  .description("Diagnose configuration, tools, runtimes and links")
  .option("--machine <id>", "machine configuration id")
  .option("--json", "print JSON")
  .option("--allow-unhealthy", "return success even when failures are found")
  .action(async (options) => {
    const results = await runDoctor(loadConfig(repoRoot), options.machine);
    const cacheDir = path.join(stateRoot(), "cache");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, "last-doctor.json"),
      `${JSON.stringify({ createdAt: new Date().toISOString(), results }, null, 2)}\n`,
    );
    if (options.json) console.log(JSON.stringify(results, null, 2));
    else printResults(results);
    if (!options.allowUnhealthy && results.some((result) => result.status === "failure")) {
      process.exitCode = 1;
    }
  });

commonMutationOptions(
  program.command("update").description("Plan or apply managed updates"),
).action(async (options) => {
  const plan = await createUpdatePlan(loadConfig(repoRoot), {
    ...(options.machine ? { machineId: options.machine } : {}),
  });
  await maybeApply(plan, options);
});

commonMutationOptions(
  program.command("cleanup").description("Plan or apply managed package and cache cleanup"),
).action(async (options) => {
  const plan = await createCleanupPlan(loadConfig(repoRoot), {
    ...(options.machine ? { machineId: options.machine } : {}),
  });
  await maybeApply(plan, options);
});

const links = program.command("links").description("Manage declared filesystem links");
links
  .command("plan")
  .option("--machine <id>")
  .action((options) => printPlan(createLinksPlan(loadConfig(repoRoot), options.machine)));
commonMutationOptions(links.command("apply")).action(async (options) => {
  await maybeApply(createLinksPlan(loadConfig(repoRoot), options.machine), {
    ...options,
    apply: true,
  });
});
commonMutationOptions(
  links.command("restore <link-id>").description("Restore the latest backup for a managed link"),
).action(async (linkId, options) => {
  await maybeApply(createRestorePlan(loadConfig(repoRoot), linkId, options.machine), {
    ...options,
    apply: true,
  });
});

program
  .command("check")
  .description("Run all repository checks without modifying files")
  .option("--json")
  .action(async (options) => {
    const results = await runChecks(loadConfig(repoRoot), "check");
    if (options.json) console.log(JSON.stringify(results, null, 2));
    else printResults(results);
    if (results.some((result) => result.status === "failure")) process.exitCode = 1;
  });

program
  .command("format")
  .description("Run configured repository formatters")
  .action(async () => {
    const results = await runChecks(loadConfig(repoRoot), "format");
    printResults(results);
    if (results.some((result) => result.status === "failure")) process.exitCode = 1;
  });

const configCommand = program.command("config");
configCommand.command("validate").action(() => {
  const config = loadConfig(repoRoot);
  console.log(`Configuration valid. Revision: ${config.revision}`);
});
configCommand
  .command("generate")
  .option("--machine <id>")
  .action((options) => {
    const config = loadConfig(repoRoot);
    const machine = selectMachine(config, options.machine);
    console.log(generateNativeManifest(config, machine));
  });

program
  .command("apply-plan <plan-id>")
  .option("--yes", "skip the interactive confirmation")
  .action(async (planId, options) => {
    const plan = loadPlan(planId);
    await maybeApply(plan, { apply: true, yes: options.yes });
  });

program
  .command("dashboard")
  .option("--port <port>", "server port", "4545")
  .option("--no-open", "do not open a browser")
  .action(async (options) => {
    await startDashboardServer({ repoRoot, port: Number(options.port), openBrowser: options.open });
  });

program.parseAsync().catch((error: Error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});

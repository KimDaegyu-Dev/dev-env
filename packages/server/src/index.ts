import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ServerResponse } from "node:http";
import {
  checksConfigSchema,
  createCleanupPlan,
  createLinksPlan,
  createRestorePlan,
  createSetupPlan,
  createUpdatePlan,
  detectPlatform,
  executePlan,
  linksConfigSchema,
  loadConfig,
  loadPlan,
  machinesConfigSchema,
  packagesConfigSchema,
  parseConfigData,
  runtimesConfigSchema,
  runChecks,
  runDoctor,
  selectMachine,
  stateRoot,
  type Plan,
} from "@dev-env/core";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import open from "open";
import { stringify } from "yaml";

export type DashboardServerOptions = {
  repoRoot: string;
  port?: number;
  openBrowser?: boolean;
  token?: string;
  listen?: boolean;
};

type ConfigDomain = "machines" | "packages" | "runtimes" | "links" | "checks";
const schemas = {
  machines: machinesConfigSchema,
  packages: packagesConfigSchema,
  runtimes: runtimesConfigSchema,
  links: linksConfigSchema,
  checks: checksConfigSchema,
};

function readJsonIfPresent(file: string): unknown {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function configData(config: ReturnType<typeof loadConfig>) {
  return {
    machines: config.machines,
    packages: config.packages,
    runtimes: config.runtimes,
    links: config.links,
    checks: config.checks,
  };
}

export async function createDashboardServer(options: DashboardServerOptions) {
  const token = options.token ?? randomBytes(24).toString("base64url");
  const app = Fastify({ logger: false });
  const clients = new Set<ServerResponse>();
  const emit = (event: unknown) => {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of clients) client.write(payload);
  };

  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;
    const queryToken = (request.query as { token?: string } | undefined)?.token;
    const headerToken = request.headers["x-dev-env-token"];
    if (queryToken !== token && headerToken !== token) {
      await reply.code(401).send({ error: "invalid dashboard session token" });
    }
  });

  app.get("/api/status", async () => {
    const config = loadConfig(options.repoRoot);
    const machine = selectMachine(config);
    const cache = path.join(stateRoot(), "cache");
    return {
      platform: detectPlatform(),
      machine,
      revision: config.revision,
      profiles: machine.profiles,
      packageCount: config.packages.packages.length,
      runtimeCount: Object.keys(config.runtimes.tools).length,
      linkCount: config.links.links.filter((link) => link.machines.includes(machine.id)).length,
      lastDoctor: readJsonIfPresent(path.join(cache, "last-doctor.json")),
      lastRun: readJsonIfPresent(path.join(cache, "last-run.json")),
    };
  });

  app.get("/api/config", async () => {
    const config = loadConfig(options.repoRoot);
    return { revision: config.revision, data: configData(config) };
  });

  app.get("/api/inventory", async () => {
    const results = await runDoctor(loadConfig(options.repoRoot));
    return {
      packages: results.filter((result) => result.category === "package"),
      runtimes: results.filter((result) => result.category === "runtime"),
      links: results.filter((result) => result.category === "link"),
      editor: results.filter((result) => result.category === "editor"),
    };
  });

  app.get("/api/activity", async () => {
    const directory = path.join(stateRoot(), "runs");
    if (!fs.existsSync(directory)) return { runs: [] };
    const files = fs
      .readdirSync(directory)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, 50);
    return {
      runs: files
        .map((file) => readJsonIfPresent(path.join(directory, file)))
        .filter((run) => run !== null),
    };
  });

  app.post<{ Body: { domain: ConfigDomain; data: unknown; revision: string } }>(
    "/api/config/preview",
    async (request, reply) => {
      const config = loadConfig(options.repoRoot);
      if (request.body.revision !== config.revision) {
        return await reply.code(409).send({ error: "configuration revision changed" });
      }
      const domain = request.body.domain;
      if (!(domain in schemas))
        return await reply.code(400).send({ error: "unknown config domain" });
      const result = schemas[domain].safeParse(request.body.data);
      if (!result.success) {
        return await reply.code(400).send({
          error: "configuration schema validation failed",
          issues: result.error.issues,
        });
      }
      let parsed: unknown;
      try {
        parsed = parseConfigData(
          { ...configData(config), [domain]: result.data },
          options.repoRoot,
        )[domain];
      } catch (error) {
        return await reply.code(400).send({
          error: "configuration semantic validation failed",
          detail: (error as Error).message,
        });
      }
      const file = path.join(options.repoRoot, "config", `${domain}.yaml`);
      return {
        domain,
        before: fs.readFileSync(file, "utf8"),
        after: stringify(parsed, { lineWidth: 100 }),
      };
    },
  );

  app.post<{ Body: { domain: ConfigDomain; data: unknown; revision: string } }>(
    "/api/config/apply",
    async (request, reply) => {
      const config = loadConfig(options.repoRoot);
      if (request.body.revision !== config.revision) {
        return await reply.code(409).send({ error: "configuration revision changed" });
      }
      const domain = request.body.domain;
      if (!(domain in schemas))
        return await reply.code(400).send({ error: "unknown config domain" });
      const result = schemas[domain].safeParse(request.body.data);
      if (!result.success) {
        return await reply.code(400).send({
          error: "configuration schema validation failed",
          issues: result.error.issues,
        });
      }
      let parsed: unknown;
      try {
        parsed = parseConfigData(
          { ...configData(config), [domain]: result.data },
          options.repoRoot,
        )[domain];
      } catch (error) {
        return await reply.code(400).send({
          error: "configuration semantic validation failed",
          detail: (error as Error).message,
        });
      }
      const file = path.join(options.repoRoot, "config", `${domain}.yaml`);
      const temporaryFile = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(temporaryFile, stringify(parsed, { lineWidth: 100 }), "utf8");
      fs.renameSync(temporaryFile, file);
      const updated = loadConfig(options.repoRoot);
      emit({ type: "config", domain, revision: updated.revision });
      return { ok: true, revision: updated.revision };
    },
  );

  app.post<{ Body?: { machineId?: string } }>("/api/doctor", async (request) => {
    const results = await runDoctor(loadConfig(options.repoRoot), request.body?.machineId);
    const cache = path.join(stateRoot(), "cache");
    fs.mkdirSync(cache, { recursive: true });
    const payload = { createdAt: new Date().toISOString(), results };
    fs.writeFileSync(path.join(cache, "last-doctor.json"), `${JSON.stringify(payload, null, 2)}\n`);
    emit({ type: "doctor", ...payload });
    return payload;
  });

  app.post<{ Body?: { mode?: "check" | "format" } }>("/api/checks", async (request) => {
    const mode = request.body?.mode ?? "check";
    const results = await runChecks(loadConfig(options.repoRoot), mode);
    emit({ type: "checks", mode, results });
    return { mode, results };
  });

  app.post<{
    Body: {
      operation: "setup" | "update" | "cleanup" | "links" | "restore";
      machineId?: string;
      profiles?: string[];
      only?: string[];
      linkId?: string;
    };
  }>("/api/plans", async (request) => {
    const config = loadConfig(options.repoRoot);
    const body = request.body;
    let plan: Plan;
    if (body.operation === "setup") {
      plan = await createSetupPlan(config, {
        ...(body.machineId ? { machineId: body.machineId } : {}),
        ...(body.profiles ? { profiles: body.profiles } : {}),
        ...(body.only ? { only: body.only } : {}),
      });
    } else if (body.operation === "update") {
      plan = await createUpdatePlan(config, {
        ...(body.machineId ? { machineId: body.machineId } : {}),
        ...(body.profiles ? { profiles: body.profiles } : {}),
      });
    } else if (body.operation === "cleanup") {
      plan = await createCleanupPlan(config, {
        ...(body.machineId ? { machineId: body.machineId } : {}),
      });
    } else if (body.operation === "links") {
      plan = createLinksPlan(config, body.machineId);
    } else {
      if (!body.linkId) throw new Error("restore requires linkId");
      plan = createRestorePlan(config, body.linkId, body.machineId);
    }
    emit({ type: "plan", plan });
    return {
      plan,
      requiresTerminal: plan.actions.some((action) => action.privileged),
      terminalCommand: `dev-env apply-plan ${plan.id}`,
    };
  });

  app.post<{ Params: { id: string } }>("/api/plans/:id/execute", async (request, reply) => {
    const plan = loadPlan(request.params.id);
    if (plan.actions.some((action) => action.privileged)) {
      return await reply.code(409).send({
        error: "privileged plan requires terminal approval",
        terminalCommand: `dev-env apply-plan ${plan.id}`,
      });
    }
    const run = await executePlan(plan, options.repoRoot, (event) =>
      emit({ type: "output", ...event }),
    );
    emit({ type: "run", run });
    return run;
  });

  app.get("/api/events", async (request, reply) => {
    reply.hijack();
    const response = reply.raw;
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    response.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
    clients.add(response);
    request.raw.on("close", () => clients.delete(response));
  });

  const dashboardRoot = path.join(options.repoRoot, "apps", "dashboard", "dist");
  if (fs.existsSync(dashboardRoot)) {
    await app.register(fastifyStatic, { root: dashboardRoot, wildcard: false });
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/"))
        return await reply.code(404).send({ error: "not found" });
      return await reply.sendFile("index.html");
    });
  } else {
    app.get("/", async () => ({
      message: "Dashboard is not built. Run pnpm --filter @dev-env/dashboard build.",
    }));
  }

  if (options.listen === false) {
    await app.ready();
    return { app, token, url: `http://127.0.0.1:${options.port ?? 4545}/?token=${token}` };
  }

  const port = options.port ?? 4545;
  const address = await app.listen({ host: "127.0.0.1", port });
  const url = `${address}/?token=${token}`;
  console.log(`dev-env dashboard: ${url}`);
  if (options.openBrowser !== false) await open(url);
  return { app, token, url };
}

export const startDashboardServer = createDashboardServer;

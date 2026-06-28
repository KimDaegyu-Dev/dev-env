import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSetupPlan, loadConfig } from "@dev-env/core";
import { afterEach, describe, expect, it } from "vitest";
import { createDashboardServer } from "./index.js";

const roots: string[] = [];
const servers: Array<Awaited<ReturnType<typeof createDashboardServer>>["app"]> = [];

afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  delete process.env.DEV_ENV_STATE_HOME;
});

function testRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dev-env-server-"));
  roots.push(root);
  process.env.DEV_ENV_STATE_HOME = path.join(root, "state");
  fs.cpSync(path.resolve(import.meta.dirname, "../../../config"), path.join(root, "config"), {
    recursive: true,
  });
  return root;
}

describe("dashboard configuration API", () => {
  it("requires the session token and returns a validated YAML diff", async () => {
    const server = await createDashboardServer({
      repoRoot: testRepository(),
      port: 0,
      openBrowser: false,
      token: "test-token",
      listen: false,
    });
    servers.push(server.app);

    expect((await server.app.inject({ method: "GET", url: "/api/config" })).statusCode).toBe(401);
    const configResponse = await server.app.inject({
      method: "GET",
      url: "/api/config",
      headers: { "x-dev-env-token": "test-token" },
    });
    const config = configResponse.json();
    const preview = await server.app.inject({
      method: "POST",
      url: "/api/config/preview",
      headers: { "x-dev-env-token": "test-token" },
      payload: {
        domain: "runtimes",
        revision: config.revision,
        data: { ...config.data.runtimes, tools: { ...config.data.runtimes.tools, node: "24" } },
      },
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().after).toContain('node: "24"');
  });

  it("rejects stale revisions before writing", async () => {
    const server = await createDashboardServer({
      repoRoot: testRepository(),
      port: 0,
      openBrowser: false,
      token: "test-token",
      listen: false,
    });
    servers.push(server.app);
    const response = await server.app.inject({
      method: "POST",
      url: "/api/config/apply",
      headers: { "x-dev-env-token": "test-token" },
      payload: { domain: "runtimes", revision: "stale", data: { schemaVersion: 1, tools: {} } },
    });
    expect(response.statusCode).toBe(409);
  });

  it("returns a client error for schema-invalid configuration", async () => {
    const server = await createDashboardServer({
      repoRoot: testRepository(),
      port: 0,
      openBrowser: false,
      token: "test-token",
      listen: false,
    });
    servers.push(server.app);
    const config = (
      await server.app.inject({
        method: "GET",
        url: "/api/config",
        headers: { "x-dev-env-token": "test-token" },
      })
    ).json();
    const response = await server.app.inject({
      method: "POST",
      url: "/api/config/preview",
      headers: { "x-dev-env-token": "test-token" },
      payload: { domain: "runtimes", revision: config.revision, data: { schemaVersion: 2 } },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("schema validation");
  });

  it("rejects semantically invalid cross-file references", async () => {
    const server = await createDashboardServer({
      repoRoot: testRepository(),
      port: 0,
      openBrowser: false,
      token: "test-token",
      listen: false,
    });
    servers.push(server.app);
    const config = (
      await server.app.inject({
        method: "GET",
        url: "/api/config",
        headers: { "x-dev-env-token": "test-token" },
      })
    ).json();
    const invalidLinks = structuredClone(config.data.links);
    invalidLinks.links[0].machines = ["missing-machine"];
    const response = await server.app.inject({
      method: "POST",
      url: "/api/config/preview",
      headers: { "x-dev-env-token": "test-token" },
      payload: { domain: "links", revision: config.revision, data: invalidLinks },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("semantic validation");
  });

  it("creates the same setup action model as the shared core engine", async () => {
    const repoRoot = testRepository();
    const server = await createDashboardServer({
      repoRoot,
      port: 0,
      openBrowser: false,
      token: "test-token",
      listen: false,
    });
    servers.push(server.app);
    const apiResponse = await server.app.inject({
      method: "POST",
      url: "/api/plans",
      headers: { "x-dev-env-token": "test-token" },
      payload: { operation: "setup", only: ["links"] },
    });
    expect(apiResponse.statusCode, apiResponse.body).toBe(200);
    const direct = await createSetupPlan(loadConfig(repoRoot), { only: ["links"] });
    const fromApi = apiResponse.json().plan;
    expect(fromApi.actions).toEqual(direct.actions);
    expect(fromApi.warnings).toEqual(direct.warnings);
  });
});

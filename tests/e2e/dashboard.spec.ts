import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createDashboardServer } from "../../packages/server/dist/index.js";

let dashboard: Awaited<ReturnType<typeof createDashboardServer>> | undefined;
let stateDirectory: string;

test.beforeAll(async () => {
  stateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "dev-env-e2e-"));
  process.env.DEV_ENV_STATE_HOME = stateDirectory;
  dashboard = await createDashboardServer({
    repoRoot: path.resolve(import.meta.dirname, "../.."),
    port: 0,
    openBrowser: false,
    token: "e2e-token",
  });
});

test.afterAll(async () => {
  await dashboard?.app.close();
  if (stateDirectory) fs.rmSync(stateDirectory, { recursive: true, force: true });
  delete process.env.DEV_ENV_STATE_HOME;
});

test("plan preview, configuration form and activity are connected", async ({ page }) => {
  if (!dashboard) throw new Error("dashboard server did not start");
  await page.goto(dashboard.url);
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Converge this machine" })).toBeVisible();
  await page.getByRole("button", { name: "Create setup plan", exact: true }).click();
  await expect(page.getByText("PLAN PREVIEW")).toBeVisible();
  await expect(page.getByText(/actions ·/)).toBeVisible();
  await page.getByRole("button", { name: "×" }).click();

  await page.getByRole("button", { name: "Configuration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Structured configuration" })).toBeVisible();
  await page.getByRole("button", { name: "runtimes", exact: true }).click();
  await expect(page.getByLabel("node", { exact: true })).toHaveValue("24");

  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Live activity" })).toBeVisible();
  await expect(page.locator(".log")).toContainText('"type":"plan"');
});

test("Korean help tooltips support hover, keyboard focus and viewport boundaries", async ({
  page,
}) => {
  if (!dashboard) throw new Error("dashboard server did not start");
  await page.goto(dashboard.url);

  const overviewHelp = page.getByRole("button", { name: "도움말: overview 화면" });
  await overviewHelp.hover();
  const overviewTooltip = page.getByRole("tooltip");
  await expect(overviewTooltip).toContainText("먼저 Run doctor를 실행");
  const describedBy = await overviewHelp.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  await expect(overviewTooltip).toHaveAttribute("id", describedBy as string);

  await page.mouse.move(600, 500);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  const setupHelp = page.getByRole("button", { name: "도움말: setup 화면" });
  await setupHelp.focus();
  await expect(page.getByRole("tooltip")).toContainText("반복 실행해도 안전");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await setupHelp.click();
  await expect(page.getByRole("tooltip")).toContainText("반복 실행해도 안전");
  await setupHelp.click();
  await expect(page.getByRole("tooltip")).toHaveCount(0);

  await page.getByRole("button", { name: "Links", exact: true }).click();
  await page
    .getByRole("button", { name: /도움말: .* linkPath/ })
    .first()
    .hover();
  await expect(page.getByRole("tooltip")).toContainText("기존 항목이 있으면 적용 시 먼저 백업");

  await page.mouse.move(600, 500);
  await page.getByRole("button", { name: "Configuration", exact: true }).click();
  await page.getByRole("button", { name: "도움말: machines 설정" }).hover();
  await expect(page.getByRole("tooltip")).toContainText("기기 선택 조건");

  await page.mouse.move(600, 500);
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await page.getByRole("button", { name: "Create setup plan", exact: true }).click();
  const drawerHelp = page.getByRole("button", { name: "도움말: Plan preview" });
  await drawerHelp.hover();
  const drawerTooltip = page.getByRole("tooltip");
  await expect(drawerTooltip).toContainText("plan은 30분 후 만료");
  const box = await drawerTooltip.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box && viewport) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
});

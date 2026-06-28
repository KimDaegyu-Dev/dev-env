import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDashboardServer } from "./index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
await startDashboardServer({ repoRoot, port: 4545, openBrowser: false });

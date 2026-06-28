import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function commandExists(command: string): boolean {
  const lookup = process.platform === "win32" ? "where.exe" : "which";
  return spawnSync(lookup, [command], { stdio: "ignore" }).status === 0;
}

export function runCapture(command: string, args: string[], cwd?: string) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", shell: false });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export async function runStreaming(
  command: string,
  args: string[],
  options: { cwd?: string; onOutput?: (stream: "stdout" | "stderr", text: string) => void } = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      env: {
        ...process.env,
        PATH: [
          process.env.PATH,
          path.join(process.env.HOME ?? "", ".local", "bin"),
          path.join(
            process.env.USERPROFILE ?? "",
            "AppData",
            "Local",
            "Microsoft",
            "WinGet",
            "Links",
          ),
        ]
          .filter(Boolean)
          .join(path.delimiter),
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      options.onOutput?.("stdout", text);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      options.onOutput?.("stderr", text);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ exitCode: code ?? 1, stdout, stderr }));
  });
}

export function pathExists(target: string): boolean {
  return fs.existsSync(target);
}

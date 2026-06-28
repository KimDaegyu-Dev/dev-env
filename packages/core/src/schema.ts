import { z } from "zod";

export const osSchema = z.enum(["macos", "windows", "linux"]);
export type OperatingSystem = z.infer<typeof osSchema>;
const identifierSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/, "invalid identifier");

export const providerSchema = z.object({
  manager: z.enum(["brew", "brew-cask", "winget", "apt"]),
  id: z.string().min(1),
});

export const machinesConfigSchema = z.object({
  schemaVersion: z.literal(1),
  machines: z.array(
    z.object({
      id: identifierSchema,
      selectors: z.object({
        os: osSchema,
        hostname: z.string().min(1).optional(),
        wsl: z.boolean().optional(),
      }),
      profiles: z.array(z.string()).default(["base"]),
      vscodeProfiles: z.array(z.string()).default([]),
      paths: z.record(z.string(), z.string()).default({}),
    }),
  ),
});

export const packagesConfigSchema = z.object({
  schemaVersion: z.literal(1),
  packages: z.array(
    z.object({
      id: identifierSchema,
      profiles: z.array(z.string()).min(1),
      providers: z.object({
        macos: providerSchema.optional(),
        windows: providerSchema.optional(),
        ubuntu: providerSchema.optional(),
      }),
    }),
  ),
});

export const runtimesConfigSchema = z.object({
  schemaVersion: z.literal(1),
  tools: z.record(z.string(), z.string()),
});

export const linksConfigSchema = z.object({
  schemaVersion: z.literal(1),
  links: z.array(
    z.object({
      id: identifierSchema,
      machines: z.array(z.string()).min(1),
      linkPath: z.string().min(1),
      targetPath: z.string().min(1),
      kind: z.enum(["file", "directory"]),
      windowsMode: z.enum(["symlink", "junction"]).optional(),
      enabled: z.boolean(),
    }),
  ),
});

export const checksConfigSchema = z.object({
  schemaVersion: z.literal(1),
  checks: z.array(
    z.object({
      id: identifierSchema,
      command: z.string().min(1),
      checkArgs: z.array(z.string()),
      formatArgs: z.array(z.string()).optional(),
      required: z.boolean().default(false),
    }),
  ),
});

export type MachinesConfig = z.infer<typeof machinesConfigSchema>;
export type Machine = MachinesConfig["machines"][number];
export type PackagesConfig = z.infer<typeof packagesConfigSchema>;
export type PackageDefinition = PackagesConfig["packages"][number];
export type PackageProvider = z.infer<typeof providerSchema>;
export type RuntimesConfig = z.infer<typeof runtimesConfigSchema>;
export type LinksConfig = z.infer<typeof linksConfigSchema>;
export type LinkDefinition = LinksConfig["links"][number];
export type ChecksConfig = z.infer<typeof checksConfigSchema>;

export type ConfigBundle = {
  machines: MachinesConfig;
  packages: PackagesConfig;
  runtimes: RuntimesConfig;
  links: LinksConfig;
  checks: ChecksConfig;
  revision: string;
  repoRoot: string;
};

export type DoctorStatus = "pass" | "warning" | "failure" | "skipped";

export type DoctorResult = {
  id: string;
  category: string;
  status: DoctorStatus;
  current: string;
  expected: string;
  fixable: boolean;
  recommendation?: string;
};

type ActionBase = {
  id: string;
  category: "package" | "runtime" | "link" | "vscode" | "cleanup" | "system";
  title: string;
  privileged: boolean;
  mutates: true;
};

export type CommandAction = ActionBase & {
  kind: "command";
  command: string;
  args: string[];
  cwd?: string;
  package?: { logicalId: string; manager: PackageProvider["manager"]; providerId: string };
  packages?: Array<{
    logicalId: string;
    manager: PackageProvider["manager"];
    providerId: string;
  }>;
};

export type LinkAction = ActionBase & {
  kind: "link";
  linkId: string;
  linkPath: string;
  targetPath: string;
  linkKind: "file" | "directory";
  windowsMode?: "symlink" | "junction";
  backupExisting: boolean;
};

export type RestoreLinkAction = ActionBase & {
  kind: "restore-link";
  linkId: string;
  linkPath: string;
  backupPath: string;
};

export type Action = CommandAction | LinkAction | RestoreLinkAction;

export type Plan = {
  id: string;
  operation: "setup" | "update" | "cleanup" | "links" | "restore";
  machineId: string;
  createdAt: string;
  expiresAt: string;
  configRevision: string;
  actions: Action[];
  warnings: string[];
};

const actionBaseSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["package", "runtime", "link", "vscode", "cleanup", "system"]),
  title: z.string().min(1),
  privileged: z.boolean(),
  mutates: z.literal(true),
});

const commandActionSchema = actionBaseSchema.extend({
  kind: z.literal("command"),
  command: z.string().min(1),
  args: z.array(z.string()),
  cwd: z.string().optional(),
  package: z
    .object({
      logicalId: z.string().min(1),
      manager: z.enum(["brew", "brew-cask", "winget", "apt"]),
      providerId: z.string().min(1),
    })
    .optional(),
  packages: z
    .array(
      z.object({
        logicalId: z.string().min(1),
        manager: z.enum(["brew", "brew-cask", "winget", "apt"]),
        providerId: z.string().min(1),
      }),
    )
    .optional(),
});

const linkActionSchema = actionBaseSchema.extend({
  kind: z.literal("link"),
  linkId: z.string().min(1),
  linkPath: z.string().min(1),
  targetPath: z.string().min(1),
  linkKind: z.enum(["file", "directory"]),
  windowsMode: z.enum(["symlink", "junction"]).optional(),
  backupExisting: z.boolean(),
});

const restoreLinkActionSchema = actionBaseSchema.extend({
  kind: z.literal("restore-link"),
  linkId: z.string().min(1),
  linkPath: z.string().min(1),
  backupPath: z.string().min(1),
});

export const planSchema = z.object({
  id: z.string().uuid(),
  operation: z.enum(["setup", "update", "cleanup", "links", "restore"]),
  machineId: z.string().min(1),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  configRevision: z.string().min(1),
  actions: z.array(
    z.discriminatedUnion("kind", [commandActionSchema, linkActionSchema, restoreLinkActionSchema]),
  ),
  warnings: z.array(z.string()),
});

export type ActionResult = {
  actionId: string;
  status: "success" | "failure" | "skipped";
  exitCode: number | null;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
};

export type RunResult = {
  planId: string;
  status: "success" | "failure";
  startedAt: string;
  finishedAt: string;
  results: ActionResult[];
};

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api, type DoctorResult, type PlanResponse, sessionToken } from "./api";
import { HelpTooltip, type HelpKey, tabHelpKey } from "./help";
import { StructuredConfigEditor } from "./StructuredConfigEditor";

type Tab =
  | "overview"
  | "setup"
  | "packages"
  | "runtimes"
  | "links"
  | "checks"
  | "config"
  | "activity";

type Status = {
  platform: { os: string; hostname: string; wsl: boolean };
  machine: { id: string; profiles: string[] };
  revision: string;
  packageCount: number;
  runtimeCount: number;
  linkCount: number;
  lastDoctor: { createdAt: string; results: DoctorResult[] } | null;
  lastRun: unknown;
};

type ConfigResponse = {
  revision: string;
  data: {
    machines: {
      machines: Array<{ id: string; profiles: string[]; paths: Record<string, string> }>;
    };
    packages: {
      packages: Array<{ id: string; profiles: string[]; providers: Record<string, unknown> }>;
    };
    runtimes: { tools: Record<string, string> };
    links: {
      schemaVersion: 1;
      links: Array<{
        id: string;
        machines: string[];
        linkPath: string;
        targetPath: string;
        kind: string;
        windowsMode?: string;
        enabled: boolean;
      }>;
    };
    checks: unknown;
  };
};

type Inventory = {
  packages: DoctorResult[];
  runtimes: DoctorResult[];
  links: DoctorResult[];
  editor: DoctorResult[];
};

type Activity = {
  runs: Array<{
    planId: string;
    status: "success" | "failure";
    startedAt?: string;
    results: Array<{ actionId: string; status: string; stderr: string }>;
  }>;
};

type PlanRequest = {
  operation: "setup" | "update" | "cleanup" | "links" | "restore";
  profiles?: string[];
  only?: string[];
  linkId?: string;
};

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "setup", label: "Setup" },
  { id: "packages", label: "Packages" },
  { id: "runtimes", label: "Runtimes" },
  { id: "links", label: "Links" },
  { id: "checks", label: "Checks" },
  { id: "config", label: "Configuration" },
  { id: "activity", label: "Activity" },
];

function Pill({ status }: { status: DoctorResult["status"] }) {
  return (
    <HelpTooltip helpKey={`status.${status}`} label={`${status} 상태`}>
      <span className={`pill ${status}`}>{status}</span>
    </HelpTooltip>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

function ActionWithHelp({
  helpKey,
  label,
  children,
}: {
  helpKey: HelpKey;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="action-with-help">
      {children}
      <HelpTooltip helpKey={helpKey} label={label} />
    </span>
  );
}

export function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const [activePlan, setActivePlan] = useState<PlanResponse | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ["status"], queryFn: () => api<Status>("/status") });
  const config = useQuery({ queryKey: ["config"], queryFn: () => api<ConfigResponse>("/config") });
  const inventory = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api<Inventory>("/inventory"),
  });
  const activity = useQuery({
    queryKey: ["activity"],
    queryFn: () => api<Activity>("/activity"),
  });

  useEffect(() => {
    const source = new EventSource(`/api/events?token=${encodeURIComponent(sessionToken)}`);
    source.onmessage = (event) => {
      setEvents((current) => [event.data, ...current].slice(0, 100));
      void queryClient.invalidateQueries({ queryKey: ["status"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
    };
    return () => source.close();
  }, [queryClient]);

  const createPlan = useMutation({
    mutationFn: (request: PlanRequest) =>
      api<PlanResponse>("/plans", { method: "POST", body: JSON.stringify(request) }),
    onSuccess: setActivePlan,
  });
  const executePlan = useMutation({
    mutationFn: (planId: string) => api(`/plans/${planId}/execute`, { method: "POST" }),
    onSuccess: () => {
      setActivePlan(null);
      void queryClient.invalidateQueries({ queryKey: ["status"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
  const doctor = useMutation({
    mutationFn: () => api<{ results: DoctorResult[] }>("/doctor", { method: "POST", body: "{}" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["status"] }),
  });
  const checks = useMutation({
    mutationFn: (mode: "check" | "format") =>
      api<{ results: DoctorResult[] }>("/checks", {
        method: "POST",
        body: JSON.stringify({ mode }),
      }),
  });

  if (status.isLoading || config.isLoading)
    return <main className="loading">Connecting to dev-env…</main>;
  if (status.error || config.error) {
    return <main className="loading error">{String(status.error ?? config.error)}</main>;
  }

  if (!status.data || !config.data)
    return <main className="loading error">No dashboard data.</main>;
  const snapshot = status.data;
  const configs = config.data;
  const doctorResults = doctor.data?.results ?? snapshot.lastDoctor?.results ?? [];
  const failures = doctorResults.filter((item) => item.status === "failure").length;
  const warnings = doctorResults.filter((item) => item.status === "warning").length;
  const operationError = createPlan.error ?? executePlan.error ?? doctor.error ?? checks.error;

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <span className="brand-mark">d</span>
          <div>
            <strong>dev-env</strong>
            <small>control plane</small>
          </div>
        </div>
        <nav>
          {tabs.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="machine-card">
          <span className="online-dot" />
          <div>
            <strong>{snapshot.machine.id}</strong>
            <small>{snapshot.platform.hostname}</small>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">
              {snapshot.platform.os}
              {snapshot.platform.wsl ? " · WSL" : ""}
            </p>
            <div className="heading-with-help">
              <h1>{tabs.find((item) => item.id === tab)?.label}</h1>
              <HelpTooltip helpKey={tabHelpKey(tab)} label={`${tab} 화면`} />
            </div>
          </div>
          <ActionWithHelp helpKey="action.refresh" label="Refresh">
            <button className="ghost" onClick={() => void queryClient.invalidateQueries()}>
              Refresh
            </button>
          </ActionWithHelp>
        </header>

        {tab === "overview" && (
          <>
            <section className="stats">
              <article>
                <div className="stat-label">
                  <small>Health</small>
                  <HelpTooltip helpKey="stats.health" label="Health 요약" />
                </div>
                <strong className={failures ? "bad" : "good"}>
                  {failures ? `${failures} failures` : "Healthy"}
                </strong>
                <span>{warnings} warnings</span>
              </article>
              <article>
                <div className="stat-label">
                  <small>Packages</small>
                  <HelpTooltip helpKey="stats.packages" label="Packages 요약" />
                </div>
                <strong>{snapshot.packageCount}</strong>
                <span>{snapshot.machine.profiles.join(" · ")}</span>
              </article>
              <article>
                <div className="stat-label">
                  <small>Runtimes</small>
                  <HelpTooltip helpKey="stats.runtimes" label="Runtimes 요약" />
                </div>
                <strong>{snapshot.runtimeCount}</strong>
                <span>managed by mise</span>
              </article>
              <article>
                <div className="stat-label">
                  <small>Links</small>
                  <HelpTooltip helpKey="stats.links" label="Links 요약" />
                </div>
                <strong>{snapshot.linkCount}</strong>
                <span>declared for this machine</span>
              </article>
            </section>
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Environment health</h2>
                  <p>Configuration, tools, runtimes and links</p>
                </div>
                <ActionWithHelp helpKey="action.doctor" label="Run doctor">
                  <button onClick={() => doctor.mutate()} disabled={doctor.isPending}>
                    {doctor.isPending ? "Scanning…" : "Run doctor"}
                  </button>
                </ActionWithHelp>
              </div>
              {doctorResults.length ? (
                <div className="result-list">
                  {doctorResults.slice(0, 12).map((result) => (
                    <div className="result" key={result.id}>
                      <Pill status={result.status} />
                      <div>
                        <strong>{result.id}</strong>
                        <p>{result.current}</p>
                      </div>
                      <small>{result.category}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>Run doctor to create the first health snapshot.</Empty>
              )}
            </section>
          </>
        )}

        {tab === "setup" && (
          <SetupPanel
            profiles={snapshot.machine.profiles}
            pending={createPlan.isPending}
            onPlan={(request) => createPlan.mutate(request)}
          />
        )}
        {tab === "packages" && (
          <>
            <div className="action-row">
              <ActionWithHelp helpKey="action.updatePlan" label="Plan updates">
                <button onClick={() => createPlan.mutate({ operation: "update" })}>
                  Plan updates
                </button>
              </ActionWithHelp>
              <ActionWithHelp helpKey="action.cleanupPlan" label="Plan cleanup">
                <button
                  className="danger-outline"
                  onClick={() => createPlan.mutate({ operation: "cleanup" })}
                >
                  Plan cleanup
                </button>
              </ActionWithHelp>
            </div>
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Declared packages</h2>
                  <p>Logical packages mapped to native providers</p>
                </div>
              </div>
              <div className="chip-grid">
                {configs.data.packages.packages.map((pkg) => {
                  const result = inventory.data?.packages.find(
                    (item) => item.id === `package-${pkg.id}`,
                  );
                  return (
                    <div className="chip" key={pkg.id}>
                      <div className="chip-title">
                        <strong>{pkg.id}</strong>
                        {result && <Pill status={result.status} />}
                      </div>
                      <span>{result?.current ?? pkg.profiles.join(", ")}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
        {tab === "runtimes" && (
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>mise toolchain</h2>
                <p>Major versions stay stable while patches move forward</p>
              </div>
            </div>
            <div className="runtime-grid">
              {Object.entries(configs.data.runtimes.tools).map(([tool, version]) => (
                <div key={tool}>
                  <span>
                    {tool}
                    <small>
                      {inventory.data?.runtimes.find((item) => item.id === `runtime-${tool}`)
                        ?.current ?? "not scanned"}
                    </small>
                  </span>
                  <strong>
                    {version}
                    {inventory.data?.runtimes.find((item) => item.id === `runtime-${tool}`) && (
                      <Pill
                        status={
                          inventory.data.runtimes.find((item) => item.id === `runtime-${tool}`)
                            ?.status ?? "skipped"
                        }
                      />
                    )}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        )}
        {tab === "links" && (
          <LinksEditor
            config={configs}
            onSaved={() => void queryClient.invalidateQueries({ queryKey: ["config"] })}
            onPlan={(request) => createPlan.mutate(request)}
          />
        )}
        {tab === "checks" && (
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Repository checks</h2>
                <p>Formatting, types, tests, Shell and PowerShell</p>
              </div>
              <div className="action-row">
                <ActionWithHelp helpKey="action.runChecks" label="Run checks">
                  <button onClick={() => checks.mutate("check")}>Run checks</button>
                </ActionWithHelp>
                <ActionWithHelp helpKey="action.format" label="Format">
                  <button className="ghost" onClick={() => checks.mutate("format")}>
                    Format
                  </button>
                </ActionWithHelp>
              </div>
            </div>
            {checks.data ? (
              <div className="result-list">
                {checks.data.results.map((result) => (
                  <div className="result" key={result.id}>
                    <Pill status={result.status} />
                    <div>
                      <strong>{result.id}</strong>
                      <p>{result.current}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>No check run in this session.</Empty>
            )}
          </section>
        )}
        {tab === "config" && (
          <StructuredConfigEditor
            revision={configs.revision}
            data={configs.data}
            onSaved={() => void queryClient.invalidateQueries({ queryKey: ["config"] })}
          />
        )}
        {tab === "activity" && (
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Live activity</h2>
                <p>Server-sent events from plans, checks and runs</p>
              </div>
            </div>
            {activity.data?.runs.length || events.length ? (
              <>
                <div className="run-list">
                  {activity.data?.runs.map((run) => (
                    <article key={run.planId}>
                      <Pill status={run.status === "success" ? "pass" : "failure"} />
                      <div>
                        <strong>{run.planId}</strong>
                        {run.results.find((result) => result.status === "failure")?.stderr && (
                          <small>
                            {run.results.find((result) => result.status === "failure")?.stderr}
                          </small>
                        )}
                      </div>
                      <div className="run-meta">
                        <span>{run.results.length} actions</span>
                        {run.startedAt && <time>{new Date(run.startedAt).toLocaleString()}</time>}
                      </div>
                    </article>
                  ))}
                </div>
                {events.length > 0 && <pre className="log">{events.join("\n")}</pre>}
              </>
            ) : (
              <Empty>No persisted runs or live activity yet.</Empty>
            )}
          </section>
        )}

        {operationError && <p className="operation-error">{String(operationError)}</p>}

        {activePlan && (
          <PlanDrawer
            response={activePlan}
            onClose={() => setActivePlan(null)}
            onExecute={() => executePlan.mutate(activePlan.plan.id)}
            pending={executePlan.isPending}
          />
        )}
      </main>
    </div>
  );
}

function SetupPanel({
  profiles,
  onPlan,
  pending,
}: {
  profiles: string[];
  onPlan: (request: PlanRequest) => void;
  pending: boolean;
}) {
  const [selectedProfiles, setSelectedProfiles] = useState(profiles);
  const [targets, setTargets] = useState(["packages", "runtimes", "shell", "links", "vscode"]);
  const allTargets = ["packages", "runtimes", "shell", "links", "vscode"];
  return (
    <section className="hero-panel setup-panel">
      <div className="setup-copy">
        <p className="eyebrow">IDEMPOTENT SETUP</p>
        <h2>Converge this machine</h2>
        <p>Only missing packages, runtimes, links and profiles are planned.</p>
        <fieldset className="choice-group">
          <legend>
            <span className="legend-with-help">
              Profiles
              <HelpTooltip helpKey="setup.profiles" label="Profiles" />
            </span>
          </legend>
          {profiles.map((profile) => (
            <label key={profile}>
              <input
                type="checkbox"
                checked={selectedProfiles.includes(profile)}
                onChange={(event) =>
                  setSelectedProfiles((current) =>
                    event.target.checked
                      ? [...current, profile]
                      : current.filter((item) => item !== profile),
                  )
                }
              />
              {profile}
            </label>
          ))}
        </fieldset>
        <fieldset className="choice-group">
          <legend>
            <span className="legend-with-help">
              Components
              <HelpTooltip helpKey="setup.components" label="Components" />
            </span>
          </legend>
          {allTargets.map((target) => (
            <label key={target}>
              <input
                type="checkbox"
                checked={targets.includes(target)}
                onChange={(event) =>
                  setTargets((current) =>
                    event.target.checked
                      ? [...current, target]
                      : current.filter((item) => item !== target),
                  )
                }
              />
              {target}
            </label>
          ))}
        </fieldset>
      </div>
      <ActionWithHelp helpKey="action.setupPlan" label="Create setup plan">
        <button
          onClick={() => onPlan({ operation: "setup", profiles: selectedProfiles, only: targets })}
          disabled={pending || selectedProfiles.length === 0 || targets.length === 0}
        >
          {pending ? "Planning…" : "Create setup plan"}
        </button>
      </ActionWithHelp>
    </section>
  );
}

function PlanDrawer({
  response,
  onClose,
  onExecute,
  pending,
}: {
  response: PlanResponse;
  onClose: () => void;
  onExecute: () => void;
  pending: boolean;
}) {
  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-title">
          <div>
            <p className="eyebrow">PLAN PREVIEW</p>
            <div className="heading-with-help">
              <h2>{response.plan.operation}</h2>
              <HelpTooltip helpKey="plan.preview" label="Plan preview" />
            </div>
            <p>
              {response.plan.actions.length} actions · {response.plan.machineId}
            </p>
          </div>
          <button className="icon" onClick={onClose}>
            ×
          </button>
        </div>
        {response.plan.warnings.map((warning) => (
          <p className="warning" key={warning}>
            {warning}
          </p>
        ))}
        <div className="plan-actions">
          {response.plan.actions.map((action, index) => (
            <div key={action.id}>
              <span>{index + 1}</span>
              <div>
                <strong>{action.title}</strong>
                <small>{action.privileged ? "Terminal approval required" : action.category}</small>
              </div>
            </div>
          ))}
        </div>
        {response.requiresTerminal ? (
          <div>
            <div className="terminal-explanation">
              <span>Terminal approval required</span>
              <HelpTooltip helpKey="action.terminalPlan" label="Terminal approval" />
            </div>
            <div className="terminal-command">
              <code>{response.terminalCommand}</code>
              <ActionWithHelp helpKey="action.copyCommand" label="Copy command">
                <button onClick={() => navigator.clipboard.writeText(response.terminalCommand)}>
                  Copy
                </button>
              </ActionWithHelp>
            </div>
          </div>
        ) : (
          <ActionWithHelp helpKey="action.applyPlan" label="Apply plan">
            <button className="wide" onClick={onExecute} disabled={pending}>
              {pending ? "Applying…" : "Apply plan"}
            </button>
          </ActionWithHelp>
        )}
      </aside>
    </div>
  );
}

function LinksEditor({
  config,
  onSaved,
  onPlan,
}: {
  config: ConfigResponse;
  onSaved: () => void;
  onPlan: (request: PlanRequest) => void;
}) {
  const [links, setLinks] = useState(config.data.links.links);
  const [preview, setPreview] = useState<{ before: string; after: string } | null>(null);
  const payload = useMemo(() => ({ schemaVersion: 1 as const, links }), [links]);
  const previewMutation = useMutation({
    mutationFn: () =>
      api<{ before: string; after: string }>("/config/preview", {
        method: "POST",
        body: JSON.stringify({ domain: "links", data: payload, revision: config.revision }),
      }),
    onSuccess: setPreview,
  });
  const saveMutation = useMutation({
    mutationFn: () =>
      api<{ revision: string }>("/config/apply", {
        method: "POST",
        body: JSON.stringify({ domain: "links", data: payload, revision: config.revision }),
      }),
    onSuccess: () => {
      setPreview(null);
      onSaved();
    },
  });
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>Managed links</h2>
          <p>Existing paths are backed up before linking</p>
        </div>
        <div className="action-row">
          <ActionWithHelp helpKey="action.planLinks" label="Plan links">
            <button className="ghost" onClick={() => onPlan({ operation: "links" })}>
              Plan links
            </button>
          </ActionWithHelp>
          <ActionWithHelp helpKey="action.validatePreview" label="Preview link changes">
            <button onClick={() => previewMutation.mutate()}>Preview changes</button>
          </ActionWithHelp>
        </div>
      </div>
      <div className="link-list">
        {links.map((link, index) => (
          <article key={link.id}>
            <div className="link-toggle">
              <label className="switch">
                <input
                  type="checkbox"
                  aria-label={`${link.id} enabled`}
                  checked={link.enabled}
                  onChange={(event) =>
                    setLinks((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, enabled: event.target.checked } : item,
                      ),
                    )
                  }
                />
                <span />
              </label>
              <HelpTooltip helpKey="links.toggle" label={`${link.id} 활성화`} />
            </div>
            <div>
              <div className="link-title">
                <strong>{link.id}</strong>
                <ActionWithHelp helpKey="action.restoreLink" label={`${link.id} restore`}>
                  <button
                    className="ghost restore-button"
                    onClick={() => onPlan({ operation: "restore", linkId: link.id })}
                  >
                    Plan restore
                  </button>
                </ActionWithHelp>
              </div>
              <div className="link-field">
                <span className="label-with-help">
                  linkPath
                  <HelpTooltip helpKey="links.linkPath" label={`${link.id} linkPath`} />
                </span>
                <input
                  aria-label={`${link.id} linkPath`}
                  value={link.linkPath}
                  onChange={(event) =>
                    setLinks((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, linkPath: event.target.value } : item,
                      ),
                    )
                  }
                />
              </div>
              <div className="link-field">
                <span className="label-with-help">
                  targetPath
                  <HelpTooltip helpKey="links.targetPath" label={`${link.id} targetPath`} />
                </span>
                <input
                  aria-label={`${link.id} targetPath`}
                  value={link.targetPath}
                  onChange={(event) =>
                    setLinks((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, targetPath: event.target.value } : item,
                      ),
                    )
                  }
                />
              </div>
            </div>
          </article>
        ))}
      </div>
      {preview && (
        <div className="diff">
          <div>
            <h3>Before</h3>
            <pre>{preview.before}</pre>
          </div>
          <div>
            <h3>After</h3>
            <pre>{preview.after}</pre>
          </div>
          <ActionWithHelp helpKey="action.saveConfiguration" label="Save link configuration">
            <button className="wide" onClick={() => saveMutation.mutate()}>
              Save configuration
            </button>
          </ActionWithHelp>
        </div>
      )}
    </section>
  );
}

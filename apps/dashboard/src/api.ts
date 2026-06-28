const params = new URLSearchParams(window.location.search);
const queryToken = params.get("token");
if (queryToken) {
  sessionStorage.setItem("dev-env-token", queryToken);
  window.history.replaceState({}, "", window.location.pathname);
}
export const sessionToken = queryToken ?? sessionStorage.getItem("dev-env-token") ?? "";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-dev-env-token": sessionToken,
      ...init?.headers,
    },
  });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed: ${response.status}`);
  return body;
}

export type DoctorResult = {
  id: string;
  category: string;
  status: "pass" | "warning" | "failure" | "skipped";
  current: string;
  expected: string;
  fixable: boolean;
  recommendation?: string;
};

export type PlanResponse = {
  plan: {
    id: string;
    operation: string;
    machineId: string;
    warnings: string[];
    actions: Array<{ id: string; title: string; privileged: boolean; category: string }>;
  };
  requiresTerminal: boolean;
  terminalCommand: string;
};

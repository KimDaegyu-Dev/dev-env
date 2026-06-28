import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "./api";
import { fieldHelpKey, HelpTooltip, type HelpKey } from "./help";

export type ConfigDomain = "machines" | "packages" | "runtimes" | "links" | "checks";

type ConfigData = Record<ConfigDomain, unknown>;
type Preview = { before: string; after: string };

const domains: ConfigDomain[] = ["machines", "packages", "runtimes", "links", "checks"];
const domainHelpKeys: Record<ConfigDomain, HelpKey> = {
  machines: "config.domain.machines",
  packages: "config.domain.packages",
  runtimes: "config.domain.runtimes",
  links: "config.domain.links",
  checks: "config.domain.checks",
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function blankLike(value: unknown): unknown {
  if (typeof value === "string") return "";
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return false;
  if (Array.isArray(value)) return [];
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, blankLike(child)]));
  }
  return "";
}

function templateFor(path: Array<string | number>): unknown {
  const key = String(path.at(-1) ?? "");
  if (
    ["profiles", "vscodeProfiles", "checkArgs", "formatArgs"].includes(key) ||
    (key === "machines" && path.length > 1)
  ) {
    return "";
  }
  if (key === "machines") {
    return {
      id: "",
      selectors: { os: "linux", wsl: false },
      profiles: ["base"],
      vscodeProfiles: [],
      paths: {},
    };
  }
  if (key === "packages") {
    return { id: "", profiles: ["base"], providers: {} };
  }
  if (key === "links") {
    return {
      id: "",
      machines: [""],
      linkPath: "",
      targetPath: "",
      kind: "directory",
      enabled: false,
    };
  }
  if (key === "checks") {
    return { id: "", command: "", checkArgs: [], required: false };
  }
  return "";
}

function replaceAt(root: unknown, path: Array<string | number>, value: unknown): unknown {
  if (path.length === 0) return value;
  const output = clone(root);
  let cursor = output as Record<string | number, unknown>;
  for (let index = 0; index < path.length - 1; index += 1) {
    cursor = cursor[path[index] as string | number] as Record<string | number, unknown>;
  }
  cursor[path.at(-1) as string | number] = value;
  return output;
}

function labelFor(path: Array<string | number>) {
  return String(path.at(-1) ?? "value")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("-", " ");
}

function FieldLabel({ path }: { path: Array<string | number> }) {
  const helpKey = fieldHelpKey(path);
  const label = labelFor(path);
  return (
    <span className="label-with-help">
      {label}
      {helpKey && <HelpTooltip helpKey={helpKey} label={`${label} 필드`} />}
    </span>
  );
}

function optionalDefaults(value: Record<string, unknown>, path: Array<string | number>) {
  if (path.at(-1) === "selectors") return { hostname: "", wsl: false };
  if ("linkPath" in value && "targetPath" in value) return { windowsMode: "junction" };
  if ("checkArgs" in value && "command" in value) return { formatArgs: [] };
  return {} as Record<string, unknown>;
}

function RecordField({
  value,
  path,
  onChange,
}: {
  value: Record<string, unknown>;
  path: Array<string | number>;
  onChange: (path: Array<string | number>, value: unknown) => void;
}) {
  const [newKey, setNewKey] = useState("");
  const recordType = String(path.at(-1));
  const initialValue = recordType === "providers" ? { manager: "brew", id: "" } : "";
  return (
    <fieldset className="form-object">
      <legend>
        <FieldLabel path={path} />
      </legend>
      <div className="form-grid">
        {Object.entries(value).map(([key, child]) => (
          <div className="record-entry" key={key}>
            <ValueField value={child} path={[...path, key]} onChange={onChange} />
            <button
              className="icon danger-outline"
              aria-label={`Remove ${key}`}
              onClick={() =>
                onChange(
                  path,
                  Object.fromEntries(Object.entries(value).filter(([item]) => item !== key)),
                )
              }
            >
              −
            </button>
          </div>
        ))}
      </div>
      <div className="record-add">
        <input
          value={newKey}
          placeholder={recordType === "providers" ? "macos, windows or ubuntu" : "new key"}
          onChange={(event) => setNewKey(event.target.value)}
        />
        <span className="action-with-help">
          <button
            className="ghost"
            disabled={!newKey.trim() || Object.hasOwn(value, newKey.trim())}
            onClick={() => {
              onChange(path, { ...value, [newKey.trim()]: initialValue });
              setNewKey("");
            }}
          >
            Add key
          </button>
          <HelpTooltip helpKey="field.record" label={`${labelFor(path)} key 추가`} />
        </span>
      </div>
    </fieldset>
  );
}

function ValueField({
  value,
  path,
  onChange,
}: {
  value: unknown;
  path: Array<string | number>;
  onChange: (path: Array<string | number>, value: unknown) => void;
}) {
  if (typeof value === "boolean") {
    return (
      <div className="form-toggle">
        <input
          type="checkbox"
          aria-label={labelFor(path)}
          checked={value}
          onChange={(event) => onChange(path, event.target.checked)}
        />
        <FieldLabel path={path} />
      </div>
    );
  }

  if (typeof value === "string" || typeof value === "number") {
    const fieldName = String(path.at(-1));
    const choices: Record<string, string[]> = {
      os: ["macos", "windows", "linux"],
      manager: ["brew", "brew-cask", "winget", "apt"],
      kind: ["file", "directory"],
      windowsMode: ["symlink", "junction"],
    };
    if (typeof value === "string" && choices[fieldName]) {
      return (
        <div className="form-field">
          <FieldLabel path={path} />
          <select
            aria-label={labelFor(path)}
            value={value}
            onChange={(event) => onChange(path, event.target.value)}
          >
            {choices[fieldName].map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        </div>
      );
    }
    return (
      <div className="form-field">
        <FieldLabel path={path} />
        <input
          aria-label={labelFor(path)}
          type={typeof value === "number" ? "number" : "text"}
          value={value}
          onChange={(event) =>
            onChange(
              path,
              typeof value === "number" ? Number(event.target.value) : event.target.value,
            )
          }
        />
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <fieldset className="form-array">
        <legend>
          <FieldLabel path={path} />
        </legend>
        {value.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: schema arrays may contain scalar values without identifiers.
          <div className="form-array-item" key={`${String(path.at(-1))}-${index}`}>
            <ValueField value={item} path={[...path, index]} onChange={onChange} />
            <button
              className="icon danger-outline"
              aria-label={`Remove ${labelFor(path)} item ${index + 1}`}
              onClick={() =>
                onChange(
                  path,
                  value.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              −
            </button>
          </div>
        ))}
        <span className="action-with-help">
          <button
            className="ghost"
            onClick={() =>
              onChange(path, [...value, value.length > 0 ? blankLike(value[0]) : templateFor(path)])
            }
          >
            Add {labelFor(path)}
          </button>
          <HelpTooltip helpKey="field.array" label={`${labelFor(path)} 항목 추가`} />
        </span>
      </fieldset>
    );
  }

  if (value && typeof value === "object") {
    if (["tools", "paths", "providers"].includes(String(path.at(-1)))) {
      return (
        <RecordField value={value as Record<string, unknown>} path={path} onChange={onChange} />
      );
    }
    const objectValue = value as Record<string, unknown>;
    const optional = optionalDefaults(objectValue, path);
    return (
      <fieldset className="form-object">
        {path.length > 0 && (
          <legend>
            <FieldLabel path={path} />
          </legend>
        )}
        <div className="form-grid">
          {Object.entries(objectValue).map(([key, child]) =>
            key in optional ? (
              <div className="optional-config-field" key={key}>
                <ValueField value={child} path={[...path, key]} onChange={onChange} />
                <button
                  className="icon danger-outline"
                  aria-label={`Remove ${key}`}
                  onClick={() =>
                    onChange(
                      path,
                      Object.fromEntries(
                        Object.entries(objectValue).filter(([item]) => item !== key),
                      ),
                    )
                  }
                >
                  −
                </button>
              </div>
            ) : (
              <ValueField key={key} value={child} path={[...path, key]} onChange={onChange} />
            ),
          )}
          {Object.entries(optional)
            .filter(([key]) => !(key in objectValue))
            .map(([key, defaultValue]) => (
              <span className="action-with-help add-optional" key={key}>
                <button
                  className="ghost"
                  onClick={() => onChange(path, { ...objectValue, [key]: defaultValue })}
                >
                  Add {labelFor([key])}
                </button>
                <HelpTooltip helpKey="field.optional" label={`${labelFor([key])} 필드 추가`} />
              </span>
            ))}
        </div>
      </fieldset>
    );
  }

  return null;
}

export function StructuredConfigEditor({
  revision,
  data,
  onSaved,
}: {
  revision: string;
  data: ConfigData;
  onSaved: () => void;
}) {
  const [domain, setDomain] = useState<ConfigDomain>("machines");
  const [draft, setDraft] = useState<unknown>(() => clone(data.machines));
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    setDraft(clone(data[domain]));
    setPreview(null);
  }, [data, domain]);

  const previewMutation = useMutation({
    mutationFn: () =>
      api<Preview>("/config/preview", {
        method: "POST",
        body: JSON.stringify({ domain, data: draft, revision }),
      }),
    onSuccess: setPreview,
  });
  const saveMutation = useMutation({
    mutationFn: () =>
      api<{ revision: string }>("/config/apply", {
        method: "POST",
        body: JSON.stringify({ domain, data: draft, revision }),
      }),
    onSuccess: () => {
      setPreview(null);
      onSaved();
    },
  });

  const error = previewMutation.error ?? saveMutation.error;

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>Structured configuration</h2>
          <p>Schema-validated forms · revision {revision.slice(0, 12)}</p>
        </div>
        <span className="action-with-help">
          <button onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
            {previewMutation.isPending ? "Validating…" : "Validate & preview"}
          </button>
          <HelpTooltip helpKey="action.validatePreview" label="Validate & preview" />
        </span>
      </div>
      <div className="domain-tabs-row">
        <div className="domain-tabs">
          {domains.map((item) => (
            <button
              className={domain === item ? "active" : "ghost"}
              key={item}
              onClick={() => setDomain(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <HelpTooltip helpKey={domainHelpKeys[domain]} label={`${domain} 설정`} />
      </div>
      <div className="config-form">
        <ValueField
          value={draft}
          path={[]}
          onChange={(fieldPath, value) => {
            setDraft((current: unknown) => replaceAt(current, fieldPath, value));
            setPreview(null);
          }}
        />
      </div>
      {error && <p className="form-error">{String(error)}</p>}
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
          <span className="action-with-help diff-save">
            <button
              className="wide"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save configuration"}
            </button>
            <HelpTooltip helpKey="action.saveConfiguration" label="Save configuration" />
          </span>
        </div>
      )}
    </section>
  );
}

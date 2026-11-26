// CLI 动作编辑器：编辑动作 id、标题、说明、只读、超时与 argv（每行一个参数，对象行写 JSON），以及参数表。
import type { CliActionConfig, CliParamConfig, CliParamType } from "@lfaa/connectors/contract";
import { SettingSegmented, SettingSwitch, settingsStyles as base } from "@lfaa/ui-primitives/client";
import type { ConnectorLabels } from "../locales";
import styles from "./Connectors-Settings.module.css";

export interface CliActionDraft extends Omit<CliActionConfig, "argv"> {
  /** 每行一个参数；对象形式（when/value）直接写 JSON。 */
  argvText: string;
}

const PARAM_TYPES: Array<{ value: CliParamType; label: string }> = [
  { value: "string", label: "string" },
  { value: "number", label: "number" },
  { value: "boolean", label: "boolean" },
];

/** 参数表编辑：改名时重建对象，保持声明顺序。 */
function withParam(params: Record<string, CliParamConfig>, previous: string, next: string, patch: Partial<CliParamConfig>): Record<string, CliParamConfig> {
  const result: Record<string, CliParamConfig> = {};
  for (const [name, param] of Object.entries(params)) {
    const key = name === previous ? next : name;
    result[key] = name === previous ? { ...param, ...patch } : param;
  }
  return result;
}

function withoutParam(params: Record<string, CliParamConfig>, name: string): Record<string, CliParamConfig> {
  const result: Record<string, CliParamConfig> = {};
  for (const [key, param] of Object.entries(params)) if (key !== name) result[key] = param;
  return result;
}

export function CliActionEditor({ draft, labels, onChange, onRemove }: {
  draft: CliActionDraft;
  labels: ConnectorLabels["cli"];
  onChange: (next: CliActionDraft) => void;
  onRemove: () => void;
}) {
  const rows = Object.entries(draft.params);
  return (
    <div className={styles.actionCard}>
      <header className={styles.actionHead}>
        <strong>{draft.title || draft.id || labels.actions}</strong>
        <button type="button" className={base.ghostBtn} onClick={onRemove}>{labels.remove}</button>
      </header>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span>{labels.actionId}</span>
          <input className={base.input} value={draft.id} maxLength={40} onChange={(event) => onChange({ ...draft, id: event.target.value })} />
        </label>
        <label className={styles.field}>
          <span>{labels.actionTitle}</span>
          <input className={base.input} value={draft.title} maxLength={120} onChange={(event) => onChange({ ...draft, title: event.target.value })} />
        </label>
      </div>
      <label className={styles.field}>
        <span>{labels.actionDescription}</span>
        <input className={base.input} value={draft.description} maxLength={400} onChange={(event) => onChange({ ...draft, description: event.target.value })} />
      </label>
      <div className={styles.inlineRow}>
        <span className={styles.inlineLabel}>{labels.readOnly}</span>
        <SettingSwitch checked={draft.readOnly} label={`${labels.readOnly} ${draft.id}`} onChange={(readOnly) => onChange({ ...draft, readOnly })} />
        <label className={styles.fieldInline}>
          <span>{labels.timeout}</span>
          <input
            className={base.input}
            type="number"
            min={1000}
            max={300000}
            step={1000}
            value={draft.timeoutMs ?? ""}
            placeholder="60000"
            onChange={(event) => {
              const value = event.target.value.trim();
              onChange({ ...draft, ...(value ? { timeoutMs: Number(value) } : {}) });
            }}
          />
        </label>
      </div>
      <div className={styles.inlineRow}>
        <span className={styles.inlineLabel}>{labels.trust}</span>
        <SettingSegmented<"inherit" | "ask" | "trusted">
          value={draft.trust ?? "inherit"}
          label={`${labels.trust} ${draft.id}`}
          options={[
            { value: "inherit", label: labels.inheritTrust },
            { value: "ask", label: labels.ask },
            { value: "trusted", label: labels.trusted },
          ]}
          onChange={(value) => {
            const next = { ...draft };
            if (value === "inherit") delete next.trust;
            else next.trust = value;
            onChange(next);
          }}
        />
      </div>
      <label className={styles.field}>
        <span>{labels.argv}</span>
        <textarea
          className={`${base.input} ${styles.args}`}
          rows={3}
          value={draft.argvText}
          placeholder={"pr list --json number,title\n{\"arg\":\"--state\",\"value\":\"{{state}}\"}"}
          onChange={(event) => onChange({ ...draft, argvText: event.target.value })}
        />
        <small className={styles.hint}>{labels.argvHint}</small>
      </label>
      <div className={styles.paramBlock}>
        <span className={styles.inlineLabel}>{labels.params}</span>
        {rows.map(([name, param]) => (
          <div className={styles.paramRow} key={name}>
            <input
              className={base.input}
              aria-label={`${labels.paramName} ${name}`}
              value={name}
              maxLength={32}
              onChange={(event) => onChange({ ...draft, params: withParam(draft.params, name, event.target.value.trim(), {}) })}
            />
            <select
              className={base.input}
              aria-label={`${labels.paramType} ${name}`}
              value={param.type}
              onChange={(event) => onChange({ ...draft, params: withParam(draft.params, name, name, { type: event.target.value as CliParamType }) })}
            >
              {PARAM_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input
              className={base.input}
              aria-label={`${labels.paramDescription} ${name}`}
              value={param.description}
              maxLength={200}
              placeholder={labels.paramDescription}
              onChange={(event) => onChange({ ...draft, params: withParam(draft.params, name, name, { description: event.target.value }) })}
            />
            <input
              className={base.input}
              aria-label={`${labels.paramEnum} ${name}`}
              value={param.enum?.join(", ") ?? ""}
              placeholder={labels.paramEnum}
              disabled={param.type !== "string"}
              onChange={(event) => {
                const values = event.target.value.split(",").map((item) => item.trim()).filter(Boolean);
                const patch: Partial<CliParamConfig> = values.length > 0 ? { enum: values } : {};
                onChange({ ...draft, params: withParam(draft.params, name, name, patch) });
              }}
            />
            <label className={styles.required}>
              <input
                type="checkbox"
                checked={param.required === true}
                onChange={(event) => onChange({ ...draft, params: withParam(draft.params, name, name, { required: event.target.checked }) })}
              />
              {labels.paramRequired}
            </label>
            <button type="button" className={base.ghostBtn} aria-label={`${labels.removeParam} ${name}`} onClick={() => onChange({ ...draft, params: withoutParam(draft.params, name) })}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className={base.actionBtn} onClick={() => onChange({ ...draft, params: { ...draft.params, [`param${rows.length + 1}`]: { type: "string", description: "" } } })}>
          {labels.addParam}
        </button>
      </div>
    </div>
  );
}
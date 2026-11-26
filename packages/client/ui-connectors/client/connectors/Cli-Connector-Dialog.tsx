// CLI 连接器编辑弹窗：模板预填、可执行文件探测、工作目录、环境变量、审批与动作列表。
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { CliActionConfig, CliArgConfig, CliConnectorConfig, ConnectorTemplate } from "@lfaa/connectors/contract";
import { SettingSegmented, settingsStyles as base } from "@lfaa/ui-primitives/client";
import { connectorsApi, pickWorkingDirectory, type CliConnectorPayload } from "../api/connectors-client";
import type { ConnectorLabels } from "../locales";
import { CliActionEditor, type CliActionDraft } from "./Cli-Action-Editor";
import styles from "./Connectors-Settings.module.css";

const CONNECTOR_ID = /^[a-z][a-z0-9-]{0,39}$/u;

function argvToText(argv: readonly CliArgConfig[]): string {
  return argv.map((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry))).join("\n");
}

/** 每行一个参数：以 `{"` 开头的行按 JSON 对象解析，`{{param}}` 这类占位符保持字面量。 */
function textToArgv(value: string): CliArgConfig[] {
  return value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).map((line) => {
    if (!/^\{\s*"/u.test(line)) return line;
    const parsed = JSON.parse(line) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.arg !== "string") throw new Error("invalid argv line");
    return parsed as unknown as CliArgConfig;
  });
}

function toDraft(action: CliActionConfig): CliActionDraft {
  return {
    id: action.id,
    title: action.title,
    description: action.description,
    readOnly: action.readOnly,
    ...(action.trust ? { trust: action.trust } : {}),
    params: structuredClone(action.params),
    argvText: argvToText(action.argv),
    ...(action.timeoutMs ? { timeoutMs: action.timeoutMs } : {}),
  };
}

const BLANK_ACTION: CliActionDraft = { id: "run", title: "", description: "", readOnly: true, params: {}, argvText: "" };

/** 由模板或已有配置填充表单；模板只预填，不安装任何软件。 */
function draftFrom(source?: CliConnectorConfig) {
  return {
    id: source?.id ?? "",
    name: source?.name ?? "",
    description: source?.description ?? "",
    executable: source?.executable ?? "",
    cwd: source?.cwd ?? "",
    envText: source && Object.keys(source.env).length > 0 ? JSON.stringify(source.env, null, 2) : "",
    trust: source?.trust ?? "ask" as "ask" | "trusted",
    actions: source?.actions.map(toDraft) ?? [],
  };
}

export function CliConnectorDialog({ mode, connector, templates, labels, busy, error, onClose, onSave }: {
  mode: "add" | "edit";
  connector?: CliConnectorConfig;
  templates: ConnectorTemplate[];
  labels: ConnectorLabels;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: CliConnectorPayload) => void;
}) {
  const cli = labels.cli;
  const [draft, setDraft] = useState(() => draftFrom(connector));
  const [templateId, setTemplateId] = useState("");
  const [probing, setProbing] = useState(false);
  const [probeMessage, setProbeMessage] = useState("");
  const [validation, setValidation] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    setDraft(draftFrom(template?.connector));
    setProbeMessage("");
    setValidation("");
  };

  const probe = async () => {
    if (!draft.executable.trim() || probing) return;
    setProbing(true);
    setProbeMessage("");
    try {
      const { result } = await connectorsApi.probe(draft.executable.trim());
      setProbeMessage(result.error ? cli.probeFailed(result.error) : cli.probeOk(result.path ?? "", result.version ?? ""));
    } catch (failure) {
      setProbeMessage(cli.probeFailed(failure instanceof Error ? failure.message : labels.failed));
    } finally {
      setProbing(false);
    }
  };

  const chooseCwd = async () => {
    const picked = await pickWorkingDirectory(draft.cwd || undefined);
    if (picked.error) setValidation(picked.error);
    else if (!picked.cancelled && picked.path) setDraft((current) => ({ ...current, cwd: picked.path ?? "" }));
  };

  const patchAction = (index: number, next: CliActionDraft) => {
    setDraft((current) => ({ ...current, actions: current.actions.map((action, position) => position === index ? next : action) }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidation("");
    try {
      const id = draft.id.trim();
      if (mode === "add" && !CONNECTOR_ID.test(id)) throw new Error(cli.idHint);
      if (!draft.name.trim() || !draft.executable.trim()) throw new Error(cli.required);
      if (draft.actions.length === 0) throw new Error(cli.noActions);
      let env: Record<string, string> = {};
      if (draft.envText.trim()) {
        const parsed: unknown = JSON.parse(draft.envText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(cli.invalidJson);
        env = Object.fromEntries(Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value)]));
      }
      const actions: CliActionConfig[] = draft.actions.map((action) => ({
        id: action.id.trim(),
        title: action.title.trim() || action.id.trim(),
        description: action.description.trim(),
        readOnly: action.readOnly,
        params: action.params,
        ...(action.trust ? { trust: action.trust } : {}),
        ...(action.timeoutMs ? { timeoutMs: action.timeoutMs } : {}),
        argv: textToArgv(action.argvText),
      }));
      onSave({
        ...(mode === "add" ? { id } : {}),
        name: draft.name.trim(),
        description: draft.description.trim(),
        executable: draft.executable.trim(),
        cwd: draft.cwd.trim(),
        env,
        trust: draft.trust,
        enabled: connector?.enabled ?? true,
        projectId: connector?.projectId ?? null,
        probeArgs: connector?.probeArgs ?? ["--version"],
        actions,
      });
    } catch (failure) {
      const message = failure instanceof SyntaxError ? cli.invalidArgv : failure instanceof Error ? failure.message : labels.failed;
      setValidation(message);
    }
  };

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={heading}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); if (!busy) onClose(); }}
      onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }}
    >
      <form className={styles.form} onSubmit={submit}>
        <h2 id={heading}>{mode === "add" ? cli.create : cli.editTitle(connector?.name ?? "")}</h2>
        {mode === "add" && (
          <div className={styles.templateRow}>
            <span className={styles.inlineLabel}>{cli.template}</span>
            <button type="button" className={templateId === "" ? `${base.actionBtn} ${styles.active}` : base.actionBtn} onClick={() => applyTemplate("")}>{cli.blank}</button>
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={templateId === template.id ? `${base.actionBtn} ${styles.active}` : base.actionBtn}
                title={template.description}
                onClick={() => applyTemplate(template.id)}
              >
                {template.name}
              </button>
            ))}
            <small className={styles.hint}>{cli.templateHelp}</small>
          </div>
        )}
        <div className={styles.fields}>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>{cli.id}</span>
              <input className={base.input} value={draft.id} maxLength={40} disabled={mode === "edit"} onChange={(event) => setDraft({ ...draft, id: event.target.value })} />
              <small className={styles.hint}>{cli.idHint}</small>
            </label>
            <label className={styles.field}>
              <span>{cli.name}</span>
              <input className={base.input} value={draft.name} maxLength={120} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
          </div>
          <label className={styles.field}>
            <span>{cli.description}</span>
            <input className={base.input} value={draft.description} maxLength={400} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </label>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>{cli.executable}</span>
              <div className={styles.probeRow}>
                <input className={base.input} value={draft.executable} maxLength={512} placeholder="gh" onChange={(event) => setDraft({ ...draft, executable: event.target.value })} />
                <button type="button" className={base.actionBtn} disabled={probing} onClick={() => void probe()}>{probing ? cli.probing : cli.probe}</button>
              </div>
              <small className={styles.hint}>{probeMessage || cli.executableHint}</small>
            </label>
            <label className={styles.field}>
              <span>{cli.cwd}</span>
              <div className={styles.probeRow}>
                <input className={base.input} value={draft.cwd} onChange={(event) => setDraft({ ...draft, cwd: event.target.value })} />
                <button type="button" className={base.actionBtn} onClick={() => void chooseCwd()}>{cli.pickCwd}</button>
              </div>
              <small className={styles.hint}>{cli.cwdHint}</small>
            </label>
          </div>
          <label className={styles.field}>
            <span>{cli.env}</span>
            <textarea className={base.input} rows={3} value={draft.envText} placeholder="{}" onChange={(event) => setDraft({ ...draft, envText: event.target.value })} />
            <small className={styles.hint}>{cli.envHint}</small>
          </label>
          <div className={styles.inlineRow}>
            <span className={styles.inlineLabel}>{cli.trust}</span>
            <SettingSegmented<"ask" | "trusted">
              value={draft.trust}
              label={cli.trust}
              options={[{ value: "ask", label: cli.ask }, { value: "trusted", label: cli.trusted }]}
              onChange={(trust) => setDraft({ ...draft, trust })}
            />
          </div>
          <div className={styles.actionList}>
            <span className={styles.inlineLabel}>{cli.actions}</span>
            {draft.actions.map((action, index) => (
              <CliActionEditor
                key={index}
                draft={action}
                labels={cli}
                onChange={(next) => patchAction(index, next)}
                onRemove={() => setDraft((current) => ({ ...current, actions: current.actions.filter((_, position) => position !== index) }))}
              />
            ))}
            <button type="button" className={base.actionBtn} onClick={() => setDraft((current) => ({ ...current, actions: [...current.actions, { ...structuredClone(BLANK_ACTION), id: `action${current.actions.length + 1}` }] }))}>
              {cli.addAction}
            </button>
          </div>
        </div>
        {(validation || error) && <p role="alert" className={styles.error}>{validation || error}</p>}
        <footer className={styles.actions}>
          <button type="button" className={base.actionBtn} onClick={onClose} disabled={busy}>{labels.mcp.cancel}</button>
          <button type="submit" className={`${base.actionBtn} ${styles.active}`} disabled={busy}>{labels.mcp.save}</button>
        </footer>
      </form>
    </dialog>
  );
}
// 设置中心内的 MCP 录入弹窗，使用浏览器顶层避免被设置中心遮住。
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { SettingFormField, settingsStyles as base } from "@lfaa/ui-primitives/client";
import type { McpServerSummary, McpTransport } from "@lfaa/mcp/contract";
import type { McpLabels } from "../locales";
import styles from "./Mcp-Settings.module.css";

export type McpEditor = { kind: "add" | "import" } | { kind: "edit"; server: McpServerSummary };

export function McpDialog({ editor, labels, busy, error, onClose, onSave }: {
  editor: McpEditor;
  labels: McpLabels;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: unknown) => void;
}) {
  const previous = editor.kind === "edit" ? editor.server : undefined;
  const [transport, setTransport] = useState<McpTransport>(previous?.transport ?? "stdio");
  const [validation, setValidation] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidation("");
    const values = new FormData(event.currentTarget);
    const field = (key: string) => String(values.get(key) ?? "").trim();
    try {
      if (editor.kind === "import") {
        onSave(JSON.parse(field("import")));
        return;
      }
      const payload: Record<string, unknown> = { transport };
      if (!previous) payload.id = field("id");
      for (const name of ["command", "url"]) if (field(name)) payload[name] = field(name);
      for (const name of ["args", "env", "headers"]) if (field(name)) payload[name] = JSON.parse(field(name));
      onSave(payload);
    } catch {
      setValidation(labels.invalidJson);
    }
  };

  const keep = previous?.transport === transport ? labels.keep : undefined;
  const hint = keep ? { hint: keep } : {};

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={heading}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); if (!busy) onClose(); }}
      onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }}
    >
      <form className={styles.form} onSubmit={submit}>
        <h2 id={heading}>{editor.kind === "edit" ? `${labels.edit} · ${editor.server.id}` : labels[editor.kind]}</h2>
        <div className={styles.fields}>
          {editor.kind === "import" ? (
            <SettingFormField label={labels.import} hint={labels.importHelp}>
              <textarea name="import" className={base.input} placeholder={'{"mcpServers": {}}'} autoComplete="off" required rows={8} />
            </SettingFormField>
          ) : (
            <>
              {!previous && <SettingFormField label={labels.id}><input name="id" className={base.input} maxLength={80} required /></SettingFormField>}
              <SettingFormField label={labels.transport}>
                <select name="transport" value={transport} className={base.input} onChange={(event) => setTransport(event.target.value as McpTransport)}>
                  <option value="stdio">Stdio</option>
                  <option value="http">Streamable HTTP</option>
                  <option value="sse">SSE</option>
                </select>
              </SettingFormField>
              {transport === "stdio" ? (
                <>
                  <SettingFormField label={labels.command} hint={keep ?? labels.commandHint}>
                    <input name="command" className={base.input} autoComplete="off" required={!keep} />
                  </SettingFormField>
                  <SettingFormField label={labels.args} {...hint}>
                    <textarea name="args" className={base.input} placeholder="[]" autoComplete="off" rows={2} />
                  </SettingFormField>
                  <SettingFormField label={labels.env} {...hint}>
                    <textarea name="env" className={base.input} placeholder="{}" autoComplete="off" rows={2} />
                  </SettingFormField>
                </>
              ) : (
                <>
                  <SettingFormField label={labels.url} {...hint}>
                    <input type="url" name="url" className={base.input} autoComplete="off" required={!keep} />
                  </SettingFormField>
                  <SettingFormField label={labels.headers} {...hint}>
                    <textarea name="headers" className={base.input} placeholder="{}" autoComplete="off" rows={3} />
                  </SettingFormField>
                </>
              )}
            </>
          )}
        </div>
        {(validation || error) && <p role="alert" className={styles.error}>{validation || error}</p>}
        <footer className={styles.actions}>
          <button type="button" className={base.actionBtn} onClick={onClose} disabled={busy}>{labels.cancel}</button>
          <button type="submit" className={`${base.actionBtn} ${styles.emphasized}`} disabled={busy}>{editor.kind === "import" ? labels.import : labels.save}</button>
        </footer>
      </form>
    </dialog>
  );
}

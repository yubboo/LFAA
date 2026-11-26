// 目录连接弹窗：只渲染条目声明的输入项（目录 / 令牌 / 连接串），提交后由宿主后台任务安装并连接。
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { CatalogItem } from "@lfaa/connectors/contract";
import { settingsStyles as base } from "@lfaa/ui-primitives/client";
import { pickWorkingDirectory } from "../api/connectors-client";
import type { ConnectorLabels } from "../locales";
import styles from "./Connectors-Settings.module.css";

export function ConnectorConnectDialog({ item, labels, busy, error, onClose, onSubmit }: {
  item: CatalogItem;
  labels: ConnectorLabels;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (inputs: Record<string, string>) => void;
}) {
  const cli = labels.directory;
  const inputs = item.inputs ?? [];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(inputs.map((input) => [input.key, ""])));
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const pick = async (key: string) => {
    const result = await pickWorkingDirectory(values[key] || undefined);
    if (!result.cancelled && result.path) setValues((current) => ({ ...current, [key]: result.path ?? "" }));
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(values);
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
        <h2 id={heading}>{cli.connectTitle(item.name)}</h2>
        <div className={styles.fields}>
          {inputs.map((input) => (
            <label key={input.key} className={styles.field}>
              <span>{input.label}</span>
              {input.kind === "directory"
                ? (
                  <span className={styles.probeRow}>
                    <input className={base.input} value={values[input.key] ?? ""} placeholder={input.placeholder} onChange={(event) => setValues({ ...values, [input.key]: event.target.value })} required={input.required} />
                    <button type="button" className={base.actionBtn} onClick={() => void pick(input.key)}>选择…</button>
                  </span>
                )
                : (
                  <input
                    className={base.input}
                    type={input.kind === "password" ? "password" : "text"}
                    autoComplete="off"
                    value={values[input.key] ?? ""}
                    placeholder={input.placeholder}
                    onChange={(event) => setValues({ ...values, [input.key]: event.target.value })}
                    required={input.required}
                  />
                )}
            </label>
          ))}
          <small className={styles.hint}>{cli.inputHint}</small>
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <footer className={styles.actions}>
          <button type="button" className={base.actionBtn} onClick={onClose} disabled={busy}>{labels.mcp.cancel}</button>
          <button type="submit" className={`${base.actionBtn} ${styles.active}`} disabled={busy}>{busy ? cli.connecting : cli.confirm}</button>
        </footer>
      </form>
    </dialog>
  );
}
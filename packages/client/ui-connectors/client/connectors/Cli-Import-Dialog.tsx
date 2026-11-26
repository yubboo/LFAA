// 导入连接器弹窗：粘贴导出的 JSON（单个对象 / 数组 / connectors 数组），由宿主校验并以停用状态导入。
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { settingsStyles as base } from "@lfaa/ui-primitives/client";
import type { ConnectorLabels } from "../locales";
import styles from "./Connectors-Settings.module.css";

export function CliImportDialog({ labels, busy, error, onClose, onImport }: {
  labels: ConnectorLabels;
  busy: boolean;
  error: string;
  onClose: () => void;
  onImport: (payload: unknown) => void;
}) {
  const cli = labels.cli;
  const [text, setText] = useState("");
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
    try {
      onImport(JSON.parse(text));
    } catch {
      setValidation(cli.importInvalid);
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
        <h2 id={heading}>{cli.importTitle}</h2>
        <div className={styles.fields}>
          <label className={styles.field}>
            <span>JSON</span>
            <textarea
              className={`${base.input} ${styles.args}`}
              rows={10}
              value={text}
              placeholder={'{"connectors": [{"id": "gh", ...}]}'}
              onChange={(event) => setText(event.target.value)}
              required
            />
            <small className={styles.hint}>{cli.importHelp}</small>
          </label>
        </div>
        {(validation || error) && <p role="alert" className={styles.error}>{validation || error}</p>}
        <footer className={styles.actions}>
          <button type="button" className={base.actionBtn} onClick={onClose} disabled={busy}>{labels.mcp.cancel}</button>
          <button type="submit" className={`${base.actionBtn} ${styles.active}`} disabled={busy}>{cli.import}</button>
        </footer>
      </form>
    </dialog>
  );
}
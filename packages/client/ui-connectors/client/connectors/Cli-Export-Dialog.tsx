// 导出连接器弹窗：展示可复制的 JSON（含环境变量字面值，界面明确提示）并提供下载。
import { useEffect, useId, useRef, useState } from "react";
import type { CliConnectorConfig } from "@lfaa/connectors/contract";
import { settingsStyles as base } from "@lfaa/ui-primitives/client";
import type { ConnectorLabels } from "../locales";
import styles from "./Connectors-Settings.module.css";

export function CliExportDialog({ connector, labels, onClose }: {
  connector: CliConnectorConfig;
  labels: ConnectorLabels;
  onClose: () => void;
}) {
  const cli = labels.cli;
  const json = JSON.stringify(connector, null, 2);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${connector.id}.connector.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={heading}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
      onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }}
    >
      <form className={styles.form} onSubmit={(event) => { event.preventDefault(); onClose(); }}>
        <h2 id={heading}>{cli.exportTitle(connector.name)}</h2>
        <div className={styles.fields}>
          <label className={styles.field}>
            <span>JSON</span>
            <textarea className={`${base.input} ${styles.args}`} rows={12} value={json} readOnly />
            <small className={styles.hint}>{cli.exportHint}</small>
          </label>
        </div>
        <footer className={styles.actions}>
          <button type="button" className={base.actionBtn} onClick={() => void copy()}>{copied ? cli.copied : cli.copy}</button>
          <button type="button" className={base.actionBtn} onClick={download}>{cli.download}</button>
          <button type="submit" className={`${base.actionBtn} ${styles.active}`}>{labels.mcp.close}</button>
        </footer>
      </form>
    </dialog>
  );
}
// 目录条目详情：连接状态、示例提示、使用的应用与关于信息，卸载放在底部危险操作。
import { useEffect, useId, useRef, useState } from "react";
import type { CatalogItem } from "@lfaa/connectors/contract";
import { settingsStyles as base } from "@lfaa/ui-primitives/client";
import { connectorsApi } from "../api/connectors-client";
import type { ConnectorLabels } from "../locales";
import dir from "./Connectors-Directory.module.css";
import styles from "./Connectors-Settings.module.css";

export function ConnectorDetailDialog({ item, labels, busy, onClose, onConnect, onUninstall, onTry, onSettings }: {
  item: CatalogItem;
  labels: ConnectorLabels;
  busy: boolean;
  onClose: () => void;
  onConnect: (item: CatalogItem) => void;
  onUninstall: (item: CatalogItem) => void;
  onTry: (text: string) => void;
  onSettings: (item: CatalogItem) => void;
}) {
  const cli = labels.directory;
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [tested, setTested] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const command = item.kind === "mcp" ? item.mcp?.command ?? item.mcp?.url ?? "MCP" : item.cli?.executable ?? "CLI";
  const runTest = () => {
    setTested(cli.testRunning);
    void connectorsApi.test(item.id)
      .then(({ result }) => setTested(result.ok ? (result.detail || cli.connected) : `✕ ${result.detail ?? ""}`))
      .catch((failure: unknown) => setTested(failure instanceof Error ? failure.message : "✕"));
  };
  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${dir.detail}`}
      aria-labelledby={heading}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
      onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }}
    >
      <div className={styles.form}>
        <header className={dir.detailHead}>
          <span className={dir.detailGlyph} aria-hidden="true">{item.glyph}</span>
          <div>
            <h2 id={heading}>{item.name}</h2>
            <p className={styles.hint}>{item.description}</p>
          </div>
        </header>
        <div className={styles.inlineRow}>
          {item.connected
            ? (
              <>
                <button type="button" className={`${base.actionBtn} ${styles.active}`} onClick={() => onSettings(item)}>{cli.settings}</button>
                <span className={styles.status} data-status={item.status}>{cli.connected}</span>
              </>
            )
            : <button type="button" className={`${base.actionBtn} ${styles.active}`} disabled={busy} onClick={() => onConnect(item)}>{cli.connect}</button>}
        </div>
        <div className={styles.fields}>
          <section className={dir.detailSection}>
            <h3>{cli.examples}</h3>
            <ul className={dir.detailList}>
              {item.examples.map((example) => (
                <li key={example}>
                  <button type="button" className={dir.example} onClick={() => onTry(example)}>{example}</button>
                </li>
              ))}
            </ul>
          </section>
          <section className={dir.detailSection}>
            <h3>{cli.apps}</h3>
            <code className={dir.example}>{command}</code>
            <p className={styles.hint}>{`${item.toolCount} ${cli.toolsUnit}`}</p>
            {item.kind === "cli" && item.connected && (
              <div className={styles.inlineRow}>
                <button type="button" className={base.actionBtn} onClick={runTest}>{cli.test}</button>
                {tested && <span className={styles.hint}>{tested}</span>}
              </div>
            )}
          </section>
          <section className={dir.detailSection}>
            <h3>{cli.about}</h3>
            <dl className={dir.aboutGrid}>
              <dt>{cli.category}</dt><dd>{item.kind === "mcp" ? cli.mcpKind : cli.cliKind} · {cli[item.category]}</dd>
              <dt>{cli.publisher}</dt><dd>{item.publisher}</dd>
              <dt>{cli.version}</dt><dd>{item.version}</dd>
              <dt>{cli.website}</dt><dd>{item.website}</dd>
            </dl>
          </section>
        </div>
        <footer className={styles.actions}>
          {item.connected && <button type="button" className={`${base.actionBtn} ${dir.dangerAction}`} disabled={busy} onClick={() => onUninstall(item)}>{cli.uninstall}</button>}
          <button type="button" className={`${base.actionBtn} ${styles.active}`} onClick={onClose}>{labels.mcp.close}</button>
        </footer>
      </div>
    </dialog>
  );
}
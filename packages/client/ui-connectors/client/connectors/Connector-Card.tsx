// 目录卡片：图标、名称、两行说明与类型标签，右下角是「+」或已连接状态。
import type { CatalogItem } from "@lfaa/connectors/contract";
import type { ConnectorLabels } from "../locales";
import styles from "./Connectors-Directory.module.css";

export function ConnectorCard({ item, labels, busy, onOpen, onConnect }: {
  item: CatalogItem;
  labels: ConnectorLabels;
  busy: boolean;
  onOpen: (item: CatalogItem) => void;
  onConnect: (item: CatalogItem) => void;
}) {
  const cli = labels.directory;
  return (
    <article className={styles.card} data-connected={item.connected ? "true" : undefined}>
      <button type="button" className={styles.cardBody} onClick={() => onOpen(item)} aria-label={`${item.name} ${cli.about}`}>
        <span className={styles.cardGlyph} aria-hidden="true">{item.glyph}</span>
        <span className={styles.cardName}>{item.name}</span>
        <span className={styles.cardDesc}>{item.description}</span>
        <span className={styles.cardKind}>{item.kind === "mcp" ? cli.mcpKind : cli.cliKind}</span>
        {item.connected && <span className={styles.cardKind}>{`${item.toolCount} ${cli.toolsUnit}`}</span>}
      </button>
      <div className={styles.cardActions}>
        {item.connected
          ? (
            <>
              <span className={styles.cardState} data-status={item.status} title={cli.connected} aria-label={cli.connected} />
              <button type="button" className={styles.cardMenu} onClick={() => onOpen(item)} aria-label={`${item.name} ${cli.settings}`}>···</button>
            </>
          )
          : item.status === "connecting" || busy
            ? <span className={styles.cardSpin} role="status" aria-label={cli.connecting} />
            : <button type="button" className={styles.cardAdd} onClick={() => onConnect(item)} aria-label={`${cli.connect} ${item.name}`}>+</button>}
      </div>
    </article>
  );
}
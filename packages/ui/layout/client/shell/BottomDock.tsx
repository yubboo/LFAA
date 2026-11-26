// Shell 底部面板容器：标签条 + 收起按钮，内容由插件通过 workbench.registerBottomPanel 贡献。
// v1 只有真实终端；高度固定并写入偏好，后续需要拖高时在这里接 SidebarResizeHandle。
import type { ReactNode } from "react";
import type { WorkbenchBottomPanelContribution } from "../../contract";
import styles from "./BottomDock.module.css";

export function BottomDock({
  panels,
  activeId,
  isZh,
  onSelect,
  onClose,
}: {
  panels: WorkbenchBottomPanelContribution<ReactNode>[];
  activeId: string | undefined;
  isZh: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const active = panels.find((panel) => panel.id === activeId) ?? panels[0];
  if (!active) return null;
  return (
    <section className={styles.dock} data-bottom-dock="true" aria-label={isZh ? "底部面板" : "Bottom panel"}>
      <header className={styles.bar}>
        <div className={styles.tabs} role="tablist" aria-label={isZh ? "底部面板标签" : "Bottom panel tabs"}>
          {panels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              role="tab"
              aria-selected={panel.id === active.id}
              className={`${styles.tab} ${panel.id === active.id ? styles.tabActive : ""}`}
              onClick={() => onSelect(panel.id)}
            >
              {panel.title}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.closeBtn}
          aria-label={isZh ? "收起底部面板" : "Collapse bottom panel"}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className={styles.body}>{active.render()}</div>
    </section>
  );
}
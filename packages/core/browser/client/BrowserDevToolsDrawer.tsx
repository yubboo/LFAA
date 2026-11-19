// 内置浏览器底部可折叠 DevTools 抽屉：按 Console 与 Network 分页查看页面异常与请求状态。
import { IconTrash, IconX } from "@tabler/icons-react";
import type { BrowserConsoleItem, BrowserNetworkItem } from "./browser-client";
import styles from "./RightBrowserPane.module.css";

export type DevToolsTab = "console" | "network";

export function BrowserDevToolsDrawer({
  isZh,
  activeTab,
  onChangeTab,
  consoleItems,
  networkItems,
  onClear,
  onClose,
}: {
  isZh: boolean;
  activeTab: DevToolsTab;
  onChangeTab: (tab: DevToolsTab) => void;
  consoleItems: BrowserConsoleItem[];
  networkItems: BrowserNetworkItem[];
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <section className={styles.devtools} aria-label="Browser DevTools">
      <div className={styles.devtoolsHeader}>
        <div className={styles.devtoolsTabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "console"}
            className={`${styles.devtoolsTab} ${activeTab === "console" ? styles.devtoolsTabActive : ""}`}
            onClick={() => onChangeTab("console")}
          >
            <span>Console ({consoleItems.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "network"}
            className={`${styles.devtoolsTab} ${activeTab === "network" ? styles.devtoolsTabActive : ""}`}
            onClick={() => onChangeTab("network")}
          >
            <span>Network ({networkItems.length})</span>
          </button>
        </div>
        <div className={styles.devtoolsActions}>
          <button type="button" className={styles.smallIconBtn} title={isZh ? "清空日志" : "Clear logs"} onClick={onClear}>
            <IconTrash size={13} />
          </button>
          <button type="button" className={styles.smallIconBtn} title={isZh ? "收起面板" : "Close"} onClick={onClose}>
            <IconX size={13} />
          </button>
        </div>
      </div>

      <div className={styles.devtoolsBody}>
        {activeTab === "console" ? (
          consoleItems.length === 0 ? (
            <div className={styles.emptyLog}>{isZh ? "暂无控制台日志或错误。" : "No console messages yet."}</div>
          ) : (
            consoleItems.slice(-60).map((item, idx) => (
              <div key={`${item.timestamp}-${idx}`} className={styles.logLine} data-level={item.level}>
                <span className={styles.logTag}>[{item.level}]</span>
                <span className={styles.logText}>{item.text}</span>
              </div>
            ))
          )
        ) : networkItems.length === 0 ? (
          <div className={styles.emptyLog}>{isZh ? "暂无网络请求记录。" : "No network requests captured yet."}</div>
        ) : (
          networkItems.slice(-60).map((item) => (
            <div key={item.id} className={styles.logLine} data-level={item.failed ? "error" : "log"}>
              <span className={styles.netMethod}>{item.method}</span>
              <span className={styles.netStatus} data-failed={item.failed ? "true" : undefined}>{item.status}</span>
              <span className={styles.logText} title={item.url}>{item.url}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

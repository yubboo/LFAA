// 内置浏览器顶部多标签栏：标签切换、关闭与新建；标签数据与激活/关闭操作由父组件传入。
import { IconPlus, IconWorld, IconX } from "@tabler/icons-react";
import type { BrowserTabItem } from "../api/browser-client";
import styles from "./RightBrowserPane.module.css";

export function BrowserTabs({
  tabs,
  isZh,
  onActivate,
  onClose,
  onNew,
}: {
  tabs: BrowserTabItem[];
  isZh: boolean;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onNew: () => void;
}) {
  return (
    <div className={styles.tabStrip} role="tablist" aria-label={isZh ? "浏览器标签页" : "Browser tabs"}>
      {tabs.map((tab) => (
        <div key={tab.tabId} className={`${styles.browserTab} ${tab.active ? styles.browserTabActive : ""}`}>
          <button
            type="button"
            role="tab"
            aria-selected={tab.active}
            className={styles.browserTabBtn}
            title={tab.url}
            onClick={() => onActivate(tab.tabId)}
          >
            <IconWorld size={12} aria-hidden="true" />
            <span>{tab.title || tab.url || (isZh ? "新标签页" : "New Tab")}</span>
          </button>
          <button
            type="button"
            className={styles.tabCloseBtn}
            aria-label={isZh ? "关闭标签" : "Close tab"}
            onClick={() => onClose(tab.tabId)}
          >
            <IconX size={11} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.newTabBtn}
        title={isZh ? "新建浏览器标签页" : "New browser tab"}
        onClick={onNew}
      >
        <IconPlus size={13} />
      </button>
    </div>
  );
}
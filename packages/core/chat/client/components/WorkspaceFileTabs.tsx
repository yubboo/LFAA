// 在右侧上下文区域承载可切换、可关闭的源文件标签。
import { useId, useRef, type KeyboardEvent } from "react";
import { IconFileCode, IconX } from "@tabler/icons-react";
import type { ChatClientStore } from "../chat-store";
import type { AgentStepItem, FilePreviewTab } from "../chat-types";
import { timelineMessages } from "../locales";
import { FileChangePreview } from "./FileChangePreview";
import styles from "./WorkspaceFileTabs.module.css";

export function WorkspaceFileTabs({ tabs, active, step, sessionId, projectId, isZh, store }: {
  tabs: FilePreviewTab[];
  active: FilePreviewTab;
  step: AgentStepItem;
  sessionId: string;
  projectId: string | null;
  isZh: boolean;
  store: ChatClientStore;
}) {
  const labels = timelineMessages[isZh ? "zh" : "en"];
  const base = useId();
  const tabStrip = useRef<HTMLDivElement>(null);
  const activeIndex = tabs.findIndex((tab) => tab.id === active.id);

  // 方向键和首尾键移动选中标签，行为与鼠标一致。
  const changeTab = (event: KeyboardEvent, index: number) => {
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
        : event.key === "ArrowRight" ? (index + 1) % tabs.length
          : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : -1;
    const next = tabs[nextIndex];
    if (!next) return;
    event.preventDefault();
    store.selectFilePreview(next.id);
    tabStrip.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  };

  return (
    <div className={styles.workspace}>
      <div ref={tabStrip} className={styles.tabs} role="tablist" aria-label={labels.fileTabs}>
        {tabs.map((tab, index) => {
          const selected = tab.id === active.id;
          const name = tab.path.split(/[\\/]/u).at(-1) || tab.path;
          return (
            <div key={tab.id} className={styles.tabGroup} data-selected={selected}>
              <button id={`${base}-${index}`} role="tab" type="button" className={styles.tab}
                aria-controls={`${base}-panel`} aria-selected={selected} tabIndex={selected ? 0 : -1}
                title={tab.path} onClick={() => store.selectFilePreview(tab.id)} onKeyDown={(event) => changeTab(event, index)}>
                <IconFileCode size={15} aria-hidden="true" />
                <span>{name}</span>
              </button>
              <button type="button" className={styles.close} aria-label={labels.closeTab(name)}
                onClick={() => store.closeFilePreview(tab.id)}>
                <IconX size={13} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
      <div id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-${activeIndex}`} className={styles.panel}>
        <FileChangePreview key={`${active.messageId}:${active.stepId}`} tab={active} step={step}
          sessionId={sessionId} projectId={projectId} isZh={isZh} store={store} />
      </div>
    </div>
  );
}

// 终端外壳：标题栏带「移到下方 / 移到右栏」切换，正文是真实终端面板；两处位置复用同一组件、同一个 PTY。
import { useEffect, useState } from "react";
import { TerminalPane } from "@lfaa/client-ui-terminal/client";
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import { readTerminalPlacement, subscribeTerminalPlacement, writeTerminalPlacement, type TerminalPlacement } from "./terminal-placement";
import styles from "./TerminalSurface.module.css";

export function TerminalSurface({
  sessionId,
  isZh,
  placement,
  workbench,
  onRequestRightTab,
  onClose,
}: {
  sessionId: string;
  isZh: boolean;
  /** 当前渲染位置：决定切换按钮的文案与目标。 */
  placement: TerminalPlacement;
  workbench: WorkbenchClientService;
  /** 切回右栏时由调用方把「终端」标签重新打开（底部面板没有标签栏可依赖）。 */
  onRequestRightTab?: () => void;
  /** 关闭当前终端（底部面板用它收起；右栏标签有自带的 ×）。 */
  onClose?: (() => void) | undefined;
}) {
  const [current, setCurrent] = useState<TerminalPlacement>(() => readTerminalPlacement());

  useEffect(() => subscribeTerminalPlacement(() => setCurrent(readTerminalPlacement())), []);

  const switchPlacement = () => {
    const next: TerminalPlacement = placement === "bottom" ? "right" : "bottom";
    writeTerminalPlacement(next);
    // 底部面板的展开状态由工作台服务持有：切到底部就展开，切回右栏就收起。
    workbench.setBottomPanelOpen(next === "bottom", true);
    if (next === "right") onRequestRightTab?.();
  };

  const label = placement === "bottom"
    ? (isZh ? "移到右栏" : "Move to right panel")
    : (isZh ? "移到下方" : "Move to bottom panel");

  return (
    <div className={styles.surface} data-terminal-placement={placement}>
      <header className={styles.bar}>
        <span className={styles.title}>{isZh ? "终端" : "Terminal"}</span>
        <span className={styles.hint}>{current === placement ? "" : ""}</span>
        <button type="button" className={styles.moveBtn} onClick={switchPlacement}>
          {label}
        </button>
        {onClose && (
          <button type="button" className={styles.closeBtn} aria-label={isZh ? "关闭终端" : "Close terminal"} onClick={onClose}>
            ×
          </button>
        )}
      </header>
      <div className={styles.body}>
        <TerminalPane sessionId={sessionId} isZh={isZh} />
      </div>
    </div>
  );
}
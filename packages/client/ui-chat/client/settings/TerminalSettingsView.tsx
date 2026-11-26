// 设置中心「终端」页：一行展示位置（右侧标签 / 底部面板），切换后立即生效并记住。
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import { readTerminalPlacement, writeTerminalPlacement, type TerminalPlacement } from "../workbench/terminal-placement";
import styles from "./TerminalSettingsView.module.css";

export function TerminalSettingsView({
  isZh,
  workbench,
}: {
  isZh: boolean;
  workbench: WorkbenchClientService;
}) {
  const placement = readTerminalPlacement();

  const apply = (next: TerminalPlacement) => {
    if (next === placement) return;
    writeTerminalPlacement(next);
    // 底部就展开底部面板；右栏就收起底部面板，入口回到右侧「终端」标签。
    workbench.setBottomPanelOpen(next === "bottom", true);
  };

  const options: Array<{ id: TerminalPlacement; label: string }> = [
    { id: "right", label: isZh ? "右侧面板" : "Right panel" },
    { id: "bottom", label: isZh ? "底部面板" : "Bottom panel" },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.group}>
        <h3 className={styles.groupTitle}>{isZh ? "终端" : "Terminal"}</h3>
        <div className={styles.row}>
          <div className={styles.text}>
            <span className={styles.label}>{isZh ? "展示位置" : "Position"}</span>
            <span className={styles.desc}>
              {isZh ? "右侧面板作为标签页，或铺在中间与右侧下方的底部面板" : "As a tab in the right panel, or a dock under the workspace"}
            </span>
          </div>
          <div className={styles.segment} role="radiogroup" aria-label={isZh ? "终端展示位置" : "Terminal position"}>
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={placement === option.id}
                className={`${styles.segmentBtn} ${placement === option.id ? styles.segmentBtnActive : ""}`}
                onClick={() => apply(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
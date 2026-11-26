// 最右侧垂直图标菜单栏：收纳工作区文件树、工作区上下文、后台任务、子智能体、侧边提问、工作详情与审查/扩展入口。
import {
  IconAdjustments,
  IconFileSearch,
  IconFolder,
  IconInfoCircle,
  IconMessageCircle,
  IconPuzzle,
  IconRobot,
  IconSettings,
  IconTerminal,
  IconTerminal2,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import styles from "./RightUtilityRail.module.css";
import { readTerminalPlacement, subscribeTerminalPlacement, type TerminalPlacement } from "./terminal-placement";

export type RightAuxTab = "filesTree" | "workspaceContext" | "shell" | "terminal" | "subagents" | "sideAsk" | "details";

export function RightUtilityRail({
  isZh,
  activeAux,
  auxOpen,
  runningJobsCount,
  runningSubagentsCount,
  onToggleAux,
  onOpenCodeReview,
  onOpenExtensions,
  onOpenSettings,
}: {
  isZh: boolean;
  activeAux: RightAuxTab;
  auxOpen: boolean;
  runningJobsCount: number;
  runningSubagentsCount: number;
  onToggleAux: (tab: RightAuxTab) => void;
  onOpenCodeReview?: (() => void) | undefined;
  onOpenExtensions?: (() => void) | undefined;
  onOpenSettings: () => void;
}) {
  // 终端在底部时不再显示右栏「终端」入口：那里没有对应标签，点了也只会聚焦底部面板。
  const [placement, setPlacement] = useState<TerminalPlacement>(() => readTerminalPlacement());
  useEffect(() => subscribeTerminalPlacement(() => setPlacement(readTerminalPlacement())), []);

  const allItems: Array<{ id: RightAuxTab; label: string; icon: typeof IconFolder; badge?: number }> = [
    { id: "workspaceContext", label: isZh ? "工作区上下文" : "Workspace context", icon: IconInfoCircle },
    { id: "shell", label: isZh ? "终端" : "Terminal", icon: IconTerminal },
    { id: "terminal", label: isZh ? "后台任务" : "Background tasks", icon: IconTerminal2, badge: runningJobsCount },
    { id: "subagents", label: isZh ? "子智能体团队" : "Subagents", icon: IconRobot, badge: runningSubagentsCount },
    { id: "sideAsk", label: isZh ? "侧边提问" : "Side ask", icon: IconMessageCircle },
    { id: "details", label: isZh ? "工作详情（模型/权限/记忆）" : "Work details", icon: IconAdjustments },
  ];
  const items = allItems.filter((item) => !(item.id === "shell" && placement === "bottom"));

  return (
    <nav className={styles.utilityRail} aria-label={isZh ? "右侧辅助工具栏" : "Right utility rail"}>
      <div className={styles.railGroup}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = auxOpen && activeAux === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`${styles.railBtn} ${active ? styles.railBtnActive : ""}`}
              aria-label={item.label}
              aria-pressed={active}
              title={item.label}
              onClick={() => onToggleAux(item.id)}
            >
              <Icon size={17} stroke={1.7} aria-hidden="true" />
              {item.badge !== undefined && item.badge > 0 && (
                <span className={styles.railBadge}>{item.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.railGroup}>
        {onOpenCodeReview && (
          <button
            type="button"
            className={styles.railBtn}
            aria-label={isZh ? "代码审查" : "Code Review"}
            title={isZh ? "代码审查" : "Code Review"}
            onClick={onOpenCodeReview}
          >
            <IconFileSearch size={17} stroke={1.7} aria-hidden="true" />
          </button>
        )}
        {onOpenExtensions && (
          <button
            type="button"
            className={styles.railBtn}
            aria-label={isZh ? "扩展中心" : "Extensions"}
            title={isZh ? "扩展中心" : "Extensions"}
            onClick={onOpenExtensions}
          >
            <IconPuzzle size={17} stroke={1.7} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className={styles.railBtn}
          aria-label={isZh ? "Agent 与规则设置" : "Agent settings"}
          title={isZh ? "Agent 与规则设置" : "Agent settings"}
          onClick={onOpenSettings}
        >
          <IconSettings size={17} stroke={1.7} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

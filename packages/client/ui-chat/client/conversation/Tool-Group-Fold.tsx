// 单阶段工具总菜单：平时收起为一行简洁动作概括，流式执行时自动展开并在结束后收起，展开后完整平铺原有工具明细行。
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import {
  IconBrain,
  IconChevronRight,
  IconFileSearch,
  IconPencil,
  IconRobot,
  IconTerminal2,
  IconTool,
  IconWorld,
} from "@tabler/icons-react";
import type { RoundHeaderIconKind } from "./round-title";
import styles from "./Tool-Group-Fold.module.css";

function renderGroupIcon(kind: RoundHeaderIconKind) {
  switch (kind) {
    case "command": return <IconTerminal2 size={15} stroke={1.7} />;
    case "file": return <IconPencil size={15} stroke={1.7} />;
    case "read": return <IconFileSearch size={15} stroke={1.7} />;
    case "subagent": return <IconRobot size={15} stroke={1.7} />;
    case "browser": return <IconWorld size={15} stroke={1.7} />;
    case "brain": return <IconBrain size={15} stroke={1.7} />;
    default: return <IconTool size={15} stroke={1.7} />;
  }
}

/** 单阶段工具总菜单：收起成一行动作概括，点击展开包裹本阶段全部工具明细。 */
export const ToolGroupFold = memo(function ToolGroupFold({
  label,
  iconKind = "tool",
  failedCount = 0,
  live,
  isZh,
  defaultOpen,
  children,
}: {
  /** 本阶段工具动作概括（如「分析了 5 个文件、加载了技能」）。 */
  label: string;
  /** 左侧语义图标类型。 */
  iconKind?: RoundHeaderIconKind | undefined;
  /** 本阶段失败的工具数量：收起态显式提示，避免掩盖失败。 */
  failedCount?: number | undefined;
  /** 本阶段是否仍有工具正在运行/准备中。 */
  live: boolean;
  isZh: boolean;
  /** 初始是否展开；默认跟随 live（运行中展开，完成后收起）。 */
  defaultOpen?: boolean | undefined;
  /** 展开后展示的工具明细链。 */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? live);
  const wasLiveRef = useRef(live);

  // 流式跑工具时自动展开看实时进度，本阶段跑完后自动收起成简洁一行；用户可随时手动切换。
  useEffect(() => {
    if (live && !wasLiveRef.current) setOpen(true);
    else if (!live && wasLiveRef.current) setOpen(false);
    wasLiveRef.current = live;
  }, [live]);

  const failedText = failedCount > 0
    ? (isZh ? `${failedCount} 项失败` : `${failedCount} failed`)
    : undefined;

  return (
    <div className={styles.root} data-live={live ? "true" : undefined}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-label={
          open
            ? (isZh ? `收起工具明细：${label}` : `Collapse tool details: ${label}`)
            : (isZh ? `展开工具明细：${label}` : `Expand tool details: ${label}`)
        }
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={styles.iconWrap} data-live={live ? "true" : undefined} aria-hidden="true">
          {renderGroupIcon(iconKind)}
        </span>
        <span className={styles.label} data-live={live ? "true" : undefined}>
          {label}
        </span>
        {failedText && <span className={styles.failedBadge}>{failedText}</span>}
        <IconChevronRight
          size={13}
          stroke={1.9}
          className={styles.chevron}
          data-open={open ? "true" : undefined}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className={styles.body}>
          {children}
        </div>
      )}
    </div>
  );
});

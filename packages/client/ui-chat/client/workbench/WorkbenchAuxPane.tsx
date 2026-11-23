// 右侧工作台辅助面板外壳：宽度拖拽手柄、可折叠抽屉与面板头，内容由调用方渲染。
import type { ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import type { ChatLocaleMessages } from "../locales";
import styles from "./RightWorkbenchPane.module.css";

export function WorkbenchAuxPane({
  locale,
  title,
  compact,
  width,
  dragging,
  hideHeader,
  body,
  onResizeStart,
  onKeyResize,
  onClose,
}: {
  locale: ChatLocaleMessages;
  title: string;
  compact: boolean;
  width: number;
  dragging: boolean;
  hideHeader: boolean;
  body: ReactNode;
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  onKeyResize: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      {!compact && (
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label={locale.isZh ? "调整工作区文件树与辅助栏宽度" : "Resize utility sidebar"}
          className={`${styles.auxResizer} ${dragging ? styles.auxResizerActive : ""}`}
          onPointerDown={onResizeStart}
          onKeyDown={(e) => onKeyResize(e.key)}
        />
      )}
      <aside
        className={styles.auxDrawer}
        style={!compact ? { flexBasis: `${width}px` } : undefined}
        aria-label={title}
      >
        {!hideHeader && (
          <div className={styles.auxHeader}>
            <span>{title}</span>
            <button type="button" className={styles.tabClose} aria-label="Close pane" onClick={onClose}>
              <IconX size={12} />
            </button>
          </div>
        )}
        <div className={styles.auxContent}>{body}</div>
      </aside>
    </>
  );
}
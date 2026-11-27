// 底部终端面板：渲染在工作台列内部，位置跟随预览区；采用 GPU 预览线拖拽、阻尼吸附收起与松手平滑落位。
import { useCallback, useEffect, useRef, useState } from "react";
import { usePanePresence } from "@lfaa/ui-primitives/client";
import {
  readStoredJson,
  useVerticalResize,
  writeStoredJson,
  type WorkbenchClientService,
} from "@lfaa/ui-layout/client";
import { TerminalSurface } from "./TerminalSurface";
import { readTerminalPlacement, subscribeTerminalPlacement, writeTerminalPlacement, type TerminalPlacement } from "./terminal-placement";
import styles from "./TerminalDockPane.module.css";

const HEIGHT_KEY = "lfaa:bottom-panel-height";
const VISIBLE_KEY = "lfaa:bottom-dock-visible";
const DEFAULT_HEIGHT = 260;
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 560;

function readHeight(): number {
  const stored = readStoredJson<unknown>(HEIGHT_KEY, null);
  const value = typeof stored === "number" && Number.isFinite(stored) ? stored : DEFAULT_HEIGHT;
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, value));
}

/** 终端放在底部时才渲染；收起时等待高度过渡结束再卸载，避免瞬间闪断。 */
export function TerminalDockPane({
  sessionId,
  isZh,
  workbench,
}: {
  sessionId: string;
  isZh: boolean;
  workbench: WorkbenchClientService;
}) {
  const [placement, setPlacement] = useState<TerminalPlacement>(() => readTerminalPlacement());
  // 底部终端可以单独收起：收起后 Ctrl+↓ / 图标轨入口会重新展开它。
  const [visible, setVisible] = useState(() => readStoredJson<unknown>(VISIBLE_KEY, true) !== false);
  const [height, setHeight] = useState(readHeight);
  const dockRef = useRef<HTMLElement | null>(null);

  useEffect(() => subscribeTerminalPlacement(() => setPlacement(readTerminalPlacement())), []);

  const handleCommitHeight = useCallback((next: number) => {
    const rounded = Math.round(next);
    setHeight(rounded);
    writeStoredJson(HEIGHT_KEY, rounded);
  }, []);

  const handleCollapse = useCallback(() => {
    setVisible(false);
    writeStoredJson(VISIBLE_KEY, false);
  }, []);

  const { dragging, snapped, startResize, handleKeyResize } = useVerticalResize({
    containerRef: dockRef,
    height,
    minHeight: MIN_HEIGHT,
    maxHeight: MAX_HEIGHT,
    onCommitHeight: handleCommitHeight,
    onCollapse: handleCollapse,
  });

  // 右栏入口（图标轨 / 起始页 / 快捷键）在底部模式下重新展开并聚焦这里的终端。
  useEffect(() => {
    const focusTerminal = () => {
      setVisible(true);
      writeStoredJson(VISIBLE_KEY, true);
      const textarea = document.querySelector<HTMLTextAreaElement>("[data-terminal-placement=\"bottom\"] .xterm-helper-textarea");
      textarea?.focus();
    };
    window.addEventListener("lfaa:terminal-focus", focusTerminal);
    return () => window.removeEventListener("lfaa:terminal-focus", focusTerminal);
  }, []);

  const open = placement === "bottom" && visible;
  const mounted = usePanePresence(open);

  if (placement !== "bottom" || !mounted) return null;

  return (
    <section
      ref={dockRef}
      className={styles.dock}
      style={{ height: open ? height : 0 }}
      data-collapsed={open ? undefined : "true"}
      data-snapped={snapped ? "true" : undefined}
      aria-label={isZh ? "底部终端" : "Bottom terminal"}
      aria-hidden={open ? undefined : true}
      inert={open ? undefined : true}
    >
      <div
        className={styles.handle}
        role="separator"
        aria-orientation="horizontal"
        aria-label={isZh ? "拖动调整终端高度" : "Resize terminal"}
        tabIndex={0}
        data-dragging={dragging ? "true" : undefined}
        data-snapped={snapped ? "true" : undefined}
        onPointerDown={startResize}
        onKeyDown={handleKeyResize}
      />
      <div className={styles.body}>
        <TerminalSurface
          sessionId={sessionId}
          isZh={isZh}
          placement="bottom"
          workbench={workbench}
          onRequestRightTab={() => writeTerminalPlacement("right")}
          onClose={handleCollapse}
        />
      </div>
    </section>
  );
}

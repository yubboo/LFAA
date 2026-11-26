// 底部终端面板：渲染在工作台列内部（不参与 Shell 栅格），位置跟随预览区，上沿可拖高。
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import { readStoredJson, writeStoredJson } from "@lfaa/ui-layout/client";
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

/** 终端放在底部时才渲染；空着返回 null，工作台列不会因此多占高度。 */
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
  const dragRef = useRef<{ startY: number; startHeight: number; current?: number } | null>(null);

  useEffect(() => subscribeTerminalPlacement(() => setPlacement(readTerminalPlacement())), []);

  // 拖拽期间只改 DOM 高度（不走 React state），松手才提交，保证拖动手感与左右栏一致。
  const onPointerMove = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, drag.startHeight + (drag.startY - event.clientY)));
    drag.current = next;
    if (dockRef.current) dockRef.current.style.height = `${next}px`;
  }, []);

  const stopDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    window.removeEventListener("pointermove", onPointerMove);
    const final = drag.current ?? height;
    dragRef.current = null;
    writeStoredJson(HEIGHT_KEY, final);
    setHeight(final);
  }, [height, onPointerMove]);

  useEffect(() => () => window.removeEventListener("pointermove", onPointerMove), [onPointerMove]);

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

  if (placement !== "bottom" || !visible) return null;

  return (
    <section ref={dockRef} className={styles.dock} style={{ height }} aria-label={isZh ? "底部终端" : "Bottom terminal"}>
      <div
        className={styles.handle}
        role="separator"
        aria-orientation="horizontal"
        aria-label={isZh ? "拖动调整终端高度" : "Resize terminal"}
        onPointerDown={(event) => {
          dragRef.current = { startY: event.clientY, startHeight: height, current: height };
          window.addEventListener("pointermove", onPointerMove);
          window.addEventListener("pointerup", stopDrag, { once: true });
        }}
      />
      <div className={styles.body}>
        <TerminalSurface
          sessionId={sessionId}
          isZh={isZh}
          placement="bottom"
          workbench={workbench}
          onRequestRightTab={() => writeTerminalPlacement("right")}
          onClose={() => {
            setVisible(false);
            writeStoredJson(VISIBLE_KEY, false);
          }}
        />
      </div>
    </section>
  );
}
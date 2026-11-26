// Shell 底部面板宿主：有贡献且展开时占第二行（跨中间+右侧两列），顶部 6px 手柄可拖动改高度。
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { WorkbenchClientService, WorkbenchSnapshot } from "../workbench-service";
import { readStoredJson, writeStoredJson } from "./ui-preferences";
import { BottomDock } from "./BottomDock";
import styles from "./ShellBottomDock.module.css";

const HEIGHT_KEY = "lfaa:bottom-panel-height";
const DEFAULT_HEIGHT = 260;
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 560;

/** Shell 的第二行：高度由面板自己给，行高自适应。 */
export function bottomDockRow(): string {
  return "minmax(0, 1fr) auto";
}

/** 读回上次的拖高结果并夹到合法区间。 */
function readHeight(): number {
  const stored = readStoredJson<unknown>(HEIGHT_KEY, null);
  const value = typeof stored === "number" && Number.isFinite(stored) ? stored : DEFAULT_HEIGHT;
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, value));
}

export function ShellBottomDock({
  snapshot,
  service,
  isZh,
  isCompact,
}: {
  snapshot: WorkbenchSnapshot;
  service: WorkbenchClientService;
  isZh: boolean;
  isCompact: boolean;
}) {
  const [height, setHeight] = useState(readHeight);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const onPointerMove = useCallback((event: globalThis.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    // 手柄在上沿：往上拖变高，往下拖变矮。
    const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, drag.startHeight + (drag.startY - event.clientY)));
    setHeight(next);
  }, []);

  const stopDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setHeight((current) => {
      writeStoredJson(HEIGHT_KEY, current);
      return current;
    });
    window.removeEventListener("pointermove", onPointerMove);
  }, [onPointerMove]);

  useEffect(() => () => window.removeEventListener("pointermove", onPointerMove), [onPointerMove]);

  if (snapshot.bottomPanels.length === 0 || !snapshot.bottomPanelOpen) return null;

  const style: CSSProperties = { height, minHeight: 0 };

  return (
    <div style={style} className={styles.host} data-bottom-dock="true">
      <div
        className={styles.handle}
        role="separator"
        aria-orientation="horizontal"
        aria-label={isZh ? "拖动调整底部面板高度" : "Resize bottom panel"}
        style={{ height: 6, cursor: "row-resize" }}
        onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
          dragRef.current = { startY: event.clientY, startHeight: height };
          window.addEventListener("pointermove", onPointerMove);
          window.addEventListener("pointerup", stopDrag, { once: true });
        }}
      />
      <BottomDock
        panels={snapshot.bottomPanels}
        activeId={snapshot.bottomPanels[0]?.id}
        isZh={isZh}
        onSelect={() => {}}
        onClose={() => service.setBottomPanelOpen(false, !isCompact)}
      />
    </div>
  );
}
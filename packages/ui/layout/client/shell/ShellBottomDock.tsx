// Shell 底部面板宿主：有贡献且展开时占第二行（跨中间+右侧两列），与侧栏共用方案 A 预览线拖拽与平滑吸附收起。
import { useCallback, useRef, useState, type CSSProperties } from "react";
import { usePanePresence } from "@lfaa/ui-primitives/client";
import type { WorkbenchClientService, WorkbenchSnapshot } from "../workbench-service";
import { readStoredJson, writeStoredJson } from "./ui-preferences";
import { useVerticalResize } from "./useVerticalResize";
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
  const hostRef = useRef<HTMLDivElement | null>(null);
  const open = snapshot.bottomPanels.length > 0 && snapshot.bottomPanelOpen;
  const mounted = usePanePresence(open, isCompact ? 0 : undefined);

  const handleCommitHeight = useCallback((next: number) => {
    const rounded = Math.round(next);
    setHeight(rounded);
    writeStoredJson(HEIGHT_KEY, rounded);
  }, []);

  const handleCollapse = useCallback(() => {
    service.setBottomPanelOpen(false, !isCompact);
  }, [isCompact, service]);

  const { dragging, snapped, startResize, handleKeyResize } = useVerticalResize({
    containerRef: hostRef,
    height,
    minHeight: MIN_HEIGHT,
    maxHeight: MAX_HEIGHT,
    onCommitHeight: handleCommitHeight,
    onCollapse: handleCollapse,
  });

  if (!mounted || snapshot.bottomPanels.length === 0) return null;

  const style: CSSProperties = { height: open ? height : 0, minHeight: 0 };

  return (
    <div
      ref={hostRef}
      style={style}
      className={styles.host}
      data-bottom-dock="true"
      data-collapsed={open ? undefined : "true"}
      data-snapped={snapped ? "true" : undefined}
      aria-hidden={open ? undefined : true}
      inert={open ? undefined : true}
    >
      <div
        className={styles.handle}
        role="separator"
        aria-orientation="horizontal"
        aria-label={isZh ? "拖动调整底部面板高度" : "Resize bottom panel"}
        tabIndex={0}
        data-dragging={dragging ? "true" : undefined}
        data-snapped={snapped ? "true" : undefined}
        onPointerDown={startResize}
        onKeyDown={handleKeyResize}
      />
      <div className={styles.content}>
        <BottomDock
          panels={snapshot.bottomPanels}
          activeId={snapshot.bottomPanels[0]?.id}
          isZh={isZh}
          onSelect={() => {}}
          onClose={handleCollapse}
        />
      </div>
    </div>
  );
}

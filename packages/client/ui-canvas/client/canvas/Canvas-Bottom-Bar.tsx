// 画布底部居中悬浮控制胶囊：选择/抓手模式、缩放百分比、适应画布、小地图/网格开关与撤销重做。
import { useStore } from "@xyflow/react";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconFocusCentered,
  IconGridDots,
  IconHandStop,
  IconMap,
  IconMinus,
  IconPlus,
  IconPointer,
} from "@tabler/icons-react";
import type { CanvasLabels } from "../locales";
import styles from "./Canvas.module.css";

export function CanvasBottomBar({
  t,
  tool,
  showMinimap,
  showGrid,
  canUndo,
  canRedo,
  onToolChange,
  onZoomIn,
  onZoomOut,
  onFitView,
  onToggleMinimap,
  onToggleGrid,
  onUndo,
  onRedo,
}: {
  t: CanvasLabels;
  tool: "select" | "hand";
  showMinimap: boolean;
  showGrid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: "select" | "hand") => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onToggleMinimap: () => void;
  onToggleGrid: () => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <div className={styles.bottomBar} role="toolbar" aria-label="Canvas controls">
      <div className={styles.barSeg}>
        <button
          type="button"
          className={styles.barBtn}
          data-active={tool === "select" ? "true" : undefined}
          title={t.selectTool}
          aria-label={t.selectTool}
          onClick={() => onToolChange("select")}
        >
          <IconPointer size={15} stroke={1.8} />
        </button>
        <button
          type="button"
          className={styles.barBtn}
          data-active={tool === "hand" ? "true" : undefined}
          title={t.handTool}
          aria-label={t.handTool}
          onClick={() => onToolChange("hand")}
        >
          <IconHandStop size={15} stroke={1.8} />
        </button>
      </div>

      <span className={styles.barSep} aria-hidden="true" />

      <button type="button" className={styles.barBtn} title="-" aria-label="Zoom out" onClick={onZoomOut}>
        <IconMinus size={14} stroke={1.8} />
      </button>
      <CanvasZoom />
      <button type="button" className={styles.barBtn} title="+" aria-label="Zoom in" onClick={onZoomIn}>
        <IconPlus size={14} stroke={1.8} />
      </button>
      <button type="button" className={styles.barBtn} title={t.fitView} aria-label={t.fitView} onClick={onFitView}>
        <IconFocusCentered size={15} stroke={1.8} />
      </button>

      <span className={styles.barSep} aria-hidden="true" />

      <button
        type="button"
        className={styles.barBtn}
        data-active={showMinimap ? "true" : undefined}
        title={t.toggleMinimap}
        aria-label={t.toggleMinimap}
        onClick={onToggleMinimap}
      >
        <IconMap size={15} stroke={1.8} />
      </button>
      <button
        type="button"
        className={styles.barBtn}
        data-active={showGrid ? "true" : undefined}
        title={t.toggleGrid}
        aria-label={t.toggleGrid}
        onClick={onToggleGrid}
      >
        <IconGridDots size={15} stroke={1.8} />
      </button>

      <span className={styles.barSep} aria-hidden="true" />

      <button type="button" className={styles.barBtn} disabled={!canUndo} title={t.undo} aria-label={t.undo} onClick={onUndo}>
        <IconArrowBackUp size={15} stroke={1.8} />
      </button>
      <button type="button" className={styles.barBtn} disabled={!canRedo} title={t.redo} aria-label={t.redo} onClick={onRedo}>
        <IconArrowForwardUp size={15} stroke={1.8} />
      </button>
    </div>
  );
}

/** 缩放中的实时数值只刷新这一行文字。 */
function CanvasZoom() {
  const percent = useStore((state) => Math.round(state.transform[2] * 100));
  return <span className={styles.zoomText}>{percent}%</span>;
}

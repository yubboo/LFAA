// 无限画布功能目录，按操作类型搜索并跳转到真实素材处理或画布工具。
import { useState } from "react";
import { IconArrowsMaximize, IconBox, IconCamera, IconCrop, IconGridDots, IconHistory, IconLayoutGrid, IconMovie, IconPlayerPlay, IconRotate, IconScissors, IconTypography, IconVolume } from "@tabler/icons-react";
import type { CanvasLabels } from "../locales";
import { CanvasToolsDialog } from "./Canvas-Tools-Dialog";
import type { CanvasMediaOperation } from "./canvas-media-image";
import styles from "./Canvas-Tools.module.css";

export type CanvasToolAction = CanvasMediaOperation | "history" | "previs" | "run";

const categories = [
  { label: "videoEditing", actions: [
    { id: "snapshot", Icon: IconCamera }, { id: "videoResize", Icon: IconArrowsMaximize }, { id: "splitTracks", Icon: IconVolume },
    { id: "frameStrip", Icon: IconMovie }, { id: "videoCrop", Icon: IconCrop }, { id: "trim", Icon: IconScissors },
  ] },
  { label: "imageEditing", actions: [
    { id: "imageResize", Icon: IconArrowsMaximize }, { id: "rotate", Icon: IconRotate }, { id: "annotate", Icon: IconTypography },
    { id: "crop", Icon: IconCrop }, { id: "splitGrid", Icon: IconGridDots }, { id: "contactSheet", Icon: IconLayoutGrid },
  ] },
  { label: "canvasTools", actions: [{ id: "history", Icon: IconHistory }, { id: "previs", Icon: IconBox }, { id: "run", Icon: IconPlayerPlay }] },
] as const;

export function CanvasToolCatalog({ t, onClose, onSelect }: {
  t: CanvasLabels;
  onClose: () => void;
  onSelect: (action: CanvasToolAction) => void;
}) {
  const [query, setQuery] = useState("");
  const search = query.trim().toLocaleLowerCase();
  const groups = categories.map(({ label, actions }) => ({ label, actions: actions.filter(({ id }) =>
    `${t[label]} ${t[id === "history" ? "historyDrawer" : id]}`.toLocaleLowerCase().includes(search)) })).filter(({ actions }) => actions.length);

  return (
    <CanvasToolsDialog title={t.allTools} closeLabel={t.close} onClose={onClose} catalog header={
      <input type="search" autoFocus className={styles.toolSearch} placeholder={t.searchTools} aria-label={t.searchTools} value={query} onChange={(event) => setQuery(event.target.value)} />
    }>
      {groups.length === 0 && <p className={styles.empty}>{t.noMatchingTools}</p>}
      {groups.map(({ label, actions }) => (
        <section key={label} className={styles.toolGroup}>
          <h3>{t[label]}</h3>
          <div className={styles.toolGrid}>
            {actions.map(({ id, Icon }) => (
              <button key={id} type="button" className={styles.toolAction} onClick={() => onSelect(id)}>
                <span className={styles.toolIcon}><Icon size={19} stroke={1.65} aria-hidden="true" /></span>
                <span>{t[id === "history" ? "historyDrawer" : id]}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </CanvasToolsDialog>
  );
}

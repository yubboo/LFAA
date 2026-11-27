// 画布侧栏的节点索引、模板目录与添加入口，共用现有节点和模板定义。
import { useState } from "react";
import { IconArrowUpRight, IconX } from "@tabler/icons-react";
import type { CanvasNode, CanvasNodeKind } from "@lfaa/canvas/contract";
import type { CanvasLabels } from "../locales";
import { canvasNodeOptions } from "./Canvas-Menu";
import { CANVAS_TEMPLATE_CATEGORIES, type CanvasSubTemplate } from "./template-catalog";
import drawers from "./Canvas-Drawers.module.css";
import styles from "./Canvas-Tools.module.css";

export type CanvasPanel = "nodes" | "templates" | "add";

/** 搜索使用卡片现有的节点编号和提示词，筛选后保留原编号。 */
export function CanvasToolPanels({ panel, title, t, isZh, nodes, nodeId, onClose, onFocusNode, onCreateNode, onTemplate }: {
  panel: CanvasPanel;
  title: string;
  t: CanvasLabels;
  isZh: boolean;
  nodes: readonly CanvasNode[];
  nodeId: string | undefined;
  onClose: () => void;
  onFocusNode: (node: CanvasNode) => void;
  onCreateNode: (kind: CanvasNodeKind) => void;
  onTemplate: (template: CanvasSubTemplate) => void;
}) {
  const [query, setQuery] = useState("");
  const search = query.trim().toLocaleLowerCase();
  const matches = nodes.map((node, index) => ({ node, label: `${t[node.kind]}${index + 1}` }))
    .filter(({ node, label }) => `${label} ${node.settings.prompt ?? ""}`.toLocaleLowerCase().includes(search));

  return (
    <aside className={drawers.sideDrawer} aria-label={title} onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
    }}>
      <header className={drawers.drawerHeader}>
        <strong>{title}</strong>
        <button type="button" className={drawers.iconBtn} aria-label={t.close} onClick={onClose}><IconX size={15} /></button>
      </header>

      {panel === "nodes" && (
        <>
          <input type="search" className={styles.panelSearch} aria-label={t.searchNodes} placeholder={t.searchNodes} value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className={styles.panelBody}>
            {matches.length === 0 && <p className={styles.empty}>{nodes.length ? t.noMatchingNodes : t.emptyNodes}</p>}
            {matches.map(({ node, label }) => (
              <button key={node.id} type="button" className={styles.listRow} data-active={nodeId === node.id} onClick={() => onFocusNode(node)}>
                <span>{label}</span><IconArrowUpRight size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        </>
      )}

      {panel === "templates" && (
        <div className={styles.panelBody}>
          {CANVAS_TEMPLATE_CATEGORIES.map((category) => (
            <section key={category.id} className={styles.templateGroup}>
              <h3>{isZh ? category.titleZh : category.titleEn}</h3>
              {[...category.above, ...category.below].map((item) => (
                <button key={item.id} type="button" className={styles.listRow} onClick={() => onTemplate(item)}>
                  <span>{isZh ? item.titleZh : item.titleEn}</span><IconArrowUpRight size={14} aria-hidden="true" />
                </button>
              ))}
            </section>
          ))}
        </div>
      )}

      {panel === "add" && (
        <div className={styles.panelBody}>
          {canvasNodeOptions.map(({ kind, Icon }) => (
            <button key={kind} type="button" className={styles.listRow} onClick={() => onCreateNode(kind)}>
              <Icon size={16} aria-hidden="true" /><span>{t[kind]}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

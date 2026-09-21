/**
 * 文件：WorkCanvasNodeEditor.tsx
 * 作用：Work / Manual 共用的无限画布节点人工编辑面板。
 * 负责：允许用户直接修改节点标题/说明，并把修改交给 Canvas Controller。
 * 不负责：Agent 调用、模型配置、布局坐标、工具执行。
 * 状态归属：输入草稿归本 View；提交后的内容归 Work Canvas Controller。
 * 对外接口：WorkCanvasNodeEditor。
 * 关联文件：useWorkCanvasController.ts、WorkWorkspace.tsx、ManualWorkspace.tsx。
 * 修改注意事项：该编辑器是“人工干预画布”的表现层，不得直接调用 Provider Runtime。
 */
import { useEffect, useState } from "react";
import type { InfiniteCanvasNode } from "@lfaa/ui";
import styles from "../styles/WorkCanvasNodeEditor.module.css";

export function WorkCanvasNodeEditor({ node, onSave, onClose }: {
  node: InfiniteCanvasNode;
  onSave: (title: string, description: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description ?? "");
  useEffect(() => { setTitle(node.title); setDescription(node.description ?? ""); }, [node.id, node.title, node.description]);
  return (
    <aside className={styles.root} aria-label="画布节点编辑器" data-ui="work-canvas-node-editor">
      <header><div><strong>人工干预</strong><span>{node.kind} · {node.id}</span></div><button type="button" onClick={onClose} aria-label="关闭节点编辑器">×</button></header>
      <label>标题<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} /></label>
      <label>说明<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={6} maxLength={1200} /></label>
      <footer><button type="button" onClick={() => onSave(title, description)} disabled={!title.trim()}>应用到画布</button></footer>
      <p>Work Agent 下一次对话干预会携带当前画布上下文；Manual 仅保存人工编辑，不调用模型。</p>
    </aside>
  );
}

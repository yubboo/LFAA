// 在画布节点卡片上显示预览和各个有类型的输入输出端口。
import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react";
import { useEffect } from "react";
import { inputPorts, outputPorts, type CanvasAsset, type CanvasNode } from "@lfaa/canvas/contract";
import { assetUrl } from "../api/canvas-api";
import type { CanvasLabels } from "../locales";
import styles from "./Canvas.module.css";

export type FlowNode = Node<{ node: CanvasNode; assets: CanvasAsset[]; path: string; t: CanvasLabels; runStatus?: string }, "canvas">;

export function GraphNode({ id, data, selected }: NodeProps<FlowNode>) {
  const { node, assets, path, t, runStatus } = data;
  const inputs = inputPorts(node);
  const outputs = outputPorts(node, assets);
  const signature = inputs.map((port) => port.id).join(":") + "/" + outputs.map((port) => port.id).join(":");
  const update = useUpdateNodeInternals();
  useEffect(() => { update(id); }, [id, signature, update]);
  const preview = outputs.find((port) => port.assetId && port.kind === "image") ?? outputs.find((port) => port.assetId);

  return (
    <article className={styles.card} data-selected={Boolean(selected)} data-kind={node.kind}>
      <header><strong>{t[node.kind]}</strong>{runStatus && <small>{runStatus}</small>}</header>
      {preview?.assetId && (preview.kind === "video"
        ? <video muted preload="metadata" src={assetUrl(path, preview.assetId)} />
        : <img alt="" draggable={false} src={assetUrl(path, preview.assetId)} />)}
      {node.kind === "prompt" && <p>{node.settings.prompt || t.prompt}</p>}
      {node.settings.modelId && <p>{node.settings.modelId}</p>}
      <div className={styles.ports}>
        <div>
          {inputs.map((port) => <div key={port.id} className={styles.port} data-media={port.kind} data-side="in">
            <Handle id={port.id} type="target" position={Position.Left} className={styles.handle} />
            <span>{t[port.id as keyof CanvasLabels]}</span>
          </div>)}
        </div>
        <div>
          {outputs.map((port) => <div key={port.id} className={styles.port} data-media={port.kind} data-side="out">
            <Handle id={port.id} type="source" position={Position.Right} className={styles.handle} isConnectable={port.kind === "text" || Boolean(port.assetId)} />
            <span>{node.kind === "previs" ? (port.kind === "image" ? t.frameOutput : t.clipOutput) : t[port.id as keyof CanvasLabels]}</span>
          </div>)}
        </div>
      </div>
    </article>
  );
}

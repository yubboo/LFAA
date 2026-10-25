/** 功能：无限画布的文本、备注、图片与视频节点卡片。作用：每个节点用 memo 隔离渲染，拖拽或保存状态变化不重渲染其他节点。关联文件：CanvasWorkspace.tsx、canvas-workspace.css。 */
import { Handle, Position, type Node, type NodeProps, type NodeTypes } from "@xyflow/react";
import { Button, Input } from "antd";
import { memo } from "react";
import { canvasAssetUrl } from "lfaa-client-connection/src/api.js";

export type CanvasNodeKind = "text" | "note" | "image" | "video";

export interface CanvasNodeData extends Record<string, unknown> {
  kind: CanvasNodeKind;
  text: string;
  projectId: string;
  assetId?: string;
  assetName?: string;
  onTextChange: (id: string, text: string) => void;
  onRemove: (id: string) => void;
}

export type CanvasFlowNode = Node<CanvasNodeData, CanvasNodeKind>;

const KIND_LABEL: Record<CanvasNodeKind, string> = { text: "文本", note: "备注", image: "图片", video: "视频" };

function nodeName(data: CanvasNodeData): string {
  if (data.kind === "image" || data.kind === "video") return data.assetName || "未关联素材";
  const firstLine = data.text.trim().split("\n")[0] ?? "";
  return firstLine.slice(0, 40) || (data.kind === "note" ? "空白备注" : "空白文本");
}

function NodeHeader({ id, data }: { id: string; data: CanvasNodeData }) {
  const label = KIND_LABEL[data.kind];
  return (
    <header className="lfaa-canvas-node__header">
      <span className="lfaa-canvas-node__kind">{label}</span>
      <span className="lfaa-canvas-node__name" title={nodeName(data)}>{nodeName(data)}</span>
      <Button className="nodrag nopan lfaa-canvas-node__remove" size="small" type="text" danger aria-label={`删除${label}节点`} onClick={() => data.onRemove(id)}>删除</Button>
    </header>
  );
}

const TextNodeCard = memo(function TextNodeCard({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const isNote = data.kind === "note";
  return (
    <article className={`lfaa-canvas-node lfaa-canvas-node--${data.kind}${selected ? " is-selected" : ""}`} aria-label={`${KIND_LABEL[data.kind]}节点：${nodeName(data)}`}>
      <Handle type="target" position={Position.Left} aria-label="连线输入" />
      <NodeHeader id={id} data={data} />
      <div className="lfaa-canvas-node__body">
        <Input.TextArea className="nodrag nowheel lfaa-canvas-node__text" aria-label={`${isNote ? "备注" : "文本"}节点内容`} value={data.text} maxLength={20_000} autoSize={false} placeholder={isNote ? "记录画布说明、决策或待办" : "输入文本或提示词；随项目一起保存"} onChange={event => data.onTextChange(id, event.target.value)} />
      </div>
      <Handle type="source" position={Position.Right} aria-label="连线输出" />
    </article>
  );
});

const ImageNodeCard = memo(function ImageNodeCard({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const source = data.assetId ? canvasAssetUrl(data.projectId, data.assetId) : null;
  return (
    <article className={`lfaa-canvas-node lfaa-canvas-node--image${selected ? " is-selected" : ""}`} aria-label={`图片节点：${nodeName(data)}`}>
      <Handle type="target" position={Position.Left} aria-label="连线输入" />
      <NodeHeader id={id} data={data} />
      <div className="lfaa-canvas-node__body lfaa-canvas-node__body--media">
        {source
          ? <img className="nodrag lfaa-canvas-node__media" src={source} alt={data.assetName ?? "画布图片素材"} loading="lazy" decoding="async" draggable={false} />
          : <p className="lfaa-canvas-node__missing">素材缺失，请从素材面板重新插入。</p>}
      </div>
      <Handle type="source" position={Position.Right} aria-label="连线输出" />
    </article>
  );
});

const VideoNodeCard = memo(function VideoNodeCard({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const source = data.assetId ? canvasAssetUrl(data.projectId, data.assetId) : null;
  return (
    <article className={`lfaa-canvas-node lfaa-canvas-node--video${selected ? " is-selected" : ""}`} aria-label={`视频节点：${nodeName(data)}`}>
      <Handle type="target" position={Position.Left} aria-label="连线输入" />
      <NodeHeader id={id} data={data} />
      <div className="lfaa-canvas-node__body lfaa-canvas-node__body--media">
        {source
          ? <video className="nodrag lfaa-canvas-node__media" src={source} controls preload="metadata" playsInline aria-label={data.assetName ?? "画布视频素材"} />
          : <p className="lfaa-canvas-node__missing">素材缺失，请从素材面板重新插入。</p>}
      </div>
      <Handle type="source" position={Position.Right} aria-label="连线输出" />
    </article>
  );
});

export const CANVAS_NODE_TYPES: NodeTypes = { text: TextNodeCard, note: TextNodeCard, image: ImageNodeCard, video: VideoNodeCard };

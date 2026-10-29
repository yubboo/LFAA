/**
 * 功能：系统级无限画布的节点卡片（合同 5.2 全部类型）。
 * 作用：文本/备注/图片/视频/音频/生成/主体/时间线/导演工具箱/导演台/剧本/资产节点都真实可编辑，
 *      编辑结果经工作区写回项目文档；每个节点用 memo 隔离渲染，拖动或保存状态变化不重渲染其它节点。
 * 关联文件：CanvasWorkspace.tsx、CanvasProjectTransfer.ts、canvas-workspace.css、docs/development/canvas-agent-workbench-20261025.md。
 */
import { Handle, Position, type Node, type NodeProps, type NodeTypes } from "@xyflow/react";
import { Button, Input, InputNumber, Select, Tag } from "antd";
import { createContext, memo, useContext, type ReactNode } from "react";
import { canvasAssetUrl, type AiVideoReference, type AiVideoShot, type AiVideoTimelineClip, type AiVideoWhiteModel, type ApplicationId, type CanvasAsset } from "lfaa-client-connection/src/api.js";
import {
  CANVAS_ASPECT_RATIO_OPTIONS, CANVAS_LIMITS,
  type CanvasAspectRatio, type CanvasDirectorDeskData, type CanvasDirectorToolboxData, type CanvasGenerationData,
  type CanvasNodeKind, type CanvasScriptData, type CanvasSubjectData, type CanvasTimelineClip, type CanvasTimelineData
} from "./CanvasProjectTransfer.js";

/** 画布节点在界面里使用的短标签；节点类型标识由数据合同决定，这里只负责展示。 */
export const CANVAS_NODE_LABELS: Record<CanvasNodeKind, string> = {
  text: "文本",
  note: "备注",
  image: "图片",
  video: "视频",
  audio: "音频",
  generation: "生成",
  subject: "主体",
  timeline: "时间线",
  "director-toolbox": "导演工具箱",
  "director-desk": "导演台",
  script: "剧本",
  asset: "资产",
  shot: "镜头",
  "aivideo-reference": "角色 / 场景",
  "aivideo-timeline": "漫剧时间线",
  "aivideo-director": "导演台"
};

/** 节点卡片可用的节点摘要，供导演台选择镜头节点；只在节点集合或类型变化时重建。 */
export interface CanvasNodeOption { id: string; label: string; kind: CanvasNodeKind }

/** 画布级只读数据：项目素材与节点摘要。用 Context 传递，避免每次编辑都重建所有节点的 data 打破 memo。 */
export interface CanvasNodeContextValue {
  assets: CanvasAsset[];
  nodeOptions: CanvasNodeOption[];
  references: Array<{ id: string; name: string; kind: "characters" | "locations" }>;
  assetUrl: (projectId: string, assetId: string) => string;
}

const canvasNodeContext = createContext<CanvasNodeContextValue>({ assets: [], nodeOptions: [], references: [], assetUrl: (projectId, assetId) => canvasAssetUrl("workspace", projectId, assetId) });

/** 由工作区提供项目素材与节点摘要；节点卡片内部读取，不进入持久化 data。 */
export const CanvasNodeContextProvider = canvasNodeContext.Provider;

function useCanvasNodeContext(): CanvasNodeContextValue {
  return useContext(canvasNodeContext);
}

/** 工作区传给节点卡片的稳定回调与只读数据。 */
export interface CanvasNodeCallbacks {
  onTextChange: (id: string, text: string) => void;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
  onOpenDirectorDesk: (id: string) => void;
  onRefreshGeneration?: (id: string) => void;
  onCancelGeneration?: (id: string) => void;
  onGenerateShotImage?: (id: string) => void;
  onStartShotVideo?: (id: string) => void;
  onRefreshShotVideo?: (id: string) => void;
  onCancelShotVideo?: (id: string) => void;
  onUploadReferenceImage?: (id: string, file: File) => void;
  onRemoveReferenceImage?: (id: string) => void;
}

export interface CanvasNodeData extends Record<string, unknown>, CanvasNodeCallbacks {
  kind: CanvasNodeKind;
  applicationId: ApplicationId;
  projectId: string;
  text: string;
  assetId?: string;
  assetName?: string;
  generation?: CanvasGenerationData;
  subject?: CanvasSubjectData;
  timeline?: CanvasTimelineData;
  preset?: CanvasDirectorToolboxData;
  desk?: CanvasDirectorDeskData;
  script?: CanvasScriptData;
  shot?: AiVideoShot;
  reference?: AiVideoReference & { kind: "characters" | "locations" };
  clips?: AiVideoTimelineClip[];
  whiteModel?: AiVideoWhiteModel;
}

export type CanvasFlowNode = Node<CanvasNodeData, CanvasNodeKind>;

function nodeTitle(data: CanvasNodeData): string {
  switch (data.kind) {
    case "text":
    case "note": {
      const firstLine = data.text.trim().split("\n")[0] ?? "";
      return firstLine.slice(0, 40) || (data.kind === "note" ? "空白备注" : "空白文本");
    }
    case "image":
    case "video":
    case "audio":
    case "asset":
      return data.assetName || "未关联素材";
    case "generation":
      return data.generation?.prompt.trim().slice(0, 40) || (data.generation?.kind === "video" ? "视频生成" : "图片生成");
    case "subject":
      return data.subject?.name || "未命名主体";
    case "timeline":
      return "时间线 · " + (data.timeline?.clips.length ?? 0) + " 个片段";
    case "director-toolbox":
      return data.preset?.name || "未命名预设";
    case "director-desk":
      return "导演台 · " + (data.desk?.shotNodeIds.length ?? 0) + " 个镜头";
    case "script":
      return data.script?.title || "未命名剧本";
    case "shot":
      return data.shot?.title || "未命名镜头";
    case "aivideo-reference":
      return data.reference?.name || "未命名档案";
    case "aivideo-timeline":
      return "漫剧时间线 · " + (data.clips?.length ?? 0) + " 个片段";
    case "aivideo-director":
      return "导演台 · " + (data.whiteModel?.items.length ?? 0) + " 个白模";
    default:
      return CANVAS_NODE_LABELS[data.kind];
  }
}

function assetOptions(assets: CanvasAsset[]): Array<{ value: string; label: string }> {
  return assets.map(asset => ({ value: asset.assetId, label: asset.name + " · " + asset.mimeType.split("/")[0] }));
}

function NodeShell({ id, data, selected, children, advice }: { id: string; data: CanvasNodeData; selected: boolean; children: ReactNode; advice?: string }) {
  const label = CANVAS_NODE_LABELS[data.kind];
  return (
    <article className={"lfaa-cnv-node lfaa-cnv-node--" + data.kind + (selected ? " is-selected" : "")} aria-label={label + "节点：" + nodeTitle(data)}>
      <Handle type="target" position={Position.Left} className="lfaa-cnv-handle" aria-label="连线输入" />
      <header className="lfaa-cnv-node__header">
        <span className="lfaa-cnv-node__kind">{label}</span>
        {data.kind === "generation" && data.generation ? (
          <span className={"lfaa-cnv-node__badge lfaa-cnv-node__badge--" + data.generation.status}>{generationStatusLabel(data.generation).text}</span>
        ) : null}
        <span className="lfaa-cnv-node__title" title={nodeTitle(data)}>{nodeTitle(data)}</span>
        <Button className="nodrag nopan lfaa-cnv-node__remove" size="small" type="text" danger aria-label={"删除" + label + "节点"} disabled={data.applicationId === "aivideo" && (data.kind === "script" || data.kind === "aivideo-timeline" || data.kind === "aivideo-director") || data.kind === "shot" && (data.shot?.videoTask?.status === "submitting" || data.shot?.videoTask?.status === "queued" || data.shot?.videoTask?.status === "running")} onClick={() => data.onRemove(id)}>删除</Button>
      </header>
      <div className="lfaa-cnv-node__body">{children}</div>
      {advice ? <p className="lfaa-cnv-node__advice">{advice}</p> : null}
      <Handle type="source" position={Position.Right} className="lfaa-cnv-handle" aria-label="连线输出" />
    </article>
  );
}

const TextNodeCard = memo(function TextNodeCard({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const isNote = data.kind === "note";
  return (
    <NodeShell id={id} data={data} selected={selected}>
      <Input.TextArea
        className="nodrag nowheel lfaa-cnv-node__textarea"
        aria-label={(isNote ? "备注" : "文本") + "节点内容"}
        value={data.text}
        maxLength={CANVAS_LIMITS.textLength}
        placeholder={isNote ? "记录画布说明、决策或待办" : "输入文本或提示词；随项目一起保存"}
        onChange={event => data.onTextChange(id, event.target.value)}
      />
    </NodeShell>
  );
});

const MediaNodeCard = memo(function MediaNodeCard({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const { assetUrl } = useCanvasNodeContext();
  const url = data.assetId ? assetUrl(data.projectId, data.assetId) : null;
  const kind = data.kind;
  return (
    <NodeShell id={id} data={data} selected={selected}>
      {url ? (
        kind === "video"
          ? <video className="nodrag nowheel lfaa-cnv-node__media" src={url} controls preload="metadata" playsInline aria-label={data.assetName ?? "画布视频素材"} />
          : kind === "audio"
            ? <audio className="nodrag nowheel lfaa-cnv-node__audio" src={url} controls preload="metadata" aria-label={data.assetName ?? "画布音频素材"} />
            : <img className="nodrag lfaa-cnv-node__media" src={url} alt={data.assetName ?? "画布图片素材"} loading="lazy" decoding="async" draggable={false} />
      ) : <p className="lfaa-cnv-node__missing">素材缺失，请从资产库重新插入。</p>}
      {kind === "asset" ? <p className="lfaa-cnv-node__advice">资产库引用：节点只保存素材引用，不复制字节。</p> : null}
    </NodeShell>
  );
});

function generationStatusLabel(generation: CanvasGenerationData): { text: string; color: string } {
  if (generation.status === "running") return { text: "生成中", color: "processing" };
  if (generation.status === "succeeded") return { text: "已完成", color: "success" };
  if (generation.status === "failed") return { text: "失败", color: "error" };
  return { text: "待生成", color: "default" };
}

const GenerationNodeCard = memo(function GenerationNodeCard({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const { assetUrl } = useCanvasNodeContext();
  const generation = data.generation;
  const url = generation?.assetId ? assetUrl(data.projectId, generation.assetId) : null;
  const status = generation ? generationStatusLabel(generation) : null;
  return (
    <NodeShell id={id} data={data} selected={selected}>
      {status ? <div className="lfaa-cnv-node__status"><Tag color={status.color}>{status.text}</Tag><span>{generation?.kind === "video" ? "视频" : "图片"}{generation?.aspectRatio ? " · " + generation.aspectRatio : ""}{generation?.durationSeconds ? " · " + generation.durationSeconds + " 秒" : ""}</span></div> : null}
      {generation?.prompt ? <p className="lfaa-cnv-node__prompt">{generation.prompt}</p> : null}
      {url ? (
        generation?.kind === "video"
          ? <video className="nodrag nowheel lfaa-cnv-node__media" src={url} controls preload="metadata" playsInline aria-label="生成视频结果" />
          : <img className="nodrag lfaa-cnv-node__media" src={url} alt="生成图片结果" loading="lazy" decoding="async" draggable={false} />
      ) : null}
      {generation?.status === "running" ? <p className="lfaa-cnv-node__advice">任务已提交{generation.taskId ? "（" + generation.taskId.slice(0, 18) + "）" : ""}；刷新会请求服务端真实任务状态。</p> : null}
      {generation?.error ? <p className="lfaa-cnv-node__error" role="alert">{generation.error}</p> : null}
      {generation && (generation.status === "running" || generation.status === "failed") ? (
        <div className="lfaa-cnv-node__actions">
          <Button className="nodrag nopan" size="small" onClick={() => data.onRefreshGeneration?.(id)}>刷新状态</Button>
          {generation.status === "running" ? <Button className="nodrag nopan" size="small" danger onClick={() => data.onCancelGeneration?.(id)}>取消任务</Button> : null}
        </div>
      ) : null}
    </NodeShell>
  );
});

const SubjectNodeCard = memo(function SubjectNodeCard({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const { assets } = useCanvasNodeContext();
  const subject: CanvasSubjectData = data.subject ?? { name: "", kind: "character", description: "", assetIds: [] };
  const patch = (next: Partial<CanvasSubjectData>) => data.onPatch(id, { subject: { ...subject, ...next } });
  const options = assetOptions(assets);
  return (
    <NodeShell id={id} data={data} selected={selected}>
      <label className="lfaa-cnv-field">
        <span>名称</span>
        <Input className="nodrag" size="small" maxLength={120} value={subject.name} placeholder="主体名称" onChange={event => patch({ name: event.target.value })} />
      </label>
      <label className="lfaa-cnv-field">
        <span>类型</span>
        <Select className="nodrag" size="small" value={subject.kind} options={[{ value: "character", label: "角色" }, { value: "location", label: "场景" }, { value: "prop", label: "道具" }]} onChange={(kind: CanvasSubjectData["kind"]) => patch({ kind })} />
      </label>
      <Input.TextArea className="nodrag nowheel lfaa-cnv-node__textarea" size="small" maxLength={CANVAS_LIMITS.textLength} value={subject.description} placeholder="主体描述、外观与一致性要求" onChange={event => patch({ description: event.target.value })} />
      <label className="lfaa-cnv-field lfaa-cnv-field--stack">
        <span>引用素材</span>
        <Select className="nodrag" size="small" mode="multiple" allowClear placeholder="选择项目素材" value={subject.assetIds} options={options} onChange={(assetIds: string[]) => patch({ assetIds })} />
      </label>
    </NodeShell>
  );
});

const TimelineNodeCard = memo(function TimelineNodeCard({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const { assets } = useCanvasNodeContext();
  const timeline: CanvasTimelineData = data.timeline ?? { clips: [], durationSeconds: 0 };
  const patch = (next: Partial<CanvasTimelineData>) => data.onPatch(id, { timeline: { ...timeline, ...next } });
  const addClip = (assetId: string) => {
    const asset = assets.find(item => item.assetId === assetId);
    if (!asset) return;
    const start = timeline.clips.reduce((total, clip) => Math.max(total, clip.startSeconds + clip.durationSeconds), 0);
    const clip: CanvasTimelineClip = { nodeId: "", assetId, startSeconds: Math.round(start * 10) / 10, durationSeconds: 3, title: asset.name };
    const clips = [...timeline.clips, clip].slice(0, 200);
    patch({ clips, durationSeconds: Math.round(clips.reduce((total, item) => Math.max(total, item.startSeconds + item.durationSeconds), 0) * 10) / 10 });
  };
  const updateClip = (index: number, next: Partial<CanvasTimelineClip>) => {
    const clips = timeline.clips.map((clip, position) => position === index ? { ...clip, ...next } : clip);
    patch({ clips, durationSeconds: Math.round(clips.reduce((total, item) => Math.max(total, item.startSeconds + item.durationSeconds), 0) * 10) / 10 });
  };
  const removeClip = (index: number) => {
    const clips = timeline.clips.filter((_clip, position) => position !== index);
    patch({ clips, durationSeconds: Math.round(clips.reduce((total, item) => Math.max(total, item.startSeconds + item.durationSeconds), 0) * 10) / 10 });
  };
  return (
    <NodeShell id={id} data={data} selected={selected}>
      <div className="lfaa-cnv-timeline">
        <div className="lfaa-cnv-timeline__head"><span>总时长 {timeline.durationSeconds} 秒</span><span>{timeline.clips.length} 片段</span></div>
        <Select className="nodrag lfaa-cnv-timeline__add" size="small" placeholder="选择素材添加片段" value={undefined} options={assetOptions(assets)} onChange={(assetId: string) => addClip(assetId)} />
        {timeline.clips.map((clip, index) => (
          <div className="lfaa-cnv-timeline__clip" key={index}>
            <Input className="nodrag" size="small" value={clip.title} maxLength={120} aria-label="片段标题" onChange={event => updateClip(index, { title: event.target.value })} />
            <InputNumber className="nodrag" size="small" min={0} max={36_000} step={0.5} value={clip.startSeconds} aria-label="片段开始秒" onChange={value => updateClip(index, { startSeconds: typeof value === "number" ? value : 0 })} />
            <InputNumber className="nodrag" size="small" min={0.1} max={36_000} step={0.5} value={clip.durationSeconds} aria-label="片段时长秒" onChange={value => updateClip(index, { durationSeconds: typeof value === "number" ? value : 0.1 })} />
            <Button className="nodrag nopan" size="small" type="text" danger aria-label="删除片段" onClick={() => removeClip(index)}>移除</Button>
          </div>
        ))}
        {timeline.clips.length === 0 ? <p className="lfaa-cnv-node__advice">从项目素材添加片段；时间线只记录引用，不复制素材字节。</p> : null}
      </div>
    </NodeShell>
  );
});

const ToolboxNodeCard = memo(function ToolboxNodeCard({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const preset: CanvasDirectorToolboxData = data.preset ?? { name: "", promptSuffix: "" };
  const patch = (next: Partial<CanvasDirectorToolboxData>) => data.onPatch(id, { preset: { ...preset, ...next } });
  return (
    <NodeShell id={id} data={data} selected={selected}>
      <label className="lfaa-cnv-field">
        <span>预设名称</span>
        <Input className="nodrag" size="small" maxLength={120} value={preset.name} placeholder="例如 电影感冷色调" onChange={event => patch({ name: event.target.value })} />
      </label>
      <Input.TextArea className="nodrag nowheel lfaa-cnv-node__textarea" size="small" maxLength={CANVAS_LIMITS.textLength} value={preset.promptSuffix} placeholder="追加到提示词末尾的风格描述" onChange={event => patch({ promptSuffix: event.target.value })} />
      <label className="lfaa-cnv-field">
        <span>比例</span>
        <Select className="nodrag" size="small" allowClear value={preset.aspectRatio} options={CANVAS_ASPECT_RATIO_OPTIONS.map(option => ({ value: option.value, label: option.label }))} onChange={(aspectRatio?: CanvasAspectRatio) => patch({ aspectRatio })} />
      </label>
    </NodeShell>
  );
});

const DeskNodeCard = memo(function DeskNodeCard({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const { nodeOptions } = useCanvasNodeContext();
  const desk: CanvasDirectorDeskData = data.desk ?? { shotNodeIds: [] };
  const patch = (next: Partial<CanvasDirectorDeskData>) => data.onPatch(id, { desk: { ...desk, ...next } });
  const options = nodeOptions.filter(option => option.id !== id).map(option => ({ value: option.id, label: option.label + " · " + CANVAS_NODE_LABELS[option.kind] }));
  return (
    <NodeShell id={id} data={data} selected={selected}>
      <label className="lfaa-cnv-field lfaa-cnv-field--stack">
        <span>镜头节点</span>
        <Select className="nodrag" size="small" mode="multiple" allowClear placeholder="选择要上导演台的节点" value={desk.shotNodeIds} options={options} onChange={(shotNodeIds: string[]) => patch({ shotNodeIds })} />
      </label>
      <Button className="nodrag nopan" type="primary" size="small" block data-testid="canvas-director-open" onClick={() => data.onOpenDirectorDesk(id)}>进入导演台</Button>
      <p className="lfaa-cnv-node__advice">白模、机位与灯光保存在当前画布项目中。</p>
    </NodeShell>
  );
});

const ScriptNodeCard = memo(function ScriptNodeCard({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const script: CanvasScriptData = data.script ?? { title: "", body: "", status: "draft" };
  const patch = (next: Partial<CanvasScriptData>) => data.onPatch(id, { script: { ...script, ...next } });
  return (
    <NodeShell id={id} data={data} selected={selected}>
      <label className="lfaa-cnv-field">
        <span>标题</span>
        <Input className="nodrag" size="small" maxLength={120} value={script.title} placeholder="剧本标题" onChange={event => patch({ title: event.target.value })} />
      </label>
      <label className="lfaa-cnv-field">
        <span>状态</span>
        <Select className="nodrag" size="small" value={script.status} options={[{ value: "draft", label: "草稿" }, { value: "ready", label: "定稿" }]} onChange={(status: CanvasScriptData["status"]) => patch({ status })} />
      </label>
      <Input.TextArea className="nodrag nowheel lfaa-cnv-node__textarea" size="small" maxLength={CANVAS_LIMITS.textLength} value={script.body} placeholder="剧本正文；随项目保存" onChange={event => patch({ body: event.target.value })} />
    </NodeShell>
  );
});

const AiVideoShotNodeCard = memo(function AiVideoShotNodeCard({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const { references, assetUrl } = useCanvasNodeContext();
  const shot = data.shot ?? { id, title: "新镜头", description: "", dialogue: "", durationSeconds: 5, x: 0, y: 0, characterIds: [] };
  const patch = (next: Partial<AiVideoShot>) => data.onPatch(id, { shot: { ...shot, ...next } });
  const characters = references.filter(item => item.kind === "characters").map(item => ({ value: item.id, label: item.name }));
  const locations = references.filter(item => item.kind === "locations").map(item => ({ value: item.id, label: item.name }));
  const imageUrl = shot.imageAssetId ? assetUrl(data.projectId, shot.imageAssetId) : null;
  const videoUrl = shot.videoAssetId ? assetUrl(data.projectId, shot.videoAssetId) : null;
  const task = shot.videoTask;
  const taskLabel = task?.status === "running" || task?.status === "queued" || task?.status === "submitting"
    ? "视频生成中" : task?.status === "failed" ? "视频生成失败" : task?.status === "succeeded" ? "视频已完成" : task?.status === "cancelled" ? "任务已取消" : "视频待生成";
  return (
    <NodeShell id={id} data={data} selected={selected}>
      <label className="lfaa-cnv-field"><span>镜头标题</span><Input className="nodrag" size="small" maxLength={80} value={shot.title} onChange={event => patch({ title: event.target.value })} /></label>
      <Input.TextArea className="nodrag nowheel lfaa-cnv-node__textarea lfaa-cnv-aivideo-shot__text" size="small" maxLength={1_000} value={shot.description} placeholder="画面描述与动作" aria-label="镜头画面描述" onChange={event => patch({ description: event.target.value })} />
      <Input.TextArea className="nodrag nowheel lfaa-cnv-node__textarea lfaa-cnv-aivideo-shot__text" size="small" maxLength={2_000} value={shot.dialogue} placeholder="对白与旁白" aria-label="镜头对白" onChange={event => patch({ dialogue: event.target.value })} />
      <label className="lfaa-cnv-field"><span>时长（秒）</span><InputNumber className="nodrag" size="small" min={1} max={120} precision={0} value={shot.durationSeconds} onChange={value => patch({ durationSeconds: typeof value === "number" ? value : 5 })} /></label>
      <label className="lfaa-cnv-field lfaa-cnv-field--stack"><span>角色</span><Select className="nodrag" size="small" mode="multiple" allowClear placeholder="关联角色" value={shot.characterIds} options={characters} onChange={(characterIds: string[]) => patch({ characterIds })} /></label>
      <label className="lfaa-cnv-field lfaa-cnv-field--stack"><span>场景</span><Select className="nodrag" size="small" allowClear placeholder="关联场景" value={shot.locationId} options={locations} onChange={(locationId?: string) => patch({ locationId })} /></label>
      {imageUrl ? <img className="nodrag lfaa-cnv-node__media lfaa-cnv-aivideo-shot__preview" src={imageUrl} alt={shot.title + "分镜图"} loading="lazy" decoding="async" draggable={false} /> : null}
      {videoUrl ? <video className="nodrag nowheel lfaa-cnv-node__media lfaa-cnv-aivideo-shot__preview" src={videoUrl} controls preload="metadata" playsInline aria-label={shot.title + "视频"} /> : null}
      {task?.error ? <p className="lfaa-cnv-node__error" role="alert">{task.error}</p> : null}
      <div className="lfaa-cnv-node__actions lfaa-cnv-aivideo-shot__actions">
        <Button className="nodrag nopan" size="small" disabled={!data.onGenerateShotImage || task?.status === "submitting" || task?.status === "queued" || task?.status === "running"} onClick={() => data.onGenerateShotImage?.(id)}>{imageUrl ? "重生成分镜图" : "生成分镜图"}</Button>
        <Button className="nodrag nopan" size="small" type="primary" disabled={!data.onStartShotVideo || !imageUrl || task?.status === "submitting" || task?.status === "queued" || task?.status === "running"} onClick={() => data.onStartShotVideo?.(id)}>{taskLabel}</Button>
        {task?.status === "queued" || task?.status === "running" || task?.status === "submitting"
          ? <Button className="nodrag nopan" size="small" onClick={() => data.onRefreshShotVideo?.(id)}>刷新</Button> : null}
        {task?.status === "queued" || task?.status === "running" || task?.status === "submitting"
          ? <Button className="nodrag nopan" size="small" danger onClick={() => data.onCancelShotVideo?.(id)}>取消</Button> : null}
      </div>
    </NodeShell>
  );
});

const AiVideoReferenceNodeCard = memo(function AiVideoReferenceNodeCard({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const reference = data.reference ?? { id, kind: "characters" as const, name: "新角色", description: "" };
  const patch = (next: Partial<AiVideoReference & { kind: "characters" | "locations" }>) => data.onPatch(id, { reference: { ...reference, ...next } });
  const { assetUrl } = useCanvasNodeContext();
  const imageUrl = reference.imageAssetId ? assetUrl(data.projectId, reference.imageAssetId) : null;
  return (
    <NodeShell id={id} data={data} selected={selected}>
      <label className="lfaa-cnv-field"><span>档案类型</span><Select className="nodrag" size="small" value={reference.kind} options={[{ value: "characters", label: "角色" }, { value: "locations", label: "场景" }]} onChange={(kind: "characters" | "locations") => patch({ kind })} /></label>
      <label className="lfaa-cnv-field"><span>名称</span><Input className="nodrag" size="small" maxLength={80} value={reference.name} onChange={event => patch({ name: event.target.value })} /></label>
      <Input.TextArea className="nodrag nowheel lfaa-cnv-node__textarea lfaa-cnv-aivideo-reference__description" size="small" maxLength={2_000} value={reference.description} placeholder="外观、性格或场景设定" aria-label="角色或场景描述" onChange={event => patch({ description: event.target.value })} />
      {imageUrl ? <img className="nodrag lfaa-cnv-node__media lfaa-cnv-aivideo-reference__preview" src={imageUrl} alt={reference.name + "参考图"} loading="lazy" decoding="async" draggable={false} /> : <p className="lfaa-cnv-node__advice">可以上传参考图，漫剧 Agent 会在镜头中复用这份设定。</p>}
      <div className="lfaa-cnv-node__actions">
        <label className="lfaa-cnv-aivideo-reference__upload">
          <span>{imageUrl ? "替换参考图" : "上传参考图"}</span>
          <input className="nodrag" type="file" accept="image/png,image/jpeg,image/webp" aria-label={"上传" + reference.name + "参考图"} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) data.onUploadReferenceImage?.(id, file); }} />
        </label>
        {imageUrl ? <Button className="nodrag nopan" size="small" danger onClick={() => data.onRemoveReferenceImage?.(id)}>移除图片</Button> : null}
      </div>
    </NodeShell>
  );
});

const AiVideoTimelineNodeCard = memo(function AiVideoTimelineNodeCard({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const { assets } = useCanvasNodeContext();
  const clips = data.clips ?? [];
  const patch = (next: AiVideoTimelineClip[]) => data.onPatch(id, { clips: next });
  const addClip = (track: AiVideoTimelineClip["track"]) => {
    const end = clips.reduce((latest, clip) => Math.max(latest, clip.startSeconds + clip.durationSeconds), 0);
    const asset = assets.find(item => track === "video" ? item.mimeType.startsWith("video/") : track === "audio" ? item.mimeType.startsWith("audio/") : false);
    const clip: AiVideoTimelineClip = { id: crypto.randomUUID(), track, ...(asset ? { assetId: asset.assetId } : {}), ...(track === "subtitle" ? { text: "" } : {}), startSeconds: Math.round(end * 10) / 10, inPointSeconds: 0, durationSeconds: 3 };
    patch([...clips, clip]);
  };
  const updateClip = (index: number, next: Partial<AiVideoTimelineClip>) => patch(clips.map((clip, clipIndex) => clipIndex === index ? { ...clip, ...next } : clip));
  const removeClip = (index: number) => patch(clips.filter((_clip, clipIndex) => clipIndex !== index));
  const trackOptions = (track: AiVideoTimelineClip["track"]) => assets.filter(asset => track === "video" ? asset.mimeType.startsWith("video/") : track === "audio" ? asset.mimeType.startsWith("audio/") : false).map(asset => ({ value: asset.assetId, label: asset.name }));
  return (
    <NodeShell id={id} data={data} selected={selected}>
      <div className="lfaa-cnv-node__actions lfaa-cnv-aivideo-timeline__add">
        <Button className="nodrag nopan" size="small" onClick={() => addClip("video")}>＋视频</Button>
        <Button className="nodrag nopan" size="small" onClick={() => addClip("audio")}>＋音频</Button>
        <Button className="nodrag nopan" size="small" onClick={() => addClip("subtitle")}>＋字幕</Button>
      </div>
      {clips.map((clip, index) => (
        <section className="lfaa-cnv-aivideo-timeline__clip" key={clip.id}>
          <div className="lfaa-cnv-aivideo-timeline__clip-head"><Tag>{clip.track === "video" ? "视频" : clip.track === "audio" ? "音频" : "字幕"}</Tag><Button className="nodrag nopan" size="small" type="text" danger onClick={() => removeClip(index)}>删除</Button></div>
          {clip.track === "subtitle" ? <Input className="nodrag" size="small" maxLength={1_000} value={clip.text ?? ""} placeholder="字幕内容" onChange={event => updateClip(index, { text: event.target.value })} /> : <Select className="nodrag" size="small" allowClear placeholder="选择项目素材" value={clip.assetId} options={trackOptions(clip.track)} onChange={(assetId?: string) => updateClip(index, { assetId })} />}
          <div className="lfaa-cnv-aivideo-timeline__timing">
            <label>开始<InputNumber className="nodrag" size="small" min={0} max={300} step={0.5} value={clip.startSeconds} onChange={value => updateClip(index, { startSeconds: typeof value === "number" ? value : 0 })} /></label>
            {clip.track !== "subtitle" ? <label>入点<InputNumber className="nodrag" size="small" min={0} max={300} step={0.5} value={clip.inPointSeconds} onChange={value => updateClip(index, { inPointSeconds: typeof value === "number" ? value : 0 })} /></label> : null}
            <label>时长<InputNumber className="nodrag" size="small" min={0.1} max={300} step={0.5} value={clip.durationSeconds} onChange={value => updateClip(index, { durationSeconds: typeof value === "number" ? value : 0.1 })} /></label>
          </div>
        </section>
      ))}
      {clips.length === 0 ? <p className="lfaa-cnv-node__advice">在导演台整理片段、入点和字幕；所有修改与漫剧项目一起保存。</p> : null}
    </NodeShell>
  );
});

const AiVideoDirectorNodeCard = memo(function AiVideoDirectorNodeCard({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const whiteModel = data.whiteModel ?? { items: [], camera: { x: 0, y: 1.6, z: -8, yaw: 0, pitch: -4, focalLength: 50 }, ratio: "16:9" as const };
  const patch = (next: Partial<AiVideoWhiteModel>) => data.onPatch(id, { whiteModel: { ...whiteModel, ...next } });
  const patchCamera = (next: Partial<AiVideoWhiteModel["camera"]>) => patch({ camera: { ...whiteModel.camera, ...next } });
  const addItem = () => patch({ items: [...whiteModel.items, { id: crypto.randomUUID(), name: "白模对象", kind: "block", x: 0, z: 0, width: 1, depth: 1, height: 1 }] });
  return (
    <NodeShell id={id} data={data} selected={selected}>
      <label className="lfaa-cnv-field"><span>画面比例</span><Select className="nodrag" size="small" value={whiteModel.ratio} options={[{ value: "16:9", label: "16:9" }, { value: "9:16", label: "9:16" }, { value: "1:1", label: "1:1" }]} onChange={(ratio: AiVideoWhiteModel["ratio"]) => patch({ ratio })} /></label>
      <div className="lfaa-cnv-aivideo-director__camera">
        <label>镜头 X<InputNumber className="nodrag" size="small" value={whiteModel.camera.x} onChange={value => patchCamera({ x: typeof value === "number" ? value : 0 })} /></label>
        <label>镜头 Y<InputNumber className="nodrag" size="small" value={whiteModel.camera.y} onChange={value => patchCamera({ y: typeof value === "number" ? value : 1.6 })} /></label>
        <label>镜头 Z<InputNumber className="nodrag" size="small" value={whiteModel.camera.z} onChange={value => patchCamera({ z: typeof value === "number" ? value : -8 })} /></label>
        <label>焦距<InputNumber className="nodrag" size="small" min={18} max={120} value={whiteModel.camera.focalLength} onChange={value => patchCamera({ focalLength: typeof value === "number" ? value : 50 })} /></label>
      </div>
      <div className="lfaa-cnv-aivideo-director__items">
        {whiteModel.items.map((item, index) => (
          <div className="lfaa-cnv-aivideo-director__item" key={item.id}>
            <Input className="nodrag" size="small" maxLength={50} value={item.name} aria-label="白模对象名称" onChange={event => patch({ items: whiteModel.items.map((current, position) => position === index ? { ...current, name: event.target.value } : current) })} />
            <Select className="nodrag" size="small" value={item.kind} options={[{ value: "actor", label: "角色" }, { value: "block", label: "方块" }]} onChange={(kind: "actor" | "block") => patch({ items: whiteModel.items.map((current, position) => position === index ? { ...current, kind } : current) })} />
            <Button className="nodrag nopan" size="small" type="text" danger aria-label="删除白模对象" onClick={() => patch({ items: whiteModel.items.filter((_current, position) => position !== index) })}>移除</Button>
          </div>
        ))}
      </div>
      <Button className="nodrag nopan" size="small" onClick={addItem} disabled={whiteModel.items.length >= 32}>添加白模对象</Button>
    </NodeShell>
  );
});

export const CANVAS_NODE_TYPES: NodeTypes = {
  text: TextNodeCard,
  note: TextNodeCard,
  image: MediaNodeCard,
  video: MediaNodeCard,
  audio: MediaNodeCard,
  asset: MediaNodeCard,
  generation: GenerationNodeCard,
  subject: SubjectNodeCard,
  timeline: TimelineNodeCard,
  "director-toolbox": ToolboxNodeCard,
  "director-desk": DeskNodeCard,
  script: ScriptNodeCard,
  shot: AiVideoShotNodeCard,
  "aivideo-reference": AiVideoReferenceNodeCard,
  "aivideo-timeline": AiVideoTimelineNodeCard,
  "aivideo-director": AiVideoDirectorNodeCard
};

/** 功能：编辑 AI 漫剧分镜画布。作用：以无限画布组织可保存镜头卡片和镜头关系，不执行生成工作流。 */
import { addEdge, Background, Controls, Handle, Position, ReactFlow, useEdgesState, useNodesState, type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps, type NodeTypes } from "@xyflow/react";
import { Alert, Button, Input, Popconfirm, Select, Spin, Typography } from "antd";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { aiVideoAssetUrl, aiVideoShotImageUrl, cancelAiVideoShotVideo, createAiVideoCanvas, deleteAiVideoCanvas, generateAiVideoShotImage, getErrorMessage, loadAiVideoCanvases, refreshAiVideoShotVideo, removeAiVideoReferenceImage, saveAiVideoCanvas, startAiVideoShotVideo, uploadAiVideoReferenceImage, type AiVideoCanvas, type AiVideoCanvasInput, type AiVideoReference, type AiVideoShot, type AiVideoTask, type AiVideoTimelineClip, type AiVideoWhiteModel } from "lfaa-client-connection/src/api.js";
import { AiVideoMediaStudio } from "./AiVideoMediaStudio.js";
import { AiVideoDirectorStage } from "./AiVideoDirectorStage.js";
import "@xyflow/react/dist/style.css";
import "./ai-video-canvas.css";

interface ShotNodeData extends Record<string, unknown> {
  title: string;
  description: string;
  dialogue: string;
  durationSeconds: number;
  characterIds: string[];
  locationId?: string;
  characters: AiVideoReference[];
  locations: AiVideoReference[];
  imageAssetId?: string;
  imageMimeType?: AiVideoShot["imageMimeType"];
  imageUrl?: string;
  videoAssetId?: string;
  videoTask?: AiVideoTask;
  videoUrl?: string;
  isGenerating: boolean;
  isVideoOperating: boolean;
  canGenerate: boolean;
  canRemove: boolean;
  canEdit: boolean;
  onGenerate: (id: string) => void;
  onGenerateVideo: (id: string) => void;
  onRefreshVideo: (id: string) => void;
  onCancelVideo: (id: string) => void;
  onChange: (id: string, update: Partial<Pick<AiVideoShot, "title" | "description" | "dialogue" | "durationSeconds" | "characterIds" | "locationId">>) => void;
  onRemove: (id: string) => void;
}

type ShotFlowNode = Node<ShotNodeData, "shot">;
type ShotFlowEdge = Edge;

function nodesFor(canvas: AiVideoCanvas, onShotChange: ShotNodeData["onChange"], onShotRemove: ShotNodeData["onRemove"], onGenerate: ShotNodeData["onGenerate"], onGenerateVideo: ShotNodeData["onGenerateVideo"], onRefreshVideo: ShotNodeData["onRefreshVideo"], onCancelVideo: ShotNodeData["onCancelVideo"]): ShotFlowNode[] {
  return canvas.shots.map(shot => ({
    id: shot.id, type: "shot", position: { x: shot.x, y: shot.y },
    data: { title: shot.title, description: shot.description, dialogue: shot.dialogue, durationSeconds: shot.durationSeconds, characterIds: shot.characterIds ?? [], locationId: shot.locationId, characters: canvas.characters, locations: canvas.locations, imageAssetId: shot.imageAssetId, imageMimeType: shot.imageMimeType, imageUrl: shot.imageAssetId ? aiVideoShotImageUrl(canvas.id, shot.imageAssetId) : undefined, videoAssetId: shot.videoAssetId, videoTask: shot.videoTask, videoUrl: shot.videoAssetId ? aiVideoAssetUrl(canvas.id, shot.videoAssetId) : undefined, isGenerating: false, isVideoOperating: false, canGenerate: false, canRemove: true, canEdit: false, onGenerate, onGenerateVideo, onRefreshVideo, onCancelVideo, onChange: onShotChange, onRemove: onShotRemove }
  }));
}

function edgesFor(canvas: AiVideoCanvas): ShotFlowEdge[] {
  return canvas.links.map(link => ({ id: link.id, source: link.source, target: link.target, type: "smoothstep" }));
}

function inputFor(title: string, script: string, characters: AiVideoReference[], locations: AiVideoReference[], nodes: ShotFlowNode[], edges: ShotFlowEdge[], timelineClips: AiVideoTimelineClip[], whiteModel: AiVideoWhiteModel): AiVideoCanvasInput {
  return {
    title: title.trim(),
    script,
    characters,
    locations,
    shots: nodes.map(node => ({
      id: node.id, title: node.data.title, description: node.data.description, dialogue: node.data.dialogue,
      durationSeconds: node.data.durationSeconds, x: Math.round(node.position.x), y: Math.round(node.position.y),
      characterIds: node.data.characterIds,
      ...(node.data.locationId ? { locationId: node.data.locationId } : {}),
      ...(node.data.imageAssetId && node.data.imageMimeType ? { imageAssetId: node.data.imageAssetId, imageMimeType: node.data.imageMimeType } : {})
    })),
    links: edges.filter(edge => edge.source && edge.target).map(edge => ({ id: edge.id, source: edge.source!, target: edge.target! })),
    timelineClips,
    whiteModel
  };
}

function canvasError(error: unknown, fallback: string): string {
  const message = getErrorMessage(error);
  return message === "发生了未知错误，请重试。" ? fallback : message;
}

function readImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("无法读取所选图片。"));
    reader.onerror = () => reject(new Error("读取图片失败，请重试。"));
    reader.readAsDataURL(file);
  });
}

const ShotNodeCard = memo(function ShotNodeCard({ id, data, selected }: NodeProps<ShotFlowNode>) {
  const updateText = (key: "title" | "description" | "dialogue", value: string) => data.onChange(id, { [key]: value });
  return (
    <article className={`aivideo-shot${selected ? " aivideo-shot--selected" : ""}`} aria-label={`镜头：${data.title}`}>
      <Handle type="target" position={Position.Left} aria-label="镜头连接输入" />
      <header className="aivideo-shot__header">
        <span className="aivideo-shot__mark" aria-hidden="true">镜</span>
        <Input className="aivideo-shot__title nodrag" aria-label="镜头标题" maxLength={80} value={data.title} disabled={!data.canEdit} onChange={event => updateText("title", event.target.value)} />
        <label className="aivideo-shot__duration"><Input className="nodrag" aria-label="镜头时长（秒）" type="number" min={1} max={120} value={data.durationSeconds} disabled={!data.canEdit} onChange={event => data.onChange(id, { durationSeconds: Math.max(1, Math.min(120, Number(event.target.value) || 1)) })} /><span>秒</span></label>
        <Button className="nodrag nopan" size="small" type="text" danger aria-label={`删除镜头：${data.title}`} disabled={!data.canRemove} onClick={() => data.onRemove(id)}>删除</Button>
      </header>
      <label className="aivideo-shot__field"><span>画面与动作（作为出图提示词）</span><Input.TextArea className="nodrag nowheel" aria-label="画面与动作及出图提示词" autoSize={{ minRows: 2, maxRows: 5 }} maxLength={1_000} value={data.description} disabled={!data.canEdit} onChange={event => updateText("description", event.target.value)} placeholder="描述画面、角色动作和镜头变化" /></label>
      <label className="aivideo-shot__field"><span>对白与声音</span><Input.TextArea className="nodrag nowheel" aria-label="对白与声音" autoSize={{ minRows: 1, maxRows: 4 }} maxLength={2_000} value={data.dialogue} disabled={!data.canEdit} onChange={event => updateText("dialogue", event.target.value)} placeholder="记录对白、旁白或声音提示" /></label>
      <label className="aivideo-shot__field"><span>角色参考</span><Select className="nodrag" mode="multiple" aria-label="镜头角色参考" value={data.characterIds} options={data.characters.map(reference => ({ value: reference.id, label: reference.name }))} maxTagCount="responsive" disabled={!data.canEdit} onChange={characterIds => data.onChange(id, { characterIds })} placeholder="选择本项目角色" /></label>
      <label className="aivideo-shot__field"><span>场景参考</span><Select className="nodrag" aria-label="镜头场景参考" allowClear value={data.locationId} options={data.locations.map(reference => ({ value: reference.id, label: reference.name }))} disabled={!data.canEdit} onChange={locationId => data.onChange(id, { locationId })} placeholder="选择本项目场景" /></label>
      {data.imageUrl ? <img className="aivideo-shot__image" src={data.imageUrl} alt={`镜头图片：${data.title}`} /> : null}
      {data.videoUrl ? <video className="aivideo-shot__video" src={data.videoUrl} controls preload="metadata" aria-label={`镜头视频：${data.title}`} /> : null}
      <div className="aivideo-shot__actions nodrag nopan">
        <Button size="small" type="primary" loading={data.isGenerating} disabled={!data.canGenerate || !data.description.trim()} onClick={() => data.onGenerate(id)}>{data.imageAssetId ? "重新生成图片" : "生成图片"}</Button>
        <Button size="small" loading={data.isVideoOperating} disabled={!data.canGenerate || !data.description.trim() || ["submitting", "queued", "running"].includes(data.videoTask?.status ?? "")} onClick={() => data.onGenerateVideo(id)}>{data.videoAssetId ? "重新生成视频" : "生成视频"}</Button>
        {data.videoTask?.status === "queued" || data.videoTask?.status === "running" && data.videoTask.accountId === "local" ? <Button size="small" danger loading={data.isVideoOperating} disabled={data.isVideoOperating} onClick={() => data.onCancelVideo(id)}>{data.videoTask.accountId === "local" ? "取消本机生成" : "取消排队"}</Button> : null}
        {data.videoTask && (data.videoTask.status === "running" || data.videoTask.status === "submitting") ? <Button size="small" loading={data.isVideoOperating} disabled={data.isVideoOperating} onClick={() => data.onRefreshVideo(id)}>刷新状态</Button> : null}
        {data.videoTask?.status === "succeeded" && !data.videoAssetId && !data.videoTask.error ? <Button size="small" loading={data.isVideoOperating} disabled={data.isVideoOperating} onClick={() => data.onRefreshVideo(id)}>下载成片</Button> : null}
        {data.videoTask?.status === "succeeded" && !data.videoAssetId && data.videoTask.error ? <Button size="small" loading={data.isVideoOperating} disabled={data.isVideoOperating} onClick={() => data.onRefreshVideo(id)}>重试下载</Button> : null}
        {!data.canGenerate && !data.isGenerating ? <Typography.Text type="secondary">先保存分镜更改再生成</Typography.Text> : null}
      </div>
      {data.videoTask ? <div className="aivideo-shot__video-status" role="status" aria-live="polite">
        <Typography.Text type={data.videoTask.status === "failed" || data.videoTask.status === "expired" ? "danger" : "secondary"}>{({ submitting: "正在提交视频任务…", queued: "视频任务排队中…", running: "视频正在生成…", succeeded: data.videoAssetId ? "视频已保存到本机项目" : "视频已生成，等待下载" , failed: "视频生成失败", cancelled: "视频任务已取消", expired: "视频任务已过期" } as Record<AiVideoTask["status"], string>)[data.videoTask.status]}</Typography.Text>
        {data.videoTask.error ? <Typography.Text type="danger">{data.videoTask.error}</Typography.Text> : null}
      </div> : null}
      <Handle type="source" position={Position.Right} aria-label="镜头连接输出" />
    </article>
  );
});

const nodeTypes: NodeTypes = { shot: ShotNodeCard };

export function AiVideoCanvasWorkspace({ canOpenFileManager = false, onOpenFileManager }: { canOpenFileManager?: boolean; onOpenFileManager?: (projectId: string) => void }) {
  const [canvases, setCanvases] = useState<AiVideoCanvas[]>([]);
  const [limits, setLimits] = useState({ canvases: 0, shots: 0, links: 0, characters: 0, locations: 0, scriptCharacters: 0, referencesPerShot: 0, referenceImageBytes: 0, referenceImageDimension: 0, referenceImagePixels: 0, imageAssetBytes: 0, mediaAssetBytes: 0, timelineClips: 0, timelineSeconds: 0 });
  const [activeCanvas, setActiveCanvas] = useState<AiVideoCanvas | null>(null);
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [characters, setCharacters] = useState<AiVideoReference[]>([]);
  const [locations, setLocations] = useState<AiVideoReference[]>([]);
  const [timelineClips, setTimelineClips] = useState<AiVideoTimelineClip[]>([]);
  const [whiteModel, setWhiteModel] = useState<AiVideoWhiteModel>({ items: [], camera: { x: 0, y: 1.6, z: -8, yaw: 0, pitch: -4, focalLength: 50 }, ratio: "16:9" });
  const [activePage, setActivePage] = useState("script");
  const [nodes, setNodes, onNodesChange] = useNodesState<ShotFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ShotFlowEdge>([]);
  const [loading, setLoading] = useState(true);
  const [collectionReady, setCollectionReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingShotId, setGeneratingShotId] = useState<string | null>(null);
  const [videoTaskBusyShotId, setVideoTaskBusyShotId] = useState<string | null>(null);
  const [referenceImageOperation, setReferenceImageOperation] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const saveInFlight = useRef(false);
  const videoOperationRef = useRef<string | null>(null);
  const editRevision = useRef(0);
  const selectedId = useRef<string | null>(null);
  const generateShotRef = useRef<(shotId: string) => void>(() => undefined);
  const generateVideoRef = useRef<(shotId: string) => void>(() => undefined);
  const refreshVideoRef = useRef<(shotId: string) => void>(() => undefined);
  const cancelVideoRef = useRef<(shotId: string) => void>(() => undefined);
  const referenceImageOperationRef = useRef<string | null>(null);
  const activeCanvasRef = useRef<AiVideoCanvas | null>(activeCanvas);
  activeCanvasRef.current = activeCanvas;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const videoPollingKey = activeCanvas?.shots.map(shot => `${shot.id}:${shot.videoTask?.localId ?? ""}:${shot.videoTask?.status ?? ""}:${shot.videoAssetId ?? ""}`).join("|") ?? "";
  const onShotGenerate = useCallback((shotId: string) => generateShotRef.current(shotId), []);
  const onVideoGenerate = useCallback((shotId: string) => generateVideoRef.current(shotId), []);
  const onVideoRefresh = useCallback((shotId: string) => refreshVideoRef.current(shotId), []);
  const onVideoCancel = useCallback((shotId: string) => cancelVideoRef.current(shotId), []);

  const markDirty = useCallback(() => { editRevision.current += 1; setDirty(true); setNotice(""); }, []);
  const onShotChange = useCallback((id: string, update: Partial<Pick<AiVideoShot, "title" | "description" | "dialogue" | "durationSeconds" | "characterIds" | "locationId">>) => {
    setNodes(current => current.map(node => node.id === id ? { ...node, data: { ...node.data, ...update } } : node));
    markDirty();
  }, [markDirty, setNodes]);
  const onShotRemove = useCallback((id: string) => {
    setNodes(current => current.filter(node => node.id !== id));
    setEdges(current => current.filter(edge => edge.source !== id && edge.target !== id));
    markDirty();
  }, [markDirty, setEdges, setNodes]);
  const updateReference = (kind: "characters" | "locations", id: string, update: Partial<Pick<AiVideoReference, "name" | "description">>) => {
    const setter = kind === "characters" ? setCharacters : setLocations;
    setter(current => current.map(reference => reference.id === id ? { ...reference, ...update } : reference));
    markDirty();
  };
  const addReference = (kind: "characters" | "locations") => {
    const current = kind === "characters" ? characters : locations;
    const maximum = kind === "characters" ? limits.characters : limits.locations;
    if (current.length >= maximum) { setError(`${kind === "characters" ? "角色" : "场景"}档案最多保存 ${maximum} 条。`); return; }
    const reference = { id: crypto.randomUUID(), name: `${kind === "characters" ? "角色" : "场景"} ${current.length + 1}`, description: "" };
    (kind === "characters" ? setCharacters : setLocations)(items => [...items, reference]);
    markDirty();
  };
  const removeReference = (kind: "characters" | "locations", id: string) => {
    (kind === "characters" ? setCharacters : setLocations)(items => items.filter(reference => reference.id !== id));
    setNodes(current => current.map(node => ({
      ...node,
      data: kind === "characters"
        ? { ...node.data, characterIds: node.data.characterIds.filter(referenceId => referenceId !== id) }
        : { ...node.data, locationId: node.data.locationId === id ? undefined : node.data.locationId }
    })));
    markDirty();
  };
  const selectCanvas = useCallback((canvas: AiVideoCanvas) => {
    selectedId.current = canvas.id;
    editRevision.current += 1;
    setActiveCanvas(canvas);
    setTitle(canvas.title);
    setScript(canvas.script ?? "");
    setCharacters(canvas.characters ?? []);
    setLocations(canvas.locations ?? []);
    setTimelineClips(canvas.timelineClips ?? []);
    setWhiteModel(canvas.whiteModel);
    setActivePage("script");
    setNodes(nodesFor(canvas, onShotChange, onShotRemove, onShotGenerate, onVideoGenerate, onVideoRefresh, onVideoCancel));
    setEdges(edgesFor(canvas));
    setDirty(false);
    setError("");
    setNotice("");
  }, [onShotChange, onShotGenerate, onShotRemove, onVideoCancel, onVideoGenerate, onVideoRefresh, setEdges, setNodes]);

  const applyServerCanvas = useCallback((canvas: AiVideoCanvas) => {
    editRevision.current += 1;
    setActiveCanvas(canvas);
    setCanvases(current => current.map(item => item.id === canvas.id ? canvas : item));
    setTitle(canvas.title);
    setScript(canvas.script);
    setCharacters(canvas.characters);
    setLocations(canvas.locations);
    setTimelineClips(canvas.timelineClips ?? []);
    setWhiteModel(canvas.whiteModel);
    setNodes(nodesFor(canvas, onShotChange, onShotRemove, onShotGenerate, onVideoGenerate, onVideoRefresh, onVideoCancel));
    setEdges(edgesFor(canvas));
    setDirty(false);
  }, [onShotChange, onShotGenerate, onShotRemove, onVideoCancel, onVideoGenerate, onVideoRefresh, setEdges, setNodes]);

  useEffect(() => {
    let active = true;
    void loadAiVideoCanvases().then(({ canvases: result, limits: currentLimits }) => {
      if (!active) return;
      setCollectionReady(true);
      setLimits(currentLimits);
      setCanvases(result);
      const current = result.find(canvas => canvas.id === selectedId.current) ?? result[0];
      if (current) selectCanvas(current);
    }).catch(loadError => {
      if (active) setError(canvasError(loadError, "无法加载分镜画布。"));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectCanvas]);

  useEffect(() => {
    setNodes(current => {
      let changed = false;
      const next = current.map(node => {
        if (node.data.characters === characters && node.data.locations === locations) return node;
        changed = true;
        return { ...node, data: { ...node.data, characters, locations } };
      });
      return changed ? next : current;
    });
  }, [characters, locations, setNodes]);

  useEffect(() => {
    setNodes(current => current.map(node => ({ ...node, data: {
      ...node.data,
      canEdit: !saving,
      canGenerate: Boolean(activeCanvas) && !dirty && !saving && referenceImageOperation === null && generatingShotId === null && videoTaskBusyShotId === null,
      canRemove: !node.data.videoTask || !["submitting", "queued", "running"].includes(node.data.videoTask.status),
      isGenerating: generatingShotId === node.id,
      isVideoOperating: videoTaskBusyShotId === node.id
    } })));
  }, [activeCanvas, dirty, generatingShotId, referenceImageOperation, saving, setNodes, videoTaskBusyShotId]);

  const onFlowNodesChange = useCallback((changes: NodeChange<ShotFlowNode>[]) => {
    onNodesChange(changes);
    if (changes.some(change => change.type === "position" || change.type === "remove")) markDirty();
    const removed = new Set<string>();
    for (const change of changes) if (change.type === "remove") removed.add(change.id);
    if (removed.size) setEdges(current => current.filter(edge => !removed.has(edge.source) && !removed.has(edge.target)));
  }, [markDirty, onNodesChange, setEdges]);
  const onFlowEdgesChange = useCallback((changes: EdgeChange<ShotFlowEdge>[]) => {
    onEdgesChange(changes);
    if (changes.some(change => change.type === "remove")) markDirty();
  }, [markDirty, onEdgesChange]);
  const onConnect = useCallback((connection: Connection) => {
    if (edges.length >= limits.links) { setError(`每个画布最多保存 ${limits.links} 条镜头连线。`); return; }
    setEdges(current => addEdge({ ...connection, id: crypto.randomUUID(), type: "smoothstep" }, current));
    markDirty();
  }, [edges.length, limits.links, markDirty, setEdges]);

  const createCanvas = useCallback(async () => {
    if (dirty && !window.confirm("当前画布有未保存更改，继续后将丢弃这些更改。要继续吗？")) return;
    setError("");
    try {
      const { canvas } = await createAiVideoCanvas(`漫剧项目 ${canvases.length + 1}`);
      setCanvases(current => [canvas, ...current]);
      selectCanvas(canvas);
    } catch (createError) { setError(canvasError(createError, "新建分镜画布失败。")); }
  }, [canvases.length, dirty, selectCanvas]);

  const addShot = useCallback(() => {
    if (nodes.length >= limits.shots) { setError(`每个画布最多添加 ${limits.shots} 个镜头。`); return; }
    const index = nodes.length;
    const node: ShotFlowNode = {
      id: crypto.randomUUID(), type: "shot", position: { x: 80 + index % 3 * 380, y: 80 + Math.floor(index / 3) * 300 },
      data: { title: `镜头 ${index + 1}`, description: "", dialogue: "", durationSeconds: 5, characterIds: [], characters, locations, isGenerating: false, isVideoOperating: false, canGenerate: false, canRemove: true, canEdit: !saving, onGenerate: onShotGenerate, onGenerateVideo: onVideoGenerate, onRefreshVideo: onVideoRefresh, onCancelVideo: onVideoCancel, onChange: onShotChange, onRemove: onShotRemove }
    };
    setNodes(current => [...current, node]);
    markDirty();
  }, [characters, limits.shots, locations, markDirty, nodes.length, onShotChange, onShotGenerate, onShotRemove, onVideoCancel, onVideoGenerate, onVideoRefresh, setNodes]);

  const saveCanvas = useCallback(async () => {
    if (!activeCanvas || saveInFlight.current || !dirty) return;
    saveInFlight.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    const revision = editRevision.current;
    const snapshot = inputFor(title, script, characters, locations, nodes, edges, timelineClips, whiteModel);
    try {
      const { canvas } = await saveAiVideoCanvas(activeCanvas.id, activeCanvas.updatedAt, snapshot);
      setActiveCanvas(canvas);
      setCanvases(current => current.map(item => item.id === canvas.id ? canvas : item));
      if (editRevision.current === revision) {
        setTitle(canvas.title);
        setScript(canvas.script);
        setCharacters(canvas.characters);
        setLocations(canvas.locations);
        setTimelineClips(canvas.timelineClips ?? []);
        setWhiteModel(canvas.whiteModel);
        setNodes(nodesFor(canvas, onShotChange, onShotRemove, onShotGenerate, onVideoGenerate, onVideoRefresh, onVideoCancel));
        setEdges(edgesFor(canvas));
        setDirty(false);
        setNotice("画布已保存。");
      } else {
        setNotice("本次更改已保存，后续编辑仍未保存。");
      }
    } catch (saveError) { setError(canvasError(saveError, "保存分镜画布失败。")); }
    finally { saveInFlight.current = false; setSaving(false); }
  }, [activeCanvas, characters, dirty, edges, locations, nodes, onShotChange, onShotGenerate, onShotRemove, onVideoCancel, onVideoGenerate, onVideoRefresh, script, setEdges, setNodes, timelineClips, title, whiteModel]);

  const updateReferenceImage = useCallback(async (kind: "characters" | "locations", reference: AiVideoReference, file?: File) => {
    if (!activeCanvas || dirty || saving || generatingShotId !== null || referenceImageOperationRef.current !== null) return;
    const operationId = `${kind}:${reference.id}`;
    if (file && file.type !== "image/png" && file.type !== "image/jpeg" && file.type !== "image/webp") {
      setError("参考图片只支持 PNG、JPEG 或 WebP 格式。");
      return;
    }
    if (file && file.size > limits.referenceImageBytes) {
      setError(`参考图片不能超过 ${Math.floor(limits.referenceImageBytes / 1024 / 1024)} MiB。`);
      return;
    }
    referenceImageOperationRef.current = operationId;
    setReferenceImageOperation(operationId);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = file
        ? await uploadAiVideoReferenceImage(activeCanvas.id, kind, reference.id, activeCanvas.updatedAt, await readImageDataUrl(file))
        : await removeAiVideoReferenceImage(activeCanvas.id, kind, reference.id, activeCanvas.updatedAt);
      applyServerCanvas(result.canvas);
      setNotice(file ? "参考图片已保存到本机项目。" : "参考图片已从本机项目移除。");
    } catch (imageError) {
      setError(canvasError(imageError, file ? "保存参考图片失败。" : "移除参考图片失败。"));
    } finally {
      referenceImageOperationRef.current = null;
      setReferenceImageOperation(null);
      setSaving(false);
    }
  }, [activeCanvas, applyServerCanvas, dirty, generatingShotId, limits.referenceImageBytes, saving]);

  const generateShotImage = useCallback(async (shotId: string) => {
    if (!activeCanvas || dirty || saving || generatingShotId !== null) return;
    setError("");
    setNotice("");
    setGeneratingShotId(shotId);
    try {
      const { canvas } = await generateAiVideoShotImage(activeCanvas.id, shotId, activeCanvas.updatedAt);
      setActiveCanvas(canvas);
      setCanvases(current => current.map(item => item.id === canvas.id ? canvas : item));
      editRevision.current += 1;
      setNodes(nodesFor(canvas, onShotChange, onShotRemove, onShotGenerate, onVideoGenerate, onVideoRefresh, onVideoCancel));
      setEdges(edgesFor(canvas));
      setDirty(false);
      setNotice("图片已生成并保存到此项目。");
    } catch (generationError) {
      setError(canvasError(generationError, "图像模型生成失败；没有登记生成结果。"));
    } finally { setGeneratingShotId(null); }
  }, [activeCanvas, dirty, generatingShotId, onShotChange, onShotGenerate, onShotRemove, onVideoCancel, onVideoGenerate, onVideoRefresh, saving, setEdges, setNodes]);

  const applyVideoTaskCanvas = useCallback((canvas: AiVideoCanvas) => {
    activeCanvasRef.current = canvas;
    setActiveCanvas(canvas);
    setCanvases(current => current.map(item => item.id === canvas.id ? canvas : item));
    setNodes(current => current.map(node => {
      const shot = canvas.shots.find(item => item.id === node.id);
      if (!shot) return node;
      return { ...node, data: {
        ...node.data,
        videoAssetId: shot.videoAssetId,
        videoTask: shot.videoTask,
        videoUrl: shot.videoAssetId ? aiVideoAssetUrl(canvas.id, shot.videoAssetId) : undefined,
        canRemove: !shot.videoTask || !["submitting", "queued", "running"].includes(shot.videoTask.status)
      } };
    }));
  }, [setNodes]);

  const generateShotVideo = useCallback(async (shotId: string) => {
    const current = activeCanvasRef.current;
    if (!current || dirtyRef.current || saving || videoOperationRef.current !== null || !current.shots.some(shot => shot.id === shotId)) return;
    videoOperationRef.current = shotId;
    setVideoTaskBusyShotId(shotId);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { canvas } = await startAiVideoShotVideo(current.id, shotId, current.updatedAt);
      applyServerCanvas(canvas);
      const task = canvas.shots.find(shot => shot.id === shotId)?.videoTask;
      setNotice(task?.status === "queued" ? "视频任务已提交并进入服务商队列。" : task?.status === "running" ? "视频任务已提交，服务商正在生成。" : "视频任务已提交并保存到项目。");
    } catch (generationError) {
      try {
        const { canvases } = await loadAiVideoCanvases();
        const updated = canvases.find(canvas => canvas.id === current.id);
        if (updated) applyServerCanvas(updated);
      } catch { /* 保留原始 Provider 错误；本机项目文件仍可在下次打开时读取。 */ }
      setError(canvasError(generationError, "视频任务创建失败；没有显示为生成成功。"));
    } finally {
      videoOperationRef.current = null;
      setVideoTaskBusyShotId(null);
      setSaving(false);
    }
  }, [applyServerCanvas, saving]);

  const refreshShotVideo = useCallback(async (shotId: string) => {
    const current = activeCanvasRef.current;
    if (!current || videoOperationRef.current !== null || !current.shots.some(shot => shot.id === shotId)) return;
    videoOperationRef.current = `refresh:${shotId}`;
    setVideoTaskBusyShotId(shotId);
    setError("");
    try {
      const { canvas } = await refreshAiVideoShotVideo(current.id, shotId);
      if (activeCanvasRef.current?.id === canvas.id) applyVideoTaskCanvas(canvas);
    } catch (refreshError) {
      setError(canvasError(refreshError, "查询视频生成状态失败。"));
    } finally {
      videoOperationRef.current = null;
      setVideoTaskBusyShotId(null);
    }
  }, [applyVideoTaskCanvas]);

  const cancelShotVideo = useCallback(async (shotId: string) => {
    const current = activeCanvasRef.current;
    if (!current || videoOperationRef.current !== null || !current.shots.some(shot => shot.id === shotId)) return;
    videoOperationRef.current = `cancel:${shotId}`;
    setVideoTaskBusyShotId(shotId);
    setSaving(true);
    setError("");
    try {
      const { canvas } = await cancelAiVideoShotVideo(current.id, shotId);
      applyVideoTaskCanvas(canvas);
      setNotice(current.shots.find(shot => shot.id === shotId)?.videoTask?.accountId === "local" ? "本机视频生成已取消。" : "服务商已取消排队任务。");
    } catch (cancelError) {
      setError(canvasError(cancelError, "取消视频排队任务失败。"));
    } finally {
      videoOperationRef.current = null;
      setVideoTaskBusyShotId(null);
      setSaving(false);
    }
  }, [applyVideoTaskCanvas]);

  useEffect(() => {
    generateVideoRef.current = shotId => { void generateShotVideo(shotId); };
    refreshVideoRef.current = shotId => { void refreshShotVideo(shotId); };
    cancelVideoRef.current = shotId => { void cancelShotVideo(shotId); };
  }, [cancelShotVideo, generateShotVideo, refreshShotVideo]);

  useEffect(() => {
    const canvasId = activeCanvas?.id;
    if (!canvasId || saving || generatingShotId !== null) return;
    let mounted = true;
    let timer: number | null = null;
    let poll: () => Promise<void> = async () => {};
    const schedule = (delay: number) => {
      if (!mounted || timer !== null || document.visibilityState !== "visible") return;
      timer = window.setTimeout(() => { timer = null; void poll(); }, delay);
    };
    poll = async () => {
      if (!mounted || document.visibilityState !== "visible") return;
      const canvas = activeCanvasRef.current;
      if (!canvas || canvas.id !== canvasId) return;
      const pending = canvas.shots.filter(shot => shot.videoTask && (
        ["submitting", "queued", "running"].includes(shot.videoTask.status)
        || shot.videoTask.status === "succeeded" && !shot.videoAssetId && !shot.videoTask.error
      ));
      if (!pending.length) return;
      if (videoOperationRef.current !== null) { schedule(5_000); return; }
      const shot = pending[0]!;
      videoOperationRef.current = `poll:${shot.id}`;
      setVideoTaskBusyShotId(shot.id);
      try {
        const { canvas: updated } = await refreshAiVideoShotVideo(canvasId, shot.id);
        if (mounted && activeCanvasRef.current?.id === canvasId) applyVideoTaskCanvas(updated);
      } catch (pollError) {
        if (mounted && activeCanvasRef.current?.id === canvasId) setError(canvasError(pollError, "自动查询视频生成状态失败。"));
      } finally {
        videoOperationRef.current = null;
        if (mounted) setVideoTaskBusyShotId(null);
      }
      schedule(5_000);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") schedule(0);
      else if (timer !== null) { window.clearTimeout(timer); timer = null; }
    };
    document.addEventListener("visibilitychange", onVisibility);
    schedule(1_500);
    return () => {
      mounted = false;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeCanvas?.id, applyVideoTaskCanvas, generatingShotId, saving, videoPollingKey]);

  useEffect(() => { generateShotRef.current = shotId => { void generateShotImage(shotId); }; }, [generateShotImage]);

  const removeCanvas = useCallback(async () => {
    if (!activeCanvas) return;
    if (dirty && !window.confirm("当前画布有未保存更改，删除后将无法恢复。仍要删除吗？")) return;
    setError("");
    try {
      await deleteAiVideoCanvas(activeCanvas.id);
      const remaining = canvases.filter(canvas => canvas.id !== activeCanvas.id);
      setCanvases(remaining);
      if (remaining[0]) selectCanvas(remaining[0]);
      else {
        selectedId.current = null;
        setActiveCanvas(null); setTitle(""); setScript(""); setCharacters([]); setLocations([]); setTimelineClips([]); setNodes([]); setEdges([]); setDirty(false);
      }
    } catch (deleteError) { setError(canvasError(deleteError, "删除分镜画布失败。")); }
  }, [activeCanvas, canvases, selectCanvas, setEdges, setNodes]);

  return (
    <section className="aivideo-workspace" aria-labelledby="aivideo-heading">
      <header className="aivideo-workspace__header">
        <div><Typography.Title id="aivideo-heading" level={2}>AI 漫剧</Typography.Title><Typography.Paragraph>在同一个本机项目里整理剧本、角色与场景，再继续制作分镜。</Typography.Paragraph></div>
        <div className="aivideo-workspace__status" role="status" aria-live="polite">{referenceImageOperation ? "正在保存参考图片…" : saving ? "正在保存…" : generatingShotId ? "正在调用图像模型…" : videoTaskBusyShotId ? "正在同步视频任务…" : dirty ? "有未保存更改" : notice || (activeCanvas ? "已保存" : "")}</div>
      </header>
      {error ? <Alert className="aivideo-workspace__alert" type="error" showIcon message={error} /> : null}
      {loading ? <div className="aivideo-workspace__loading"><Spin /><span>正在读取账户 AI 漫剧项目…</span></div> : <>
          <div className="aivideo-workspace__toolbar">
          <Input className="aivideo-workspace__title" aria-label="项目名称" maxLength={80} value={title} disabled={!activeCanvas || saving} onChange={event => { setTitle(event.target.value); markDirty(); }} placeholder="项目名称" />
          <Button disabled={!collectionReady || saving || referenceImageOperation !== null || canvases.length >= limits.canvases} onClick={() => void createCanvas()}>新建项目</Button>
          <Button disabled={!activeCanvas || nodes.length >= limits.shots || saving} onClick={addShot}>添加镜头</Button>
          {activeCanvas ? <Popconfirm title="删除这个项目？" description="剧本、参考档案、镜头卡片、连线和项目媒体都会一并删除。" okText="删除" cancelText="取消" onConfirm={() => void removeCanvas()}><Button danger disabled={saving || referenceImageOperation !== null}>删除项目</Button></Popconfirm> : null}
          <Button type="primary" disabled={!activeCanvas || !dirty || saving} loading={saving} onClick={() => void saveCanvas()}>保存项目</Button>
        </div>
        <div className="aivideo-workspace__body">
          <aside className="aivideo-board-list" aria-label="AI 漫剧项目列表">
            <div className="aivideo-board-list__heading"><strong>项目</strong><span>{canvases.length}/{limits.canvases}</span></div>
            {canvases.map(canvas => <button key={canvas.id} type="button" disabled={saving || referenceImageOperation !== null} className={`aivideo-board-list__item${activeCanvas?.id === canvas.id ? " is-active" : ""}`} aria-current={activeCanvas?.id === canvas.id ? "page" : undefined} onClick={() => {
              if (dirty && !window.confirm("当前项目有未保存更改，切换后将丢弃这些更改。继续吗？")) return;
              selectCanvas(canvas);
            }}><span>{canvas.title}</span><small>{canvas.shots.length} 个镜头</small></button>)}
            {canvases.length === 0 ? <Typography.Text className="aivideo-board-list__empty" type="secondary">还没有项目</Typography.Text> : null}
          </aside>
          <div className="aivideo-workspace__panel">
            <div className="aivideo-workspace__tabs" role="tablist" aria-label="项目制作页面">
              {[{ key: "script", label: "剧本" }, { key: "references", label: "角色与场景" }, { key: "canvas", label: "分镜画布" }, { key: "media", label: "媒体与时间线" }, { key: "director", label: "白模导演台" }].map(tab => <button key={tab.key} type="button" role="tab" aria-selected={activePage === tab.key} disabled={!activeCanvas || saving} onClick={() => setActivePage(tab.key)}>{tab.label}</button>)}
            </div>
            {!activeCanvas ? <div className="aivideo-workspace__empty"><Typography.Title level={3}>先建一个漫剧项目</Typography.Title><Typography.Paragraph>剧本、参考档案、分镜和生成的图片会保存在各自的本机项目文件夹中。</Typography.Paragraph><Button type="primary" disabled={!collectionReady} onClick={() => void createCanvas()}>新建项目</Button></div> : activePage === "script" ? <div className="aivideo-script" role="tabpanel" aria-label="项目剧本">
              <div className="aivideo-script__heading"><Typography.Title level={4}>剧本</Typography.Title><Typography.Text type="secondary">最多 {limits.scriptCharacters.toLocaleString()} 个字符，随项目一起保存。</Typography.Text></div>
              <Input.TextArea className="aivideo-script__input" aria-label="剧本文本" value={script} maxLength={limits.scriptCharacters} showCount disabled={!activeCanvas || saving} onChange={event => { setScript(event.target.value); markDirty(); }} placeholder="在这里写故事梗概、场景、对白或完整剧本。" />
            </div> : activePage === "references" ? <div className="aivideo-references" role="tabpanel" aria-label="角色与场景档案">
              <section className="aivideo-reference-group" aria-labelledby="aivideo-characters-heading">
                <header><div><Typography.Title id="aivideo-characters-heading" level={4}>角色</Typography.Title><Typography.Text type="secondary">为跨镜头保持人物描述一致。</Typography.Text></div><Button disabled={characters.length >= limits.characters || saving} onClick={() => addReference("characters")}>添加角色</Button></header>
                {characters.length ? <div className="aivideo-reference-grid">{characters.map(reference => <article key={reference.id} className="aivideo-reference-card">
                  <Input aria-label="角色名称" value={reference.name} maxLength={80} disabled={saving} onChange={event => updateReference("characters", reference.id, { name: event.target.value })} />
                  <Input.TextArea aria-label={`${reference.name}角色描述`} value={reference.description} maxLength={2_000} autoSize={{ minRows: 3, maxRows: 7 }} disabled={saving} onChange={event => updateReference("characters", reference.id, { description: event.target.value })} placeholder="外观、服饰、性格和需要保持的特征" />
                  {reference.imageAssetId ? <img className="aivideo-reference-card__image" src={aiVideoAssetUrl(activeCanvas.id, reference.imageAssetId)} alt={`${reference.name}角色参考图`} /> : <Typography.Text type="secondary">尚未添加参考图（单张不超过 {Math.floor(limits.referenceImageBytes / 1024 / 1024)} MiB）</Typography.Text>}
                  <div className="aivideo-reference-card__image-actions"><label className="aivideo-reference-file"><span>{referenceImageOperation === `characters:${reference.id}` ? "正在保存…" : reference.imageAssetId ? "替换参考图" : "上传参考图"}</span><input type="file" accept="image/png,image/jpeg,image/webp" aria-label={`上传或替换${reference.name}角色参考图`} disabled={saving || dirty || referenceImageOperation !== null || generatingShotId !== null} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void updateReferenceImage("characters", reference, file); }} /></label>
                    {reference.imageAssetId ? <Button size="small" type="text" danger disabled={saving || dirty || referenceImageOperation !== null || generatingShotId !== null} onClick={() => void updateReferenceImage("characters", reference)}>移除图片</Button> : null}</div>
                  <Button danger type="text" disabled={saving} onClick={() => removeReference("characters", reference.id)}>删除角色</Button>
                </article>)}</div> : <Typography.Text type="secondary">还没有角色档案。</Typography.Text>}
              </section>
              <section className="aivideo-reference-group" aria-labelledby="aivideo-locations-heading">
                <header><div><Typography.Title id="aivideo-locations-heading" level={4}>场景</Typography.Title><Typography.Text type="secondary">保存地点和环境的共同视觉设定。</Typography.Text></div><Button disabled={locations.length >= limits.locations || saving} onClick={() => addReference("locations")}>添加场景</Button></header>
                {locations.length ? <div className="aivideo-reference-grid">{locations.map(reference => <article key={reference.id} className="aivideo-reference-card">
                  <Input aria-label="场景名称" value={reference.name} maxLength={80} disabled={saving} onChange={event => updateReference("locations", reference.id, { name: event.target.value })} />
                  <Input.TextArea aria-label={`${reference.name}场景描述`} value={reference.description} maxLength={2_000} autoSize={{ minRows: 3, maxRows: 7 }} disabled={saving} onChange={event => updateReference("locations", reference.id, { description: event.target.value })} placeholder="环境、时间、光线、色彩和固定物件" />
                  {reference.imageAssetId ? <img className="aivideo-reference-card__image" src={aiVideoAssetUrl(activeCanvas.id, reference.imageAssetId)} alt={`${reference.name}场景参考图`} /> : <Typography.Text type="secondary">尚未添加参考图（单张不超过 {Math.floor(limits.referenceImageBytes / 1024 / 1024)} MiB）</Typography.Text>}
                  <div className="aivideo-reference-card__image-actions"><label className="aivideo-reference-file"><span>{referenceImageOperation === `locations:${reference.id}` ? "正在保存…" : reference.imageAssetId ? "替换参考图" : "上传参考图"}</span><input type="file" accept="image/png,image/jpeg,image/webp" aria-label={`上传或替换${reference.name}场景参考图`} disabled={saving || dirty || referenceImageOperation !== null || generatingShotId !== null} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void updateReferenceImage("locations", reference, file); }} /></label>
                    {reference.imageAssetId ? <Button size="small" type="text" danger disabled={saving || dirty || referenceImageOperation !== null || generatingShotId !== null} onClick={() => void updateReferenceImage("locations", reference)}>移除图片</Button> : null}</div>
                  <Button danger type="text" disabled={saving} onClick={() => removeReference("locations", reference.id)}>删除场景</Button>
                </article>)}</div> : <Typography.Text type="secondary">还没有场景档案。</Typography.Text>}
              </section>
            </div> : activePage === "media" ? <AiVideoMediaStudio canvas={activeCanvas} clips={timelineClips} dirty={dirty} saving={saving} maxAssetBytes={limits.mediaAssetBytes} maxImageBytes={limits.imageAssetBytes} canOpenFileManager={canOpenFileManager} onOpenFileManager={onOpenFileManager} onTimelineChange={clips => { setTimelineClips(clips); markDirty(); }} onCanvasUpdated={applyServerCanvas} onBusyChange={setSaving} /> : activePage === "director" ? <AiVideoDirectorStage canvas={activeCanvas} stage={whiteModel} shots={nodes.map(node => ({ id: node.id, title: node.data.title }))} dirty={dirty} saving={saving} onChange={stage => { setWhiteModel(stage); markDirty(); }} onCanvasUpdated={applyServerCanvas} onBusyChange={setSaving} /> : <div className="aivideo-canvas" role="tabpanel" aria-label="镜头无限画布">
              <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onFlowNodesChange} onEdgesChange={onFlowEdgesChange} onConnect={onConnect} nodesDraggable={!saving} nodesConnectable={!saving} elementsSelectable={!saving} deleteKeyCode={saving ? null : "Delete"} fitView fitViewOptions={{ padding: 0.22, maxZoom: 1 }} defaultEdgeOptions={{ type: "smoothstep" }} proOptions={{ hideAttribution: true }} aria-label="漫剧镜头无限画布">
                <Background gap={24} size={1} /><Controls showInteractive={false} />
              </ReactFlow>
            </div>}
          </div>
        </div>
        <footer className="aivideo-workspace__footnote"><Typography.Text type="secondary">剧本、档案、镜头、白模构图、时间线和媒体文件都保存在当前账户的本机漫剧项目中。图片/视频生成走设置中心选定的大模型服务；成片本机导出受浏览器编码能力与项目媒体配额限制。</Typography.Text></footer>
      </>}
    </section>
  );
}

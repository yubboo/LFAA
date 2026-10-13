import { Alert, Button, Input, InputNumber, Select, Typography } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { uploadAiVideoShotImage, type AiVideoCanvas, type AiVideoWhiteModel, type AiVideoWhiteModelItem } from "lfaa-client-connection/src/api.js";

interface Point { x: number; y: number; depth: number }

function project(point: [number, number, number], camera: AiVideoWhiteModel["camera"], width: number, height: number): Point | null {
  const yaw = camera.yaw * Math.PI / 180;
  const pitch = camera.pitch * Math.PI / 180;
  const dx = point[0] - camera.x;
  const dz = point[2] - camera.z;
  const cameraX = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const forward = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const dy = point[1] - camera.y;
  const cameraY = dy * Math.cos(pitch) - forward * Math.sin(pitch);
  const depth = dy * Math.sin(pitch) + forward * Math.cos(pitch);
  if (depth < 0.1) return null;
  const focalPixels = camera.focalLength * width / 36;
  return { x: width / 2 + cameraX * focalPixels / depth, y: height / 2 - cameraY * focalPixels / depth, depth };
}

function drawBox(context: CanvasRenderingContext2D, camera: AiVideoWhiteModel["camera"], width: number, height: number, item: AiVideoWhiteModelItem, centerY = item.height / 2, boxHeight = item.height, boxWidth = item.width, boxDepth = item.depth): Point | null {
  const x1 = item.x - boxWidth / 2;
  const x2 = item.x + boxWidth / 2;
  const z1 = item.z - boxDepth / 2;
  const z2 = item.z + boxDepth / 2;
  const y1 = centerY - boxHeight / 2;
  const y2 = centerY + boxHeight / 2;
  const corners = [
    [x1, y1, z1], [x2, y1, z1], [x2, y1, z2], [x1, y1, z2],
    [x1, y2, z1], [x2, y2, z1], [x2, y2, z2], [x1, y2, z2]
  ] as [number, number, number][];
  const points = corners.map(point => project(point, camera, width, height));
  if (points.some(point => !point)) return null;
  const p = points as Point[];
  const faces = [
    { points: [p[4]!, p[5]!, p[6]!, p[7]!], fill: "#f4f4f4" },
    { points: [p[0]!, p[1]!, p[5]!, p[4]!], fill: "#dedede" },
    { points: [p[1]!, p[2]!, p[6]!, p[5]!], fill: "#c9c9c9" },
    { points: [p[2]!, p[3]!, p[7]!, p[6]!], fill: "#e8e8e8" },
    { points: [p[3]!, p[0]!, p[4]!, p[7]!], fill: "#d5d5d5" },
    { points: [p[0]!, p[1]!, p[2]!, p[3]!], fill: "#b9b9b9" }
  ];
  for (const face of faces) {
    context.beginPath();
    context.moveTo(face.points[0]!.x, face.points[0]!.y);
    for (const point of face.points.slice(1)) context.lineTo(point.x, point.y);
    context.closePath();
    context.fillStyle = face.fill;
    context.fill();
    context.strokeStyle = "rgba(45, 49, 58, 0.7)";
    context.lineWidth = 1;
    context.stroke();
  }
  return project([item.x, item.height, item.z], camera, width, height);
}

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }

export function AiVideoDirectorStage(props: {
  canvas: AiVideoCanvas;
  stage: AiVideoWhiteModel;
  shots: Array<{ id: string; title: string }>;
  dirty: boolean;
  saving: boolean;
  onChange: (stage: AiVideoWhiteModel) => void;
  onCanvasUpdated: (canvas: AiVideoCanvas) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { canvas, stage, shots, dirty, saving, onChange, onCanvasUpdated, onBusyChange } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const dragRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [targetShotId, setTargetShotId] = useState(shots[0]?.id ?? "");
  const setOperation = (value: boolean) => { setBusy(value); onBusyChange(value); };

  const draw = useCallback(() => {
    const target = canvasRef.current;
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(bounds.width * scale));
    const height = Math.max(1, Math.round(bounds.height * scale));
    if (target.width !== width || target.height !== height) { target.width = width; target.height = height; }
    const context = target.getContext("2d");
    if (!context) return;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    const viewWidth = bounds.width;
    const viewHeight = bounds.height;
    const surface = getComputedStyle(target);
    context.fillStyle = surface.backgroundColor || "#ececef";
    context.fillRect(0, 0, viewWidth, viewHeight);
    context.strokeStyle = "rgba(95, 101, 112, 0.26)";
    context.lineWidth = 1;
    for (let z = 0; z <= 40; z += 2) {
      const left = project([-20, 0, z], stage.camera, viewWidth, viewHeight);
      const right = project([20, 0, z], stage.camera, viewWidth, viewHeight);
      if (!left || !right) continue;
      context.beginPath(); context.moveTo(left.x, left.y); context.lineTo(right.x, right.y); context.stroke();
    }
    for (let x = -20; x <= 20; x += 2) {
      const near = project([x, 0, 0], stage.camera, viewWidth, viewHeight);
      const far = project([x, 0, 40], stage.camera, viewWidth, viewHeight);
      if (!near || !far) continue;
      context.beginPath(); context.moveTo(near.x, near.y); context.lineTo(far.x, far.y); context.stroke();
    }
    const items = [...stage.items].sort((a, b) => b.z - a.z);
    for (const item of items) {
      if (item.kind === "block") {
        drawBox(context, stage.camera, viewWidth, viewHeight, item);
      } else {
        drawBox(context, stage.camera, viewWidth, viewHeight, item, item.height * 0.69, item.height * 0.52, item.width * 0.72, item.depth * 0.72);
        drawBox(context, stage.camera, viewWidth, viewHeight, item, item.height * 0.22, item.height * 0.4, item.width * 0.34, item.depth * 0.45);
        drawBox(context, stage.camera, viewWidth, viewHeight, item, item.height * 0.92, item.height * 0.2, item.width * 0.3, item.depth * 0.3);
      }
      const label = project([item.x, item.height + 0.3, item.z], stage.camera, viewWidth, viewHeight);
      if (label) { context.font = "12px sans-serif"; context.textAlign = "center"; context.fillStyle = "#454952"; context.fillText(item.name, label.x, label.y - 6); }
    }
    const reticleSize = Math.min(viewWidth, viewHeight) * 0.06;
    context.strokeStyle = "rgba(52, 87, 213, 0.75)";
    context.beginPath(); context.moveTo(viewWidth / 2 - reticleSize, viewHeight / 2); context.lineTo(viewWidth / 2 + reticleSize, viewHeight / 2); context.moveTo(viewWidth / 2, viewHeight / 2 - reticleSize); context.lineTo(viewWidth / 2, viewHeight / 2 + reticleSize); context.stroke();
  }, [stage]);

  useEffect(() => {
    const target = canvasRef.current;
    if (!target) return;
    const observer = new ResizeObserver(draw);
    observer.observe(target);
    draw();
    return () => observer.disconnect();
  }, [draw]);

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState !== "visible") stopCamera(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { document.removeEventListener("visibilitychange", onVisibility); stopCamera(); };
  }, [canvas.id, stopCamera]);

  const startCamera = async () => {
    setError(""); setNotice("");
    if (!navigator.mediaDevices?.getUserMedia) { setError("当前环境不支持设备相机；手机取景需要 HTTPS 或本机安全上下文。 "); return; }
    const requestId = ++cameraRequestRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (requestId !== cameraRequestRef.current || document.visibilityState !== "visible") {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      if (requestId !== cameraRequestRef.current || document.visibilityState !== "visible") {
        if (streamRef.current === stream) stopCamera();
        else stream.getTracks().forEach(track => track.stop());
        return;
      }
      setCameraOn(true);
    } catch (cameraError) {
      if (requestId === cameraRequestRef.current) {
        stopCamera();
        setError(cameraError instanceof Error ? `相机无法启动：${cameraError.message}` : "相机无法启动，请检查设备权限。");
      }
    }
  };

  const captureToShot = async (blob: Blob, label: string) => {
    if (!targetShotId) { setError("先选择要接收取景图的镜头。"); return; }
    if (dirty) { setError("请先保存白模位置和相机参数，再把取景图写入镜头。"); return; }
    setOperation(true); setError(""); setNotice("");
    try {
      const result = await uploadAiVideoShotImage(canvas.id, targetShotId, canvas.updatedAt, blob);
      onCanvasUpdated(result.canvas);
      setNotice(`${label}已保存到所选镜头，可继续作为图像/视频模型参考。`);
    } catch (captureError) { setError(captureError instanceof Error ? captureError.message : "取景图保存失败。"); }
    finally { setOperation(false); }
  };

  const captureWhiteModel = async () => {
    const source = canvasRef.current;
    if (!source) return;
    const output = document.createElement("canvas");
    const ratio = stage.ratio === "9:16" ? 9 / 16 : stage.ratio === "1:1" ? 1 : 16 / 9;
    const width = 1280;
    output.width = width;
    output.height = Math.round(width / ratio);
    const context = output.getContext("2d");
    if (!context) { setError("无法创建白模取景图。"); return; }
    draw();
    context.drawImage(source, 0, 0, output.width, output.height);
    const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, "image/png"));
    if (!blob) { setError("白模取景图编码失败。"); return; }
    await captureToShot(blob, "白模取景图");
  };

  const captureDevice = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) { setError("设备相机还没有提供可拍摄画面。"); return; }
    const scale = Math.min(1, 2048 / Math.max(video.videoWidth, video.videoHeight));
    const output = document.createElement("canvas");
    output.width = Math.max(2, Math.floor(video.videoWidth * scale));
    output.height = Math.max(2, Math.floor(video.videoHeight * scale));
    const context = output.getContext("2d");
    if (!context) { setError("无法创建设备取景图。"); return; }
    context.drawImage(video, 0, 0, output.width, output.height);
    const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob) { setError("设备取景图编码失败。"); return; }
    await captureToShot(blob, "设备取景图");
  };

  const updateCamera = (key: keyof AiVideoWhiteModel["camera"], value: number | null) => {
    if (value === null) return;
    onChange({ ...stage, camera: { ...stage.camera, [key]: value } });
  };
  const updateItem = (id: string, change: Partial<AiVideoWhiteModelItem>) => onChange({ ...stage, items: stage.items.map(item => item.id === id ? { ...item, ...change } : item) });
  const addItem = (kind: AiVideoWhiteModelItem["kind"]) => {
    if (stage.items.length >= 32) { setError("白模数量已达 32 个上限。"); return; }
    const next: AiVideoWhiteModelItem = { id: crypto.randomUUID(), name: kind === "actor" ? `角色白模 ${stage.items.filter(item => item.kind === "actor").length + 1}` : `场景方块 ${stage.items.filter(item => item.kind === "block").length + 1}`, kind, x: 0, z: 4 + stage.items.length * 1.5, width: kind === "actor" ? 0.8 : 2, depth: kind === "actor" ? 0.6 : 2, height: kind === "actor" ? 1.8 : 1.5 };
    onChange({ ...stage, items: [...stage.items, next] });
    setError("");
  };

  const dragStart = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const px = event.clientX - bounds.left;
    const py = event.clientY - bounds.top;
    const closest = stage.items.map(item => ({ item, point: project([item.x, item.height / 2, item.z], stage.camera, bounds.width, bounds.height) }))
      .filter((candidate): candidate is { item: AiVideoWhiteModelItem; point: Point } => candidate.point !== null)
      .sort((a, b) => Math.hypot(a.point.x - px, a.point.y - py) - Math.hypot(b.point.x - px, b.point.y - py))[0];
    if (!closest || Math.hypot(closest.point.x - px, closest.point.y - py) > 90 / scale) return;
    dragRef.current = { id: closest.item.id, x: px, y: py };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - bounds.left - drag.x;
    const dy = event.clientY - bounds.top - drag.y;
    const item = stage.items.find(value => value.id === drag.id);
    if (item) updateItem(item.id, { x: clamp(item.x + dx * 0.025, -50, 50), z: clamp(item.z + dy * 0.03, -50, 50) });
    dragRef.current = { ...drag, x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  return <div className="aivideo-director" role="tabpanel" aria-label="白模导演台与手机取景器">
    {error ? <Alert type="error" showIcon message={error} /> : null}
    {notice ? <Typography.Text type="secondary" role="status">{notice}</Typography.Text> : null}
    {dirty ? <Typography.Text type="warning">白模或相机有未保存更改。保存项目后才能把当前取景写入镜头。</Typography.Text> : null}
    <div className="aivideo-director__toolbar">
      <Button onClick={() => addItem("actor")} disabled={saving || busy || stage.items.length >= 32}>添加白模角色</Button>
      <Button onClick={() => addItem("block")} disabled={saving || busy || stage.items.length >= 32}>添加场景方块</Button>
      <Select aria-label="取景比例" value={stage.ratio} disabled={saving || busy} options={[{ value: "16:9", label: "16:9 横屏" }, { value: "9:16", label: "9:16 竖屏" }, { value: "1:1", label: "1:1 方形" }]} onChange={ratio => onChange({ ...stage, ratio })} />
      <Select aria-label="取景图保存到镜头" value={targetShotId || undefined} placeholder="选择接收镜头" disabled={saving || busy || !shots.length} options={shots.map(shot => ({ value: shot.id, label: shot.title }))} onChange={setTargetShotId} />
      <Button type="primary" disabled={saving || busy || dirty || !targetShotId} onClick={() => void captureWhiteModel()}>保存白模取景到镜头</Button>
    </div>
    <div className="aivideo-director__layout">
      <div className="aivideo-director__scene" style={{ aspectRatio: stage.ratio.replace(":", " / ") }}>
        <canvas ref={canvasRef} aria-label="可拖动白模、可调整视角的三维透视导演台" onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} />
        <span>拖动白模调整场景位置 · 拖动右侧参数调整摄影机</span>
      </div>
      <aside className="aivideo-director__controls">
        <section><h4>摄影机</h4>
          {([ ["x", "横向位置", -100, 100, 0.2], ["y", "高度", -5, 100, 0.2], ["z", "纵向位置", -100, 100, 0.2], ["yaw", "水平角度", -360, 360, 1], ["pitch", "俯仰角度", -85, 85, 1], ["focalLength", "焦距 mm", 18, 120, 1] ] as const).map(([key, label, min, max, step]) => <label key={key}>{label}<InputNumber aria-label={`摄影机${label}`} min={min} max={max} step={step} value={stage.camera[key]} disabled={saving || busy} onChange={value => updateCamera(key, value)} /></label>)}
        </section>
        <section><h4>白模场景</h4>
          {!stage.items.length ? <Typography.Text type="secondary">添加角色或场景方块开始搭建构图。</Typography.Text> : null}
          {stage.items.map(item => <article key={item.id} className="aivideo-director-item">
            <Input aria-label="白模名称" value={item.name} maxLength={50} disabled={saving || busy} onChange={event => updateItem(item.id, { name: event.target.value })} />
            <div><label>横向<InputNumber min={-50} max={50} step={0.2} value={item.x} disabled={saving || busy} onChange={value => typeof value === "number" && updateItem(item.id, { x: value })} /></label><label>纵向<InputNumber min={-50} max={50} step={0.2} value={item.z} disabled={saving || busy} onChange={value => typeof value === "number" && updateItem(item.id, { z: value })} /></label></div>
            <div><label>宽度<InputNumber min={0.2} max={20} step={0.2} value={item.width} disabled={saving || busy} onChange={value => typeof value === "number" && updateItem(item.id, { width: value })} /></label><label>高度<InputNumber min={0.2} max={20} step={0.2} value={item.height} disabled={saving || busy} onChange={value => typeof value === "number" && updateItem(item.id, { height: value })} /></label></div>
            <Button size="small" danger disabled={saving || busy} onClick={() => onChange({ ...stage, items: stage.items.filter(candidate => candidate.id !== item.id) })}>移除白模</Button>
          </article>)}
        </section>
      </aside>
    </div>
    <section className="aivideo-device-viewfinder" aria-labelledby="aivideo-device-heading">
      <header><div><Typography.Title id="aivideo-device-heading" level={4}>手机设备取景器</Typography.Title><Typography.Text type="secondary">在手机上打开安全来源后，授权浏览器访问后置相机；拍摄帧会写入所选镜头。</Typography.Text></div>
        {!cameraOn ? <Button onClick={() => void startCamera()} disabled={busy || saving}>开启相机</Button> : <Button danger onClick={stopCamera}>关闭相机</Button>}
      </header>
      {cameraOn ? <div className="aivideo-device-viewfinder__preview"><video ref={videoRef} autoPlay playsInline muted aria-label="手机实时取景画面" /><Button type="primary" disabled={busy || saving || dirty || !targetShotId} loading={busy} onClick={() => void captureDevice()}>拍摄并保存到镜头</Button></div> : <Typography.Text type="secondary">相机当前关闭；切换项目、离开页面或隐藏窗口时会停止设备媒体轨道。</Typography.Text>}
    </section>
  </div>;
}

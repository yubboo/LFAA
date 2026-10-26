/**
 * 功能：通用画布导演台编辑器。
 * 作用：编辑当前 director-desk 节点的白模、摄影机与环境数据，并交给 CanvasWorkspace 的既有项目保存流程。
 * 关联文件：CanvasWorkspace.tsx、CanvasProjectTransfer.ts、ui-primitives/src/DirectorDeskStage.tsx、canvas-director-desk.css。
 */
import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined, UserOutlined, BlockOutlined } from "@ant-design/icons";
import { Alert, Button, Input, InputNumber, Select, Slider, Spin, Switch, Tooltip, Typography } from "antd";
import type { DirectorDeskObject, DirectorDeskSceneData } from "lfaa-client-ui-primitives/src/DirectorDeskStage.js";
import {
  createDefaultDirectorDeskScene, type CanvasDirectorDeskData
} from "./CanvasProjectTransfer.js";
import "./canvas-director-desk.css";

const DirectorDeskStage = lazy(async () => {
  const module = await import("lfaa-client-ui-primitives/src/DirectorDeskStage.js");
  return { default: module.DirectorDeskStage };
});

interface CanvasDirectorDeskEditorProps {
  desk: CanvasDirectorDeskData;
  snapToGrid: boolean;
  saving: boolean;
  disabled: boolean;
  error: string;
  onChange: (next: CanvasDirectorDeskData) => void;
  onClose: () => void;
  onSaveAndClose: () => void;
}

const OBJECT_LIMIT = 32;

function numberValue(value: number | null, fallback: number, minimum: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}

function objectPosition(index: number): { x: number; z: number } {
  return { x: (index % 5 - 2) * 1.4, z: 2 + Math.floor(index / 5) * 1.8 };
}

function makeObject(kind: DirectorDeskObject["kind"], count: number): DirectorDeskObject {
  const position = objectPosition(count);
  return kind === "actor"
    ? {
        id: crypto.randomUUID(), name: `白模角色 ${count + 1}`, kind,
        x: position.x, y: 0, z: position.z,
        width: 0.8, height: 1.8, depth: 0.6, rotation: 0
      }
    : {
        id: crypto.randomUUID(), name: `场景方块 ${count + 1}`, kind,
        x: position.x, y: 0, z: position.z,
        width: 2, height: 1.5, depth: 1.6, rotation: 0
      };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="lfaa-cnv-director__field"><span>{label}</span>{children}</label>;
}

export function CanvasDirectorDeskEditor({ desk, snapToGrid, saving, disabled, error, onChange, onClose, onSaveAndClose }: CanvasDirectorDeskEditorProps) {
  const scene = useMemo(() => desk.scene ?? createDefaultDirectorDeskScene(), [desk.scene]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(scene.objects[0]?.id ?? null);
  const selectedObject = useMemo(() => scene.objects.find(object => object.id === selectedObjectId) ?? null, [scene.objects, selectedObjectId]);
  const locked = saving || disabled;

  const updateScene = (patch: Partial<DirectorDeskSceneData>) => onChange({ ...desk, scene: { ...scene, ...patch } });
  const updateObject = (id: string, patch: Partial<DirectorDeskObject>) => updateScene({
    objects: scene.objects.map(object => object.id === id ? { ...object, ...patch } : object)
  });
  const updateCamera = (key: keyof DirectorDeskSceneData["camera"], value: number | null, minimum: number, maximum: number) => {
    updateScene({ camera: { ...scene.camera, [key]: numberValue(value, scene.camera[key], minimum, maximum) } });
  };
  const addObject = (kind: DirectorDeskObject["kind"]) => {
    if (locked || scene.objects.length >= OBJECT_LIMIT) return;
    const object = makeObject(kind, scene.objects.length);
    updateScene({ objects: [...scene.objects, object] });
    setSelectedObjectId(object.id);
  };
  const removeSelected = () => {
    if (!selectedObject || locked) return;
    const next = scene.objects.filter(object => object.id !== selectedObject.id);
    updateScene({ objects: next });
    setSelectedObjectId(next[0]?.id ?? null);
  };

  return (
    <section className="lfaa-cnv-director" aria-label="3D 导演台" data-testid="canvas-director-editor">
      <header className="lfaa-cnv-director__header">
        <div className="lfaa-cnv-director__heading">
          <Button type="text" icon={<ArrowLeftOutlined />} aria-label="返回画布" onClick={onClose}>返回画布</Button>
          <div><Typography.Title level={4}>导演台</Typography.Title><Typography.Text type="secondary">摆放白模，调整机位与场景灯光</Typography.Text></div>
        </div>
        <div className="lfaa-cnv-director__actions">
          <span role="status" aria-live="polite">{saving ? "正在保存…" : "更改保存在当前画布项目"}</span>
          <Button type="primary" data-testid="canvas-director-save" loading={saving} disabled={locked} onClick={onSaveAndClose}>保存并返回</Button>
        </div>
      </header>

      {error ? <Alert className="lfaa-cnv-director__error" type="error" showIcon message={error} /> : null}

      <div className="lfaa-cnv-director__layout">
        <aside className="lfaa-cnv-director__library" aria-label="白模素材库">
          <div className="lfaa-cnv-director__panel-heading"><strong>素材库</strong><span>白模</span></div>
          <div className="lfaa-cnv-director__library-list">
            <button type="button" className="lfaa-cnv-director__asset" disabled={locked || scene.objects.length >= OBJECT_LIMIT} data-testid="canvas-director-add-actor" onClick={() => addObject("actor")}>
              <span className="lfaa-cnv-director__asset-preview"><UserOutlined /></span>
              <span><strong>标准角色</strong><small>可编辑的 3D 白模</small></span>
              <PlusOutlined />
            </button>
            <button type="button" className="lfaa-cnv-director__asset" disabled={locked || scene.objects.length >= OBJECT_LIMIT} data-testid="canvas-director-add-prop" onClick={() => addObject("block")}>
              <span className="lfaa-cnv-director__asset-preview lfaa-cnv-director__asset-preview--block"><BlockOutlined /></span>
              <span><strong>场景方块</strong><small>可编辑的基础道具</small></span>
              <PlusOutlined />
            </button>
          </div>
          <p className="lfaa-cnv-director__limit">最多 {OBJECT_LIMIT} 个白模对象</p>
        </aside>

        <main className="lfaa-cnv-director__viewport" aria-label="场景视口">
          <Suspense fallback={<div className="lfaa-cnv-director__loading"><Spin /><span>正在准备 3D 场景…</span></div>}>
            <DirectorDeskStage
              scene={scene}
              selectedObjectId={selectedObjectId}
              snapToGrid={snapToGrid}
              onSelect={setSelectedObjectId}
              onMove={(id, x, z) => updateObject(id, { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 })}
            />
          </Suspense>
        </main>

        <aside className="lfaa-cnv-director__inspector" aria-label="对象与场景属性">
          <section className="lfaa-cnv-director__object-list">
            <div className="lfaa-cnv-director__panel-heading"><strong>对象</strong><span>{scene.objects.length}</span></div>
            {scene.objects.length === 0 ? <p className="lfaa-cnv-director__empty">场景还是空的，从素材库添加角色或方块。</p> : (
              <ul>
                {scene.objects.map(object => (
                  <li key={object.id}>
                    <button type="button" className={"lfaa-cnv-director__object" + (object.id === selectedObjectId ? " is-selected" : "")} aria-pressed={object.id === selectedObjectId} onClick={() => setSelectedObjectId(object.id)}>
                      {object.kind === "actor" ? <UserOutlined /> : <BlockOutlined />}<span>{object.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="lfaa-cnv-director__properties">
            <div className="lfaa-cnv-director__panel-heading"><strong>属性</strong>{selectedObject ? <Tooltip title="删除对象"><Button size="small" type="text" danger aria-label="移除选中白模" icon={<DeleteOutlined />} disabled={locked} onClick={removeSelected} /></Tooltip> : null}</div>

            {selectedObject ? (
              <div className="lfaa-cnv-director__group">
                <h3>选中对象</h3>
                <Field label="名称"><Input size="small" aria-label="白模名称" maxLength={50} value={selectedObject.name} disabled={locked} onChange={event => updateObject(selectedObject.id, { name: event.target.value.slice(0, 50) })} /></Field>
                <div className="lfaa-cnv-director__field-grid">
                  {([ ["x", "横向位置"], ["y", "高度"], ["z", "纵向位置"] ] as const).map(([key, label]) => (
                    <Field key={key} label={label}><InputNumber size="small" aria-label={label} value={selectedObject[key]} min={-50} max={50} step={0.1} disabled={locked} onChange={value => updateObject(selectedObject.id, { [key]: numberValue(value, selectedObject[key], -50, 50) })} /></Field>
                  ))}
                </div>
                <div className="lfaa-cnv-director__field-grid">
                  {([ ["width", "宽度"], ["height", "尺寸高度"], ["depth", "纵深"] ] as const).map(([key, label]) => (
                    <Field key={key} label={label}><InputNumber size="small" aria-label={label} value={selectedObject[key]} min={0.2} max={20} step={0.1} disabled={locked} onChange={value => updateObject(selectedObject.id, { [key]: numberValue(value, selectedObject[key], 0.2, 20) })} /></Field>
                  ))}
                </div>
                <Field label="朝向"><InputNumber size="small" aria-label="对象朝向" value={selectedObject.rotation} min={-360} max={360} step={1} disabled={locked} onChange={value => updateObject(selectedObject.id, { rotation: numberValue(value, selectedObject.rotation, -360, 360) })} /></Field>
              </div>
            ) : (
              <div className="lfaa-cnv-director__group">
                <h3>摄影机</h3>
                <div className="lfaa-cnv-director__field-grid lfaa-cnv-director__field-grid--camera">
                  {([ ["x", "横向位置", -100, 100], ["y", "高度", -5, 100], ["z", "纵向位置", -100, 100], ["yaw", "水平角度", -360, 360], ["pitch", "俯仰角度", -85, 85], ["focalLength", "焦距 mm", 18, 120] ] as const).map(([key, label, min, max]) => (
                    <Field key={key} label={label}><InputNumber size="small" aria-label={`摄影机${label}`} value={scene.camera[key]} min={min} max={max} step={key === "yaw" || key === "pitch" || key === "focalLength" ? 1 : 0.1} disabled={locked} onChange={value => updateCamera(key, value, min, max)} /></Field>
                  ))}
                </div>
                <Button size="small" onClick={() => updateScene({ camera: { ...scene.camera, x: 0, y: 2.4, z: -8, yaw: 0, pitch: -5 } })} disabled={locked}>重置机位</Button>
              </div>
            )}

            <div className="lfaa-cnv-director__group">
              <h3>环境与灯光</h3>
              <Field label="环境预设">
                <Select size="small" aria-label="环境预设" value={scene.environment} disabled={locked} options={[
                  { value: "studio", label: "影棚" }, { value: "sunset", label: "日落" }, { value: "night", label: "夜景" }
                ]} onChange={environment => updateScene({ environment: environment as DirectorDeskSceneData["environment"] })} />
              </Field>
              <Field label="主光强度"><Slider aria-label="主光强度" min={0} max={5} step={0.1} value={scene.keyLightIntensity} disabled={locked} onChange={value => updateScene({ keyLightIntensity: value })} /></Field>
              <Field label="显示地面网格"><Switch aria-label="显示地面网格" checked={scene.showGrid} disabled={locked} onChange={showGrid => updateScene({ showGrid })} /></Field>
              <Typography.Text type="secondary">拖动吸附：{snapToGrid ? "已按画布设置启用" : "按自由位置编辑"}</Typography.Text>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

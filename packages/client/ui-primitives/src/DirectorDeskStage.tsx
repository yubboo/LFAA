/**
 * 功能：共享 3D 导演台场景视口。
 * 作用：在共享 UI Owner 内绘制可拖动物体、透视地面与同场景镜头预览；仅在输入/尺寸/数据变化时渲染，并在卸载时回收 GPU 资源。
 * 关联文件：packages/client/ui-workspace/src/CanvasDirectorDeskEditor.tsx、packages/client/ui-theme/src/tokens.css。
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import "./DirectorDeskStage.css";

export interface DirectorDeskObject {
  id: string;
  name: string;
  kind: "actor" | "block";
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  rotation: number;
}

export interface DirectorDeskCamera {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  focalLength: number;
}

export interface DirectorDeskSceneData {
  objects: DirectorDeskObject[];
  camera: DirectorDeskCamera;
  environment: "studio" | "sunset" | "night";
  keyLightIntensity: number;
  showGrid: boolean;
}

interface DirectorDeskStageProps {
  scene: DirectorDeskSceneData;
  selectedObjectId: string | null;
  snapToGrid: boolean;
  onSelect: (objectId: string | null) => void;
  onMove: (objectId: string, x: number, z: number) => void;
}

interface StageRuntime {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  editorCamera: THREE.PerspectiveCamera;
  filmCamera: THREE.PerspectiveCamera;
  keyLight: THREE.DirectionalLight;
  grid: THREE.GridHelper;
  floor: THREE.Mesh;
  objects: Map<string, THREE.Group>;
}

type PointerGesture =
  | { kind: "orbit"; x: number; y: number }
  | { kind: "move"; objectId: string; y: number; offsetX: number; offsetZ: number; moved: boolean };

const ACTOR_BASE = { width: 0.8, height: 1.8, depth: 0.6 };
const ORBIT_TARGET = new THREE.Vector3(0, 0.8, 0);

function themeColor(root: Element | null, name: string, fallback: string): THREE.Color {
  const value = root ? getComputedStyle(root).getPropertyValue(name).trim() : "";
  const color = new THREE.Color();
  try {
    color.setStyle(value || fallback);
  } catch {
    color.setStyle(fallback);
  }
  return color;
}

function environmentColor(environment: DirectorDeskSceneData["environment"], surface: THREE.Color): THREE.Color {
  if (environment === "sunset") return surface.clone().lerp(new THREE.Color("#703e24"), 0.35);
  if (environment === "night") return surface.clone().lerp(new THREE.Color("#111827"), 0.55);
  return surface;
}

function makeActor(color: THREE.Color): THREE.Group {
  const group = new THREE.Group();
  const material = () => new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02 });
  const addCapsule = (x: number, y: number, z: number, radius: number, length: number, rotationZ = 0) => {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), material());
    mesh.position.set(x, y, z);
    mesh.rotation.z = rotationZ;
    group.add(mesh);
  };
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), material());
  head.position.y = 1.66;
  group.add(head);
  addCapsule(0, 1.22, 0, 0.22, 0.38);
  addCapsule(-0.31, 1.21, 0, 0.075, 0.38, -0.12);
  addCapsule(0.31, 1.21, 0, 0.075, 0.38, 0.12);
  addCapsule(-0.12, 0.48, 0, 0.09, 0.58, -0.04);
  addCapsule(0.12, 0.48, 0, 0.09, 0.58, 0.04);
  group.scale.set(1, 1, 1);
  group.userData.baseScale = [ACTOR_BASE.width, ACTOR_BASE.height, ACTOR_BASE.depth];
  return group;
}

function makeObject(object: DirectorDeskObject, color: THREE.Color): THREE.Group {
  const group = object.kind === "actor"
    ? makeActor(color)
    : new THREE.Group();
  if (object.kind === "block") {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.04 })
    );
    group.add(mesh);
  }
  group.userData.objectId = object.id;
  group.userData.kind = object.kind;
  return group;
}

function disposeGroup(group: THREE.Group): void {
  group.traverse(item => {
    if (item instanceof THREE.Mesh) {
      item.geometry.dispose();
      const materials = Array.isArray(item.material) ? item.material : [item.material];
      for (const material of materials) material.dispose();
    }
  });
}

function objectColor(root: Element | null, selected: boolean): THREE.Color {
  return selected
    ? themeColor(root, "--settings-accent", "#1677ff")
    : new THREE.Color("#d6d9de");
}

function configureObject(group: THREE.Group, object: DirectorDeskObject, color: THREE.Color): void {
  group.position.set(object.x, object.y, object.z);
  group.rotation.y = object.rotation * Math.PI / 180;
  if (object.kind === "actor") {
    group.scale.set(object.width / ACTOR_BASE.width, object.height / ACTOR_BASE.height, object.depth / ACTOR_BASE.depth);
  } else {
    group.scale.set(object.width, object.height, object.depth);
  }
  group.traverse(item => {
    if (item instanceof THREE.Mesh) {
      const materials = Array.isArray(item.material) ? item.material : [item.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) material.color.copy(color);
      }
    }
  });
}

function configureFilmCamera(camera: THREE.PerspectiveCamera, data: DirectorDeskCamera, aspect: number): void {
  const yaw = data.yaw * Math.PI / 180;
  const pitch = data.pitch * Math.PI / 180;
  const direction = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch)
  );
  const focalLength = Math.max(18, Math.min(120, data.focalLength));
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(36 / (2 * focalLength)));
  camera.aspect = aspect;
  camera.position.set(data.x, data.y, data.z);
  camera.lookAt(camera.position.clone().add(direction));
  camera.updateProjectionMatrix();
}

function disposeRuntime(runtime: StageRuntime): void {
  for (const group of runtime.objects.values()) disposeGroup(group);
  runtime.objects.clear();
  runtime.grid.geometry.dispose();
  const gridMaterials = Array.isArray(runtime.grid.material) ? runtime.grid.material : [runtime.grid.material];
  gridMaterials.forEach(material => material.dispose());
  runtime.floor.geometry.dispose();
  const floorMaterials = Array.isArray(runtime.floor.material) ? runtime.floor.material : [runtime.floor.material];
  floorMaterials.forEach(material => material.dispose());
  runtime.renderer.dispose();
  runtime.renderer.forceContextLoss();
}

export function DirectorDeskStage({ scene, selectedObjectId, snapToGrid, onSelect, onMove }: DirectorDeskStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<StageRuntime | null>(null);
  const orbitRef = useRef({ yaw: 0.65, pitch: 0.58, distance: 16 });
  const gestureRef = useRef<PointerGesture | null>(null);
  const frameRef = useRef<number | null>(null);
  const scheduleRenderRef = useRef<() => void>(() => undefined);
  const sceneRef = useRef(scene);
  const [rendererError, setRendererError] = useState("");
  const [rendererReady, setRendererReady] = useState(false);
  sceneRef.current = scene;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let runtime: StageRuntime;
    try {
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.autoClear = false;
      const scene3d = new THREE.Scene();
      const editorCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 180);
      const filmCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
      const hemi = new THREE.HemisphereLight(0xdde5f0, 0x262a30, 1.55);
      const keyLight = new THREE.DirectionalLight(0xffffff, sceneRef.current.keyLightIntensity);
      keyLight.position.set(-4, 9, -5);
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshBasicMaterial({ color: 0x24272c })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.015;
      const grid = new THREE.GridHelper(100, 100, 0x818892, 0x5a6069);
      grid.position.y = 0;
      scene3d.add(hemi, keyLight, floor, grid);
      runtime = { scene: scene3d, renderer, editorCamera, filmCamera, keyLight, grid, floor, objects: new Map() };
      runtimeRef.current = runtime;
      setRendererError("");
      setRendererReady(true);
    } catch (error) {
      setRendererError(error instanceof Error ? error.message : "浏览器无法创建 WebGL 场景。");
      return;
    }

    const draw = () => {
      frameRef.current = null;
      const active = runtimeRef.current;
      const currentHost = hostRef.current;
      const currentCanvas = canvasRef.current;
      const preview = previewRef.current;
      if (!active || !currentHost || !currentCanvas || document.visibilityState !== "visible") return;
      const width = currentHost.clientWidth;
      const height = currentHost.clientHeight;
      if (width < 2 || height < 2) return;
      active.renderer.setSize(width, height, false);
      active.renderer.setScissorTest(true);
      active.scene.background = environmentColor(
        sceneRef.current.environment,
        themeColor(currentHost.closest(".workbench-shell"), "--color-canvas", "#191a1c")
      );
      const orbit = orbitRef.current;
      active.editorCamera.aspect = width / height;
      active.editorCamera.position.set(
        ORBIT_TARGET.x + Math.sin(orbit.yaw) * orbit.distance,
        ORBIT_TARGET.y + Math.sin(orbit.pitch) * orbit.distance,
        ORBIT_TARGET.z + Math.cos(orbit.yaw) * orbit.distance
      );
      active.editorCamera.lookAt(ORBIT_TARGET);
      active.editorCamera.updateProjectionMatrix();

      const canvasRect = currentCanvas.getBoundingClientRect();
      active.renderer.setViewport(0, 0, width, height);
      active.renderer.setScissor(0, 0, width, height);
      active.renderer.clear(true, true, true);
      active.renderer.render(active.scene, active.editorCamera);

      if (preview) {
        const previewRect = preview.getBoundingClientRect();
        const x = Math.max(0, previewRect.left - canvasRect.left);
        const top = Math.max(0, previewRect.top - canvasRect.top);
        const previewWidth = Math.min(previewRect.width, width - x);
        const previewHeight = Math.min(previewRect.height, height - top);
        if (previewWidth > 2 && previewHeight > 2) {
          configureFilmCamera(active.filmCamera, sceneRef.current.camera, previewWidth / previewHeight);
          active.renderer.setViewport(x, height - top - previewHeight, previewWidth, previewHeight);
          active.renderer.setScissor(x, height - top - previewHeight, previewWidth, previewHeight);
          active.renderer.clear(true, true, true);
          active.renderer.render(active.scene, active.filmCamera);
        }
      }
      active.renderer.setScissorTest(false);
    };
    const scheduleDraw = () => {
      if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(draw);
    };
    scheduleRenderRef.current = scheduleDraw;
    const resizeObserver = new ResizeObserver(scheduleDraw);
    resizeObserver.observe(host);
    const themeRoot = host.closest(".workbench-shell");
    const themeObserver = themeRoot ? new MutationObserver(scheduleDraw) : null;
    themeObserver?.observe(themeRoot!, { attributes: true, attributeFilter: ["style", "class", "data-theme"] });
    const handleVisibility = () => { if (document.visibilityState === "visible") scheduleDraw(); };
    document.addEventListener("visibilitychange", handleVisibility);
    scheduleDraw();

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      orbitRef.current.distance = THREE.MathUtils.clamp(orbitRef.current.distance * (event.deltaY > 0 ? 1.09 : 0.92), 4, 40);
      scheduleDraw();
    };
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      resizeObserver.disconnect();
      themeObserver?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("wheel", handleWheel);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      scheduleRenderRef.current = () => undefined;
      disposeRuntime(runtime);
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const ids = new Set(scene.objects.map(object => object.id));
    for (const [id, group] of runtime.objects) {
      if (!ids.has(id)) {
        runtime.scene.remove(group);
        disposeGroup(group);
        runtime.objects.delete(id);
      }
    }
    const root = hostRef.current?.closest(".workbench-shell") ?? null;
    for (const object of scene.objects) {
      let group = runtime.objects.get(object.id);
      if (!group) {
        group = makeObject(object, objectColor(root, object.id === selectedObjectId));
        runtime.objects.set(object.id, group);
        runtime.scene.add(group);
      }
      configureObject(group, object, objectColor(root, object.id === selectedObjectId));
    }
    runtime.keyLight.intensity = scene.keyLightIntensity;
    runtime.grid.visible = scene.showGrid;
    const surface = themeColor(root, "--color-surface", "#24272b");
    (runtime.floor.material as THREE.MeshBasicMaterial).color.copy(surface);
    const gridColor = themeColor(root, "--color-border-strong", "#747a83");
    const gridMaterials = Array.isArray(runtime.grid.material) ? runtime.grid.material : [runtime.grid.material];
    gridMaterials.forEach(material => {
      if (material instanceof THREE.LineBasicMaterial) material.color.copy(gridColor);
    });
    scheduleRenderRef.current();
  }, [rendererReady, scene, selectedObjectId]);

  const pointOnGround = (event: ReactPointerEvent<HTMLCanvasElement>, y: number): THREE.Vector3 | null => {
    const runtime = runtimeRef.current;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!runtime || rect.width < 2 || rect.height < 2) return null;
    const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, runtime.editorCamera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, runtime.editorCamera);
    const hit = raycaster.intersectObjects([...runtime.objects.values()], true).find(item => {
      let current: THREE.Object3D | null = item.object;
      while (current && typeof current.userData.objectId !== "string") current = current.parent;
      return Boolean(current);
    });
    if (hit) {
      let target: THREE.Object3D | null = hit.object;
      while (target && typeof target.userData.objectId !== "string") target = target.parent;
      const objectId = target?.userData.objectId as string | undefined;
      const object = sceneRef.current.objects.find(item => item.id === objectId);
      const point = object ? pointOnGround(event, object.y) : null;
      if (object && point) {
        onSelect(object.id);
        gestureRef.current = { kind: "move", objectId: object.id, y: object.y, offsetX: object.x - point.x, offsetZ: object.z - point.z, moved: false };
      }
    } else {
      onSelect(null);
      gestureRef.current = { kind: "orbit", x: event.clientX, y: event.clientY };
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const gesture = gestureRef.current;
    const runtime = runtimeRef.current;
    if (!gesture || !runtime) return;
    if (gesture.kind === "orbit") {
      const deltaX = event.clientX - gesture.x;
      const deltaY = event.clientY - gesture.y;
      gesture.x = event.clientX;
      gesture.y = event.clientY;
      orbitRef.current.yaw -= deltaX * 0.007;
      orbitRef.current.pitch = THREE.MathUtils.clamp(orbitRef.current.pitch + deltaY * 0.005, 0.08, 1.35);
      scheduleRenderRef.current();
      return;
    }
    const point = pointOnGround(event, gesture.y);
    const group = runtime.objects.get(gesture.objectId);
    if (!point || !group) return;
    let x = point.x + gesture.offsetX;
    let z = point.z + gesture.offsetZ;
    if (snapToGrid) {
      x = Math.round(x * 2) / 2;
      z = Math.round(z * 2) / 2;
    }
    group.position.x = x;
    group.position.z = z;
    gesture.moved = true;
    scheduleRenderRef.current();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const gesture = gestureRef.current;
    const runtime = runtimeRef.current;
    if (gesture?.kind === "move" && gesture.moved && runtime) {
      const group = runtime.objects.get(gesture.objectId);
      if (group) onMove(gesture.objectId, group.position.x, group.position.z);
    }
    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="lfaa-director-stage" ref={hostRef} data-testid="canvas-director-stage">
      <canvas
        ref={canvasRef}
        className="lfaa-director-stage__canvas"
        tabIndex={0}
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
        aria-label="3D 导演台场景；拖动空白处旋转视角，选择角色或道具后可拖动位置"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={event => {
          if (event.key === "ArrowLeft") orbitRef.current.yaw += 0.08;
          else if (event.key === "ArrowRight") orbitRef.current.yaw -= 0.08;
          else if (event.key === "ArrowUp") orbitRef.current.pitch = THREE.MathUtils.clamp(orbitRef.current.pitch - 0.06, 0.08, 1.35);
          else if (event.key === "ArrowDown") orbitRef.current.pitch = THREE.MathUtils.clamp(orbitRef.current.pitch + 0.06, 0.08, 1.35);
          else return;
          event.preventDefault();
          scheduleRenderRef.current();
        }}
      />
      <div className="lfaa-director-stage__preview" ref={previewRef} aria-label="当前相机镜头预览" data-testid="canvas-director-camera-preview">
        <span>镜头预览</span>
      </div>
      {rendererError ? <p className="lfaa-director-stage__fallback" role="status">3D 预览不可用：{rendererError}。仍可使用右侧属性编辑并保存场景。</p> : null}
      <p className="lfaa-director-stage__help">拖动空白处环绕场景 · 滚轮缩放 · 拖动物体调整位置</p>
    </div>
  );
}

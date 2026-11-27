// 浏览器白模视口：自由机位、轨迹预览，以及选中对象的三轴操作。
import { useEffect, useRef } from "react";
import { Raycaster, Vector2 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import type { StageScene, Vector } from "@lfaa/canvas/contract";
import { makeStage } from "./stage-renderer";
import { cameraAt, type CameraKey } from "./stage-scene";
import styles from "./Previs.module.css";

interface ViewProps {
  stage: StageScene; time: number; cameraPreview: boolean; rotation: boolean; selected: string | null;
  orbitView: { current: CameraKey | null }; onSelect: (id: string) => void;
  onTransform: (id: string, position: Vector, rotation: number) => void; onError: (error: unknown) => void;
}

export function StageViewport(props: ViewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<(() => void) | null>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    let stage: ReturnType<typeof makeStage>;
    try {
      stage = makeStage(surface);
    } catch (cause) {
      latest.current.onError(cause);
      return;
    }
    const { camera, scene, bodies } = stage;
    const initial = cameraAt(latest.current.stage, latest.current.time);
    const view = latest.current.orbitView.current ?? initial;
    camera.position.set(...view.position);
    const orbit = new OrbitControls(camera, surface);
    orbit.target.set(...view.target);
    orbit.update();
    const controls = new TransformControls(camera, surface);
    controls.showY = false;
    scene.add(controls.getHelper());
    const ray = new Raycaster();
    const point = new Vector2();

    function update() {
      const state = latest.current;
      stage.update(state.stage, state.time, state.cameraPreview);
      if (!state.cameraPreview) {
        const remembered = state.orbitView.current;
        if (!orbit.enabled && remembered) {
          orbit.target.set(...remembered.target);
          camera.position.set(...remembered.position);
        }
        orbit.enabled = true;
        orbit.update();
        state.orbitView.current = { time: state.time, position: camera.position.toArray(), target: orbit.target.toArray() };
      } else orbit.enabled = false;
      controls.setMode(state.rotation ? "rotate" : "translate");
      controls.showX = !state.rotation;
      controls.showY = state.rotation;
      controls.showZ = !state.rotation;
      const selected = !state.cameraPreview && state.selected ? bodies.get(state.selected) : undefined;
      if (selected && controls.object !== selected) controls.attach(selected);
      if (!selected && controls.object) controls.detach();
      stage.draw();
    }

    const drawOrbit = () => {
      const state = latest.current;
      if (state.cameraPreview) return;
      state.orbitView.current = { time: state.time, position: camera.position.toArray(), target: orbit.target.toArray() };
      stage.draw();
    };
    const dragState = (event: { value: unknown }) => { orbit.enabled = !event.value; };
    const saveTransform = () => {
      const object = controls.object;
      const id = object?.userData["stageId"];
      if (object && typeof id === "string") latest.current.onTransform(id, object.position.toArray(), object.rotation.y);
    };
    let clickedAt: [number, number] | undefined;
    const rememberPointer = (event: PointerEvent) => { clickedAt = [event.clientX, event.clientY]; };
    const pick = (event: PointerEvent) => {
      if (!clickedAt || latest.current.cameraPreview || controls.dragging || controls.axis ||
        Math.hypot(event.clientX - clickedAt[0], event.clientY - clickedAt[1]) > 4) return;
      const rect = surface.getBoundingClientRect();
      point.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      ray.setFromCamera(point, camera);
      const selected = ray.intersectObjects([...bodies.values()], true)[0]?.object.parent?.userData["stageId"];
      if (typeof selected === "string") latest.current.onSelect(selected);
    };
    const resize = () => {
      const rect = surface.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) stage.size(Math.floor(rect.width), Math.floor(rect.height));
      update();
    };
    frame.current = update;
    orbit.addEventListener("change", drawOrbit);
    controls.addEventListener("change", stage.draw);
    controls.addEventListener("dragging-changed", dragState);
    controls.addEventListener("mouseUp", saveTransform);
    surface.addEventListener("pointerdown", rememberPointer);
    surface.addEventListener("pointerup", pick);
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    resize();
    return () => {
      frame.current = null;
      observer.disconnect();
      surface.removeEventListener("pointerdown", rememberPointer);
      surface.removeEventListener("pointerup", pick);
      orbit.dispose();
      controls.dispose();
      stage.dispose();
    };
  }, []);

  useEffect(() => { frame.current?.(); }, [props.stage, props.time, props.cameraPreview, props.rotation, props.selected]);
  return <canvas ref={canvas} className={styles.viewport} data-ratio={props.stage.ratio} data-camera-preview={props.cameraPreview} />;
}

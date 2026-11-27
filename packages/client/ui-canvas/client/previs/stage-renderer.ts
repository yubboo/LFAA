// Three.js 简模与摄像机渲染。资源由所属视口或导出操作独占和清理。
import {
  BoxGeometry, CapsuleGeometry, Color, DirectionalLight, GridHelper, Group, HemisphereLight, Mesh,
  MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, SphereGeometry, WebGLRenderer,
} from "three";
import type { StageObject, StageScene } from "@lfaa/canvas/contract";
import { cameraAt, objectPosition } from "./stage-scene";

export function makeStage(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  const scene = new Scene();
  scene.background = new Color().setScalar(0.21);
  const camera = new PerspectiveCamera(42, 16 / 9, 0.08, 120);
  const bodies = new Map<string, Group>();
  const geometries = [
    new BoxGeometry(1, 1, 1), new SphereGeometry(0.55, 24, 12), new PlaneGeometry(90, 90),
    new CapsuleGeometry(0.22, 0.55), new SphereGeometry(0.16, 16, 12), new CapsuleGeometry(0.09, 0.48),
  ] as const;
  const [box, sphere, plane, torso, head, limb] = geometries;
  const clay = new MeshStandardMaterial({ color: new Color().setScalar(0.79), roughness: 0.94 });
  const ground = new MeshStandardMaterial({ color: new Color().setScalar(0.34), roughness: 1 });
  const floor = new Mesh(plane, ground);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.012;
  const grid = new GridHelper(38, 38, new Color().setScalar(0.49), new Color().setScalar(0.4));
  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 8, 5);
  scene.add(floor, grid, sun, new HemisphereLight(0xffffff, 0x888888, 1.7));

  function makeObject(object: StageObject) {
    const group = new Group();
    const add = (geometry: typeof geometries[number], x: number, y: number, z: number, roll = 0) => {
      const mesh = new Mesh(geometry, clay);
      mesh.position.set(x, y, z);
      mesh.rotation.z = roll;
      group.add(mesh);
    };
    if (object.kind === "actor") {
      add(torso, 0, 1.08, 0);
      add(head, 0, 1.71, 0);
      add(limb, -0.31, 1.06, 0, -0.26);
      add(limb, 0.31, 1.06, 0, 0.26);
      add(limb, -0.13, 0.34, 0);
      add(limb, 0.13, 0.34, 0);
    } else if (object.kind === "box") add(box, 0, 0.5, 0);
    else add(sphere, 0, 0.55, 0);
    group.userData["stageId"] = object.id;
    scene.add(group);
    bodies.set(object.id, group);
    return group;
  }

  function update(stage: StageScene, time: number, positionCamera = true) {
    const wanted = new Set(stage.objects.map((item) => item.id));
    for (const [id, group] of bodies) if (!wanted.has(id)) {
      scene.remove(group);
      bodies.delete(id);
    }
    for (const object of stage.objects) {
      const group = bodies.get(object.id) ?? makeObject(object);
      group.position.set(...objectPosition(object, time));
      group.rotation.y = object.rotation;
    }
    if (positionCamera) {
      const view = cameraAt(stage, time);
      camera.position.set(...view.position);
      camera.lookAt(...view.target);
    }
  }

  function size(width: number, height: number) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  return {
    scene, camera, bodies, update, size,
    draw: () => renderer.render(scene, camera),
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of [clay, ground, grid.material]) material.dispose();
      grid.geometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

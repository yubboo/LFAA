// 纯白模场景初始化与关键帧采样，供实时视口和静帧/短片导出共用。
import type { StageScene, StageObject, Vector } from "@lfaa/canvas/contract";

export type CameraKey = StageScene["camera"][number];

export function defaultStage(): StageScene {
  return { duration: 5, ratio: "16:9", objects: [], camera: [{ time: 0, position: [5, 3, 7], target: [0, 1, 0] }] };
}

export function newStageObject(kind: StageObject["kind"], n: number): StageObject {
  return { id: crypto.randomUUID(), kind, position: [n % 3, 0, -Math.floor(n / 3)], rotation: 0, keys: [] };
}

function interpolate<T extends { time: number }>(keys: T[], time: number, value: (frame: T) => Vector, fallback: Vector): Vector {
  const sorted = [...keys].sort((left, right) => left.time - right.time);
  const first = sorted[0];
  if (!first) return fallback;
  if (time <= first.time) return value(first);
  let left = first;
  for (const right of sorted.slice(1)) {
    if (time <= right.time) {
      const a = value(left);
      const b = value(right);
      const progress = (time - left.time) / (right.time - left.time);
      return [a[0] + (b[0] - a[0]) * progress, a[1] + (b[1] - a[1]) * progress, a[2] + (b[2] - a[2]) * progress];
    }
    left = right;
  }
  return value(left);
}

export function objectPosition(object: StageObject, time: number): Vector {
  const keys = object.keys.some((key) => key.time === 0) ? object.keys : [{ time: 0, position: object.position }, ...object.keys];
  return interpolate(keys, time, (key) => key.position, object.position);
}

export function cameraAt(scene: StageScene, time: number): CameraKey {
  return {
    time,
    position: interpolate(scene.camera, time, (key) => key.position, [5, 3, 7]),
    target: interpolate(scene.camera, time, (key) => key.target, [0, 1, 0]),
  };
}

export function setKey<T extends { time: number }>(keys: T[], current: T): T[] {
  return [...keys.filter((item) => item.time !== current.time), current].sort((left, right) => left.time - right.time);
}

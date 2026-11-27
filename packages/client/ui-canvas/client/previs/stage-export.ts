// 在独立渲染画布输出当前静帧或按关键帧播放的真实视频文件。
import type { StageScene } from "@lfaa/canvas/contract";
import { makeStage } from "./stage-renderer";

function outputStage(scene: StageScene) {
  const canvas = document.createElement("canvas");
  const size = scene.ratio === "16:9" ? [960, 540] as const : [540, 960] as const;
  const stage = makeStage(canvas);
  stage.size(size[0], size[1]);
  return { ...stage, canvas };
}

export async function renderFrame(scene: StageScene, time: number): Promise<Blob> {
  const stage = outputStage(scene);
  try {
    stage.update(scene, time);
    stage.draw();
    return await new Promise<Blob>((resolve, reject) => stage.canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("无法导出静帧 / Frame export failed"));
    }, "image/png"));
  } finally {
    stage.dispose();
  }
}

export async function renderClip(scene: StageScene, signal: AbortSignal): Promise<Blob> {
  const mime = ["video/mp4;codecs=avc1.42001E", "video/mp4", "video/webm;codecs=vp8"]
    .find((item) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(item));
  if (!mime) throw new Error("浏览器无法录制预演 / Video recording unavailable");
  signal.throwIfAborted();
  const stage = outputStage(scene);
  let stream: MediaStream | undefined;
  try {
    stage.update(scene, 0);
    stage.draw();
    stream = stage.canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_500_000 });
    return await new Promise<Blob>((resolve, reject) => {
      const chunks: Blob[] = [];
      const start = performance.now();
      let timeout: ReturnType<typeof setInterval> | undefined;
      const cancel = () => {
        clearInterval(timeout);
        if (recorder.state !== "inactive") recorder.stop();
        reject(signal.reason);
      };
      const cleanup = () => {
        clearInterval(timeout);
        signal.removeEventListener("abort", cancel);
      };
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        cleanup();
        reject(new Error("预演录制失败 / Recording failed"));
      };
      recorder.onstop = () => {
        cleanup();
        const clip = new Blob(chunks, { type: mime.split(";")[0] ?? mime });
        if (clip.size) resolve(clip);
        else reject(new Error("预演视频为空 / Empty recording"));
      };
      recorder.start();
      signal.addEventListener("abort", cancel, { once: true });
      timeout = setInterval(() => {
        const seconds = Math.min(scene.duration, (performance.now() - start) / 1000);
        stage.update(scene, seconds);
        stage.draw();
        if (seconds >= scene.duration) {
          clearInterval(timeout);
          recorder.stop();
        }
      }, 1000 / 30);
    });
  } finally {
    for (const track of stream?.getTracks() ?? []) track.stop();
    stage.dispose();
  }
}

// 浏览器视频处理：定位采样、画面变换与按音视频轨道导出，退出时释放媒体流。
import type { CropPercent, MediaSize } from "./canvas-media-image";

type CaptureVideo = HTMLVideoElement & { captureStream?: () => MediaStream };
type ExportTracks = "both" | "video" | "audio";

interface VideoPicture { region: CropPercent; size: MediaSize }

interface ClipOptions { tracks?: ExportTracks; picture?: VideoPicture }

function recordingMime(tracks: ExportTracks): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = tracks === "audio" ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
    : tracks === "video" ? ["video/webm;codecs=vp8", "video/webm", "video/mp4"]
    : ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime));
}

export function canTrimVideo(video: HTMLVideoElement, tracks: ExportTracks = "both"): boolean {
  return typeof (video as CaptureVideo).captureStream === "function" && Boolean(recordingMime(tracks));
}

/** 只在浏览器完成定位后开始截取，避免录入上一帧。 */
export function seekVideo(video: HTMLVideoElement, time: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  if (video.currentTime === time && !video.seeking) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("seeked", ready);
      video.removeEventListener("error", failed);
      signal.removeEventListener("abort", cancel);
      clearTimeout(timeout);
    };
    const ready = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("无法定位视频帧 / Video seek failed")); };
    const cancel = () => { cleanup(); reject(signal.reason); };
    const timeout = setTimeout(failed, 5000);
    video.addEventListener("seeked", ready, { once: true });
    video.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", cancel, { once: true });
    video.currentTime = time;
  });
}

/** 从半开区间均匀取样，避开可能已经没有可读帧的精确结束点。 */
export function frameSampleTimes(start: number, end: number, count: number): number[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= end || !Number.isInteger(count) || count < 1 || count > 12) {
    throw new RangeError("无效的取帧区间 / Invalid frame sampling range");
  }
  return Array.from({ length: count }, (_, index) => start + (end - start) * index / count);
}

/** 将裁切或缩放后的画面作为新视频轨道，声音从原播放器复制。 */
function transformedPicture(video: HTMLVideoElement, { region, size }: VideoPicture) {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || typeof canvas.captureStream !== "function") throw new Error("浏览器无法处理视频画面 / Video transform unavailable");
  ctx.imageSmoothingQuality = "high";
  const draw = () => ctx.drawImage(video, region.x, region.y, region.width, region.height, 0, 0, size.width, size.height);
  draw();
  return { draw, stream: canvas.captureStream(30) };
}

export async function exportVideoClip(video: HTMLVideoElement, start: number, end: number, signal: AbortSignal, options: ClipOptions = {}): Promise<Blob> {
  const tracks = options.tracks ?? "both";
  const mime = recordingMime(tracks);
  const source = video as CaptureVideo;
  if (!mime || typeof source.captureStream !== "function") throw new Error("无法截取片段 / Clip export unavailable");
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > video.duration) {
    throw new Error("起止时间超出视频范围 / Invalid clip range");
  }

  video.pause();
  await seekVideo(video, start, signal);
  signal.throwIfAborted();
  const original = source.captureStream();
  let picture: ReturnType<typeof transformedPicture> | undefined;
  try {
    if (options.picture) picture = transformedPicture(video, options.picture);
    const images = (picture?.stream ?? original).getVideoTracks();
    const audio = original.getAudioTracks();
    if (tracks === "audio" && audio.length === 0) throw new Error("此视频没有可导出的音轨 / No audio track");
    if (tracks !== "audio" && images.length === 0) throw new Error("此文件没有可导出的视频轨 / No video track");
    const stream = new MediaStream(tracks === "audio" ? audio : tracks === "video" ? images : [...images, ...audio]);
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_500_000 });
    return await new Promise<Blob>((resolve, reject) => {
      const chunks: Blob[] = [];
      let bytes = 0;
      const stop = () => { if (recorder.state !== "inactive") recorder.stop(); };
      const tick = () => {
        if (video.currentTime >= end) { stop(); return; }
        if (picture && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          try { picture.draw(); } catch (error) { fail(error); }
        }
      };
      const cleanup = () => {
        clearTimeout(timeout);
        clearInterval(timer);
        video.removeEventListener("ended", stop);
        video.removeEventListener("error", failed);
        signal.removeEventListener("abort", cancel);
      };
      const fail = (cause: unknown) => { cleanup(); stop(); reject(cause); };
      const failed = () => fail(new Error("视频片段导出失败 / Clip export failed"));
      const cancel = () => fail(signal.reason);
      const timeout = setTimeout(failed, (end - start) * 2000 + 6000);
      const timer = setInterval(tick, 25);
      recorder.ondataavailable = (event) => {
        if (!event.data.size) return;
        bytes += event.data.size;
        if (bytes > 24 * 1024 * 1024) {
          fail(new Error("片段超过 24 MiB，请缩短时间范围 / Clip exceeds 24 MiB"));
          return;
        }
        chunks.push(event.data);
      };
      recorder.onstop = () => {
        cleanup();
        const blob = new Blob(chunks, { type: mime.split(";")[0] ?? mime });
        if (blob.size) resolve(blob);
        else reject(new Error("视频片段为空 / Empty clip"));
      };
      recorder.onerror = failed;
      video.addEventListener("ended", stop, { once: true });
      video.addEventListener("error", failed, { once: true });
      signal.addEventListener("abort", cancel, { once: true });
      try {
        recorder.start(500);
        void video.play().catch(fail);
      } catch (error) {
        fail(error);
      }
    });
  } finally {
    video.pause();
    for (const track of original.getTracks()) track.stop();
    for (const track of picture?.stream.getTracks() ?? []) track.stop();
  }
}

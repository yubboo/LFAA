import { aiVideoAssetUrl, type AiVideoCanvas, type AiVideoMediaAsset, type AiVideoTimelineClip } from "lfaa-client-connection/src/api.js";

const EXPORT_MAX_BYTES = 128 * 1024 * 1024;
const EXPORT_MAX_AUDIO_BYTES = 32 * 1024 * 1024;

function waitForMedia(element: HTMLMediaElement): Promise<void> {
  if (element.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => done(new Error("读取媒体时长超时。")), 30_000);
    const loaded = () => done();
    const failed = () => done(new Error("浏览器无法读取该媒体格式。"));
    const done = (error?: Error) => {
      window.clearTimeout(timer);
      element.removeEventListener("loadedmetadata", loaded);
      element.removeEventListener("error", failed);
      error ? reject(error) : resolve();
    };
    element.addEventListener("loadedmetadata", loaded, { once: true });
    element.addEventListener("error", failed, { once: true });
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  return image.decode().then(() => image);
}

async function loadAudioBuffer(url: string, context: AudioContext): Promise<AudioBuffer> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error("读取时间线音频失败。");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > EXPORT_MAX_AUDIO_BYTES) throw new Error("单次导出的音频素材总量不能超过 32 MiB。");
  return context.decodeAudioData(buffer);
}

function supportedMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") throw new Error("当前浏览器没有可用的本地视频编码器。");
  const choices = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  const mimeType = choices.find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error("当前浏览器没有可用的 MP4 或 WebM 编码器。");
  return mimeType;
}

function drawFitted(context: CanvasRenderingContext2D, source: CanvasImageSource, sourceWidth: number, sourceHeight: number, width: number, height: number): void {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawSubtitle(context: CanvasRenderingContext2D, text: string, width: number, height: number): void {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const character of paragraph) {
      const next = line + character;
      if (line && context.measureText(next).width > width * 0.84) { lines.push(line); line = character; }
      else line = next;
    }
    if (line) lines.push(line);
  }
  const visible = lines.slice(-3);
  const lineHeight = height * 0.055;
  const y = height - height * 0.08 - (visible.length - 1) * lineHeight;
  context.save();
  context.font = `600 ${Math.max(20, height * 0.045)}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = Math.max(4, height * 0.012);
  context.strokeStyle = "rgba(0, 0, 0, 0.82)";
  context.fillStyle = "#fff";
  visible.forEach((line, index) => {
    const lineY = y + index * lineHeight;
    context.strokeText(line, width / 2, lineY, width * 0.88);
    context.fillText(line, width / 2, lineY, width * 0.88);
  });
  context.restore();
}

export async function renderAiVideoTimeline(
  canvas: AiVideoCanvas,
  clips: AiVideoTimelineClip[],
  assets: AiVideoMediaAsset[],
  onProgress: (progress: number) => void
): Promise<Blob> {
  const mimeType = supportedMimeType();
  const visualClips = clips.filter(clip => clip.track === "video").sort((left, right) => left.startSeconds - right.startSeconds);
  if (!visualClips.length) throw new Error("时间线至少需要一个视频轨道片段才能导出。");
  const duration = Math.max(...clips.map(clip => clip.startSeconds + clip.durationSeconds));
  if (!Number.isFinite(duration) || duration <= 0 || duration > 300) throw new Error("单次导出时长需在 0 到 300 秒之间。");
  const assetById = new Map(assets.map(asset => [asset.assetId, asset]));
  const used = new Map<string, AiVideoMediaAsset>();
  for (const clip of clips) {
    if (clip.assetId) {
      const asset = assetById.get(clip.assetId);
      if (!asset?.available) throw new Error("时间线引用的媒体缺失；请移除片段或重新导入素材。");
      used.set(asset.assetId, asset);
    }
  }
  const audioAssets = [...used.values()].filter(asset => asset.mimeType.startsWith("audio/"));
  const totalAudioBytes = audioAssets.reduce((sum, asset) => sum + asset.bytes, 0);
  if (totalAudioBytes > EXPORT_MAX_AUDIO_BYTES) throw new Error("单次导出的音频素材总量不能超过 32 MiB。");

  const images = new Map<string, HTMLImageElement>();
  const videos = new Map<string, HTMLVideoElement>();
  const urls = new Map([...used.values()].map(asset => [asset.assetId, aiVideoAssetUrl(canvas.id, asset.assetId)]));
  let audioContext: AudioContext | null = null;
  let mixedAudio: MediaStreamAudioDestinationNode | null = null;
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let frame = 0;
  try {
    for (const asset of used.values()) {
      const url = urls.get(asset.assetId)!;
      if (asset.mimeType.startsWith("image/")) images.set(asset.assetId, await loadImage(url));
      else if (asset.mimeType.startsWith("video/")) {
        const video = document.createElement("video");
        video.preload = "auto";
        video.muted = true;
        video.playsInline = true;
        video.src = url;
        video.load();
        await waitForMedia(video);
        videos.set(asset.assetId, video);
      }
    }
    const firstVisual = visualClips.map(clip => clip.assetId ? assetById.get(clip.assetId) : undefined).find((asset): asset is AiVideoMediaAsset => Boolean(asset));
    if (!firstVisual) throw new Error("时间线上找不到可用画面素材。");
    const image = images.get(firstVisual.assetId);
    const video = videos.get(firstVisual.assetId);
    const sourceWidth = image?.naturalWidth ?? video?.videoWidth ?? 1280;
    const sourceHeight = image?.naturalHeight ?? video?.videoHeight ?? 720;
    const scale = Math.min(1, 1920 / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(2, Math.floor(sourceWidth * scale / 2) * 2);
    const height = Math.max(2, Math.floor(sourceHeight * scale / 2) * 2);
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const context = output.getContext("2d", { alpha: false });
    if (!context || typeof output.captureStream !== "function") throw new Error("当前浏览器不支持画布视频导出。");
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);

    const audioClips = clips.filter(clip => clip.track === "audio" && clip.assetId);
    if (audioClips.length) {
      audioContext = new AudioContext();
      await audioContext.resume();
      mixedAudio = audioContext.createMediaStreamDestination();
      const audioBuffers = new Map<string, AudioBuffer>();
      for (const asset of audioAssets) audioBuffers.set(asset.assetId, await loadAudioBuffer(urls.get(asset.assetId)!, audioContext));
      const audioBaseTime = audioContext.currentTime + 0.15;
      for (const clip of audioClips) {
        const audioBuffer = audioBuffers.get(clip.assetId!);
        if (!audioBuffer || clip.inPointSeconds + clip.durationSeconds > audioBuffer.duration) throw new Error("音频片段的裁剪区间超出素材时长。");
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(mixedAudio);
        source.start(audioBaseTime + clip.startSeconds, clip.inPointSeconds, clip.durationSeconds);
      }
    }

    stream = output.captureStream(30);
    if (mixedAudio) for (const track of mixedAudio.stream.getAudioTracks()) stream.addTrack(track);
    const recorderOptions: MediaRecorderOptions = { mimeType, videoBitsPerSecond: 2_000_000, ...(mixedAudio ? { audioBitsPerSecond: 128_000 } : {}) };
    recorder = new MediaRecorder(stream, recorderOptions);
    const chunks: BlobPart[] = [];
    let recordedBytes = 0;
    let recordingError: Error | null = null;
    const finished = new Promise<Blob>((resolve, reject) => {
      recorder!.ondataavailable = event => {
        if (!event.data.size) return;
        recordedBytes += event.data.size;
        if (recordedBytes > EXPORT_MAX_BYTES) {
          recordingError = new Error("导出文件超过 128 MiB，已停止录制且没有保存不完整结果。");
          if (recorder!.state !== "inactive") recorder!.stop();
          return;
        }
        chunks.push(event.data);
      };
      recorder!.onerror = () => {
        recordingError = new Error("浏览器本地视频编码失败。");
        if (recorder!.state !== "inactive") recorder!.stop();
      };
      recorder!.onstop = () => recordingError ? reject(recordingError) : resolve(new Blob(chunks, { type: recorder!.mimeType || mimeType }));
      recorder!.start(500);
      const startAt = performance.now() + 150;
      let lastProgressAt = 0;
      let activeVideoClipId = "";
      const paint = (now: number) => {
        const seconds = Math.max(0, (now - startAt) / 1_000);
        if (seconds >= duration) {
          onProgress(100);
          if (recorder!.state !== "inactive") recorder!.stop();
          return;
        }
        context.fillStyle = "#000";
        context.fillRect(0, 0, width, height);
        const visual = visualClips.find(clip => seconds >= clip.startSeconds && seconds < clip.startSeconds + clip.durationSeconds);
        if (visual?.assetId) {
          const asset = assetById.get(visual.assetId);
          const still = images.get(visual.assetId);
          const moving = videos.get(visual.assetId);
          if (still) drawFitted(context, still, still.naturalWidth, still.naturalHeight, width, height);
          else if (moving && asset) {
            const localTime = visual.inPointSeconds + seconds - visual.startSeconds;
            if (activeVideoClipId !== visual.id) {
              for (const other of videos.values()) other.pause();
              moving.currentTime = Math.min(localTime, Math.max(0, moving.duration - 0.05));
              void moving.play().catch(() => undefined);
              activeVideoClipId = visual.id;
            } else if (Math.abs(moving.currentTime - localTime) > 0.45 && !moving.seeking) moving.currentTime = Math.min(localTime, Math.max(0, moving.duration - 0.05));
            if (moving.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) drawFitted(context, moving, moving.videoWidth, moving.videoHeight, width, height);
          }
        } else {
          activeVideoClipId = "";
          for (const moving of videos.values()) moving.pause();
        }
        const subtitle = clips.find(clip => clip.track === "subtitle" && seconds >= clip.startSeconds && seconds < clip.startSeconds + clip.durationSeconds);
        if (subtitle?.text) drawSubtitle(context, subtitle.text, width, height);
        if (now - lastProgressAt >= 250) {
          lastProgressAt = now;
          onProgress(Math.min(99, Math.floor(seconds / duration * 100)));
        }
        frame = requestAnimationFrame(paint);
      };
      frame = requestAnimationFrame(paint);
    });
    return await finished;
  } finally {
    if (frame) cancelAnimationFrame(frame);
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    for (const video of videos.values()) { video.pause(); video.removeAttribute("src"); video.load(); }
    if (audioContext) await audioContext.close().catch(() => undefined);
  }
}

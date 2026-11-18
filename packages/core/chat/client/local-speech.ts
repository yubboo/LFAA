// 在浏览器端通过 Web Audio 采集麦克风音频并编码为 16kHz 单声道 PCM WAV，供 Host 离线语音识别。
import type { ChatLocaleMessages } from "./locales";

/** 记录输入栏是否优先使用本机语音识别。 */
export const SPEECH_PREFER_LOCAL_STORAGE_KEY = "lfaa.speech.preferLocal";

/** 采集浏览器麦克风音频并导出符合本地转录接口要求的 WAV。 */
export interface LocalWavRecorder {
  stopAndBuildWav: () => Promise<Uint8Array>;
  abort: () => void;
}

// 将任意采样率的 Float32 单声道采样线性重采样为 16kHz Int16 PCM，减少传输体积并匹配离线识别引擎。
export function downsampleTo16kPcm(samples: Float32Array, inputSampleRate: number): Int16Array {
  if (samples.length === 0) return new Int16Array(0);
  const targetRate = 16_000;
  const ratio = inputSampleRate > 0 ? inputSampleRate / targetRate : 1;
  const outputLength = Math.max(1, Math.round(samples.length / ratio));
  const result = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i += 1) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const nextIdx = Math.min(idx + 1, samples.length - 1);
    const frac = pos - idx;
    const sample = (samples[idx] ?? 0) * (1 - frac) + (samples[nextIdx] ?? 0) * frac;
    const clamped = Math.max(-1, Math.min(1, sample));
    result[i] = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
  }
  return result;
}

// 为 16-bit 单声道 PCM 数据写入标准 44 字节 RIFF/WAVE 文件头。
export function encodePcm16ToWav(pcmSamples: Int16Array, sampleRate = 16_000): Uint8Array {
  const dataLength = pcmSamples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < pcmSamples.length; i += 1) {
    view.setInt16(offset, pcmSamples[i] ?? 0, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}

// 将 WAV 字节分块转换为 Base64 字符串，避免大数组展开调用 String.fromCharCode 触发栈溢出。
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

// 将浏览器 SpeechRecognition / MediaDevices 原始错误码映射为可理解的中文或英文提示。
export function formatSpeechErrorMessage(
  locale: ChatLocaleMessages,
  errCodeOrError: unknown,
  afterNetworkFallback = false,
): string {
  const rawName =
    errCodeOrError instanceof Error
      ? errCodeOrError.name || errCodeOrError.message
      : typeof errCodeOrError === "string"
        ? errCodeOrError
        : "";
  const rawMessage = errCodeOrError instanceof Error ? errCodeOrError.message : String(errCodeOrError ?? "");

  if (rawName === "aborted") return "";
  if (rawName === "no-speech") return locale.speechNoResultNotice;
  if (
    rawName === "not-allowed" ||
    rawName === "service-not-allowed" ||
    rawName === "NotAllowedError" ||
    rawName === "PermissionDeniedError"
  ) {
    return locale.speechMicPermissionDenied;
  }
  if (rawName === "audio-capture" || rawName === "NotFoundError" || rawName === "DevicesNotFoundError") {
    return locale.speechMicNotFound;
  }
  if (rawName === "NotReadableError" || rawName === "TrackStartError") {
    return locale.speechMicBusy;
  }
  const detail = rawMessage || rawName || locale.speechUnsupportedNotice;
  return afterNetworkFallback ? `${locale.speechNetworkFallbackFailed}${detail}` : `${locale.speechErrorPrefix}${detail}`;
}

// 打开浏览器麦克风并持续采集 PCM 分片，调用 stopAndBuildWav 后停止所有音轨并生成 WAV 字节。
export async function startLocalMicrophoneWavRecorder(): Promise<LocalWavRecorder> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("当前浏览器环境不支持本地麦克风录音（缺少 navigator.mediaDevices）。");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    for (const track of stream.getTracks()) track.stop();
    throw new Error("当前浏览器不支持 AudioContext 音频采集。");
  }

  const audioCtx = new AudioCtx();
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  const source = audioCtx.createMediaStreamSource(stream);
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  const silentGain = audioCtx.createGain();
  silentGain.gain.value = 0;

  const chunks: Float32Array[] = [];
  processor.onaudioprocess = (event) => {
    const channelData = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(channelData));
  };

  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioCtx.destination);

  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    processor.onaudioprocess = null;
    try {
      processor.disconnect();
      source.disconnect();
      silentGain.disconnect();
    } catch {
      // 忽略已断开节点的清理异常。
    }
    for (const track of stream.getTracks()) {
      track.stop();
    }
    if (audioCtx.state !== "closed") {
      await audioCtx.close().catch(() => undefined);
    }
  };

  return {
    async stopAndBuildWav(): Promise<Uint8Array> {
      const sampleRate = audioCtx.sampleRate || 16_000;
      await cleanup();
      const totalSamples = chunks.reduce((sum, item) => sum + item.length, 0);
      const merged = new Float32Array(totalSamples);
      let offset = 0;
      for (const item of chunks) {
        merged.set(item, offset);
        offset += item.length;
      }
      const pcm = downsampleTo16kPcm(merged, sampleRate);
      return encodePcm16ToWav(pcm, 16_000);
    },
    abort(): void {
      void cleanup();
    },
  };
}

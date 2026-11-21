// 提示音播放层：内置音由 Web Audio 实时合成，自定义音从 Host 读取并解码缓存。
export type BuiltinSoundId = "default" | "chime" | "bell" | "pop" | "alert";

export interface BuiltinSoundInfo {
  id: BuiltinSoundId;
  zh: string;
  en: string;
}

/** 内置提示音清单；顺序即设置页下拉顺序。 */
export const BUILTIN_NOTIFICATION_SOUNDS: readonly BuiltinSoundInfo[] = [
  { id: "default", zh: "默认", en: "Default" },
  { id: "chime", zh: "清脆", en: "Chime" },
  { id: "bell", zh: "铃音", en: "Bell" },
  { id: "pop", zh: "轻快", en: "Pop" },
  { id: "alert", zh: "双响", en: "Alert" },
];

const CUSTOM_PREFIX = "custom:";
const customBuffers = new Map<string, AudioBuffer>();
let audioContext: AudioContext | null = null;

/** 复用同一个 AudioContext，避免每次提醒都新建上下文被浏览器限制。 */
function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioContext) return audioContext;
  const Ctor = window.AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioContext = new Ctor();
  } catch {
    audioContext = null;
  }
  return audioContext;
}

/** 播放一个带起止音高与衰减包络的短音。 */
function tone(
  ctx: AudioContext,
  input: { type: OscillatorType; from: number; to?: number; duration: number; gain: number; delay?: number },
): void {
  const at = ctx.currentTime + (input.delay ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = input.type;
  osc.frequency.setValueAtTime(input.from, at);
  if (input.to !== undefined) osc.frequency.exponentialRampToValueAtTime(input.to, at + input.duration);
  gain.gain.setValueAtTime(input.gain, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + input.duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + input.duration + 0.02);
}

function synthesize(ctx: AudioContext, id: BuiltinSoundId): void {
  switch (id) {
    case "chime":
      tone(ctx, { type: "triangle", from: 880, to: 1174, duration: 0.18, gain: 0.045 });
      break;
    case "bell":
      tone(ctx, { type: "sine", from: 880, duration: 0.55, gain: 0.035 });
      tone(ctx, { type: "sine", from: 1320, duration: 0.42, gain: 0.018 });
      break;
    case "pop":
      tone(ctx, { type: "sine", from: 420, to: 180, duration: 0.09, gain: 0.05 });
      break;
    case "alert":
      tone(ctx, { type: "square", from: 740, duration: 0.07, gain: 0.028 });
      tone(ctx, { type: "square", from: 740, duration: 0.07, gain: 0.028, delay: 0.12 });
      break;
    default:
      tone(ctx, { type: "sine", from: 660, to: 880, duration: 0.18, gain: 0.04 });
      break;
  }
}

async function loadCustomBuffer(ctx: AudioContext, id: string): Promise<AudioBuffer> {
  const cached = customBuffers.get(id);
  if (cached) return cached;
  const res = await fetch(`/api/notification-sounds/${encodeURIComponent(id)}/file`);
  if (!res.ok) throw new Error(`自定义提示音不可用（${res.status}）`);
  const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
  customBuffers.set(id, buffer);
  return buffer;
}

/** 播放设置中选择的提示音；自定义音失败时回退到内置默认音。 */
export async function playNotificationSound(soundId: string | undefined): Promise<void> {
  if (!soundId || soundId === "mute") return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
  } catch {
    // 自动播放策略可能拒绝恢复，继续尝试调度。
  }
  if (soundId.startsWith(CUSTOM_PREFIX)) {
    try {
      const buffer = await loadCustomBuffer(ctx, soundId.slice(CUSTOM_PREFIX.length));
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.connect(ctx.destination);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.start();
      return;
    } catch {
      synthesize(ctx, "default");
      return;
    }
  }
  synthesize(ctx, BUILTIN_NOTIFICATION_SOUNDS.some((item) => item.id === soundId) ? soundId as BuiltinSoundId : "default");
}

/** 判断设置值是否是合法内置音；用于设置页与迁移兜底。 */
export function isBuiltinSoundId(value: string): value is BuiltinSoundId {
  return BUILTIN_NOTIFICATION_SOUNDS.some((item) => item.id === value);
}
// 聊天素材来源和生成请求，供输入框、结果操作和发送动作共用。
export interface MediaSource {
  messageId: string;
  path: string;
}

/** 文件标识来自聊天系统自己的媒体预览链接。 */
export function readMediaPath(src: string): string | undefined {
  if (!src.startsWith("/api/media/file?")) return undefined;
  return new URLSearchParams(src.slice(src.indexOf("?") + 1)).get("path") || undefined;
}

/** 输入栏可选画幅；auto 表示按提示词自动识别（识别不到用常用 1:1）。 */
export type MediaRatioChoice = "auto" | "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3";

/** 输入栏可选画面风格；auto 表示交给模型与提示词导演决定。 */
export type MediaStyleChoice = "auto" | "photo" | "cinematic" | "illustration" | "anime" | "watercolor" | "3d";

/** 风格选项顺序：自动在前，其余按写实到风格化排列。 */
export const MEDIA_STYLE_OPTIONS: readonly MediaStyleChoice[] = ["auto", "photo", "cinematic", "illustration", "anime", "watercolor", "3d"];

/** 比例选择器的顺序与豆包一致：自动在前，其余按竖版到横版排列。 */
export const MEDIA_RATIO_OPTIONS: readonly MediaRatioChoice[] = ["auto", "9:16", "2:3", "3:4", "1:1", "4:3", "3:2", "16:9"];

/** 从图片像素尺寸换算到最接近的常用比例；不接近任何常用比例时返回 undefined。 */
export function ratioFromSize(width: number, height: number): MediaRatioChoice | undefined {
  if (!(width > 0 && height > 0)) return undefined;
  const target = width / height;
  let best: MediaRatioChoice | undefined;
  let delta = 0.02;
  for (const option of MEDIA_RATIO_OPTIONS) {
    if (option === "auto") continue;
    const [w, h] = option.split(":").map(Number) as [number, number];
    const diff = Math.abs(w / h - target);
    if (diff < delta) {
      delta = diff;
      best = option;
    }
  }
  return best;
}

/** 生成与再次生图共用发送状态，请求上传的 File 不进入 JSON。 */
export type MediaGenerationInput = ({
  kind: "image" | "video" | "audio";
  prompt: string;
  style?: string;
  size?: string;
  /** 用户在输入栏选定的画幅；缺省或 auto 时由宿主按提示词识别。 */
  ratio?: string;
  modelId?: string;
  profileId?: string;
  attachmentIds?: string[];
  imageFiles?: File[];
  referenceImages?: string[];
  referenceSources?: MediaSource[];
} | { regenerate: MediaSource; /** 再次生图时用于占位的来源图片比例。 */ ratio?: MediaRatioChoice });

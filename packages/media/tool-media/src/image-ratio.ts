// @lfaa/tool-media：生图比例识别与尺寸映射（纯函数，供媒体直连、generate_image 工具与计划接口共用）。
// 比例只由文本明确要求时才算「用户指定」，此时同时约束提示词；未指定时用常用比例 1:1 的方形尺寸。

/** 目前稳定支持的画幅比例；竖版、横版与方形覆盖聊天里最常见的请求。 */
export type ImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3";

/** 未指定比例时的常用默认值。 */
export const DEFAULT_IMAGE_RATIO: ImageAspectRatio = "1:1";

// 明确指定比例时优先请求的高清尺寸（约 2–4MP）；模型不接受时再回落保守尺寸。
const RATIO_SIZES: Record<ImageAspectRatio, string> = {
  "1:1": "2048x2048",
  "16:9": "2048x1152",
  "9:16": "1152x2048",
  "4:3": "2048x1536",
  "3:4": "1536x2048",
  "3:2": "1920x1280",
  "2:3": "1280x1920",
};

// 各家生图模型普遍认可的保守尺寸，作为高清尺寸被拒时的兜底。
const RATIO_FALLBACK_SIZES: Record<ImageAspectRatio, string> = {
  "1:1": "1024x1024",
  "16:9": "1280x720",
  "9:16": "720x1280",
  "4:3": "1152x864",
  "3:4": "864x1152",
  "3:2": "1152x768",
  "2:3": "768x1152",
};

// 关键词先匹配更具体的画幅说法，避免「竖版海报」「横屏壁纸」被当作普通描述。
const RATIO_KEYWORDS: Array<{ ratio: ImageAspectRatio; pattern: RegExp }> = [
  { ratio: "9:16", pattern: /竖屏|竖版|竖图|竖向|手机壁纸|手机桌面|抖音|快手指|小红书竖/u },
  { ratio: "16:9", pattern: /横屏|横版|横图|横向|宽屏|宽幅|电脑壁纸|桌面壁纸|横幅/u },
  { ratio: "3:4", pattern: /三比四|竖构图海报/u },
  { ratio: "4:3", pattern: /四比三/u },
  { ratio: "1:1", pattern: /方形|正方形|方图|方形图标|头像/u },
];

/** 生图计划：比例、要传给模型的尺寸与构图提示。 */
export interface ImagePlan {
  ratio: ImageAspectRatio;
  /** 要传给模型的尺寸；未指定比例时同样显式请求常用方形尺寸，保证输出比例稳定。 */
  size?: string;
  /** 用户是否明确提出了比例要求。 */
  explicit: boolean;
  /** 追加到提示词末尾的构图约束，只在明确指定比例时使用。 */
  hint?: string;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** 把 2048x1152 之外的任意显式比例折成最接近的支持比例，保持「用户说了就照做」的语义。 */
function closestRatio(width: number, height: number): ImageAspectRatio {
  const target = width / height;
  let best: ImageAspectRatio = "1:1";
  let bestDelta = Infinity;
  for (const ratio of Object.keys(RATIO_SIZES) as ImageAspectRatio[]) {
    const [w, h] = ratio.split(":").map(Number) as [number, number];
    const delta = Math.abs(w / h - target);
    if (delta < bestDelta) {
      best = ratio;
      bestDelta = delta;
    }
  }
  return best;
}

/** 识别用户明确要求的画幅：先认 16:9 / 9：16 这类写法，再认「竖版/横屏/方形」等说法。 */
export function detectImageRatio(prompt: string): ImageAspectRatio | undefined {
  const text = prompt.replace(/\uFF1A/gu, ":").trim();
  if (!text) return undefined;
  const explicit = /(\d{1,5})\s*(?:[:/比x×])\s*(\d{1,5})/u.exec(text);
  if (explicit) {
    const width = Number(explicit[1]);
    const height = Number(explicit[2]);
    if (width > 0 && height > 0) {
      const divisor = gcd(width, height) || 1;
      const key = `${width / divisor}:${height / divisor}` as ImageAspectRatio;
      if (key in RATIO_SIZES) return key;
      // 也接受 32:18 这类等值写法（化简后不在表里时按取近似）。
      return closestRatio(width, height);
    }
  }
  for (const item of RATIO_KEYWORDS) {
    if (item.pattern.test(text)) return item.ratio;
  }
  return undefined;
}

/** 生成比例的构图提示：明确要求时追加，避免模型只按文字联想而忽略画幅。 */
export function buildRatioHint(ratio: ImageAspectRatio): string {
  const [width, height] = ratio.split(":").map(Number) as [number, number];
  const orientation = width === height ? "方形" : width > height ? "横版" : "竖版";
  return `【画面比例】必须为 ${ratio}（${orientation}）构图，输出比例与构图需与该比例严格一致。`;
}

/** 汇总一次生图的比例计划：提示词明确要求 > 输入栏选择 > 常用默认 1:1。 */
export function resolveImagePlan(prompt: string, requestedRatio?: string): ImagePlan {
  const normalized = requestedRatio?.trim().replace(/\uFF1A/gu, ":");
  const requested = normalized && normalized in RATIO_SIZES ? normalized as ImageAspectRatio : undefined;
  // 用户写在描述里的比例是当前这条消息最直接的意图，优先于此前在输入栏里选过的值。
  const detected = detectImageRatio(prompt) ?? requested;
  if (!detected) return { ratio: DEFAULT_IMAGE_RATIO, size: RATIO_SIZES[DEFAULT_IMAGE_RATIO], explicit: false };
  return {
    ratio: detected,
    size: RATIO_SIZES[detected],
    explicit: true,
    hint: buildRatioHint(detected),
  };
}

/** 高清尺寸被模型拒绝时的保守尺寸，供生成工具自动重试。 */
export function fallbackImageSize(ratio: ImageAspectRatio): string {
  return RATIO_FALLBACK_SIZES[ratio];
}

/** 把 "1152x2048" 这类尺寸转回比例，用于计划接口与测试断言。 */
export function sizeToRatio(size: string): ImageAspectRatio | undefined {
  const match = /^(\d{3,5})\s*[xX×*]\s*(\d{3,5})$/u.exec(size.trim());
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? closestRatio(width, height) : undefined;
}
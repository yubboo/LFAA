// 内置背景图清单：backgrounds/ 目录下放入图片即被自动发现，新增图片不需要改这里；
// 中文名、展示顺序与配套配色写在 manifest.json 里，没登记的按文件名兜底并排在后面。
// 添加流程见 packages/ui/theme/README.zh.md「主题与背景」；个人背景不放这里，走 ~/.lfaa/backgrounds。
import manifest from "./manifest.json";

/** 一张内置背景图的展示信息；src 是 Vite 处理后的带哈希 URL，preset 是它作为主题时使用的配色 id。 */
export interface BuiltinBackground {
  id: string;
  src: string;
  labelZh: string;
  labelEn: string;
  preset?: string;
}

interface BackgroundManifest {
  order?: string[];
  labels?: Record<string, { zh?: string; en?: string; preset?: string }>;
}

/** Vite 的 import.meta.glob 只在本文件用到，局部描述签名，避免把 vite/client 引入 Host 类型检查。 */
interface ViteImportMeta {
  glob: (
    pattern: string,
    options: { eager: true; query: string; import: string },
  ) => Record<string, string>;
}

const meta = manifest as BackgroundManifest;
// 自动发现：图片放进同目录即可，扩展名大小写不敏感由 glob 处理；换图同名替换即可。
// Node 单测环境没有 Vite 的 glob，调用会抛错，此时降级为空清单，不影响 store 与视图装配。
let files: Record<string, string> = {};
try {
  files = (import.meta as unknown as ViteImportMeta).glob("./*.{webp,png,jpg,jpeg,avif}", {
    eager: true,
    query: "?url",
    import: "default",
  });
} catch {
  files = {};
}

/** 用文件名生成兜底标题：cherry-blossom-shore → Cherry Blossom Shore。 */
function humanize(id: string): string {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const orderRank = new Map((meta.order ?? []).map((id, index) => [id, index] as const));

/** 内置背景图，按 manifest 顺序在前、未登记的新图按文件名排在后面。 */
export const BUILTIN_BACKGROUNDS: BuiltinBackground[] = Object.entries(files)
  .map(([path, src]): BuiltinBackground => {
    const id = path.replace(/^\.\//u, "").replace(/\.[^.]+$/u, "");
    const label = meta.labels?.[id];
    return {
      id,
      src,
      labelZh: label?.zh ?? humanize(id),
      labelEn: label?.en ?? humanize(id),
      ...(label?.preset ? { preset: label.preset } : {}),
    };
  })
  .sort((left, right) => {
    const leftRank = orderRank.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = orderRank.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftRank === rightRank ? left.id.localeCompare(right.id) : leftRank - rightRank;
  });

/** 按 id 取内置背景；不存在时返回 null，供配置回退使用。 */
export function findBuiltinBackground(id: string): BuiltinBackground | null {
  return BUILTIN_BACKGROUNDS.find((item) => item.id === id) ?? null;
}
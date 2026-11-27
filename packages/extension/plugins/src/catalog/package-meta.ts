// 插件包显示元数据：从包目录读取 package.json 与 locale/<lang>.json 的 meta 段落，供插件清单投影使用。
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PluginInventoryEntry } from "../../contract/index";

/** 单条清单的显示元数据（与契约里的 meta 字段同形）。 */
export type PackageMeta = PluginInventoryEntry["meta"];

/** 解析锚点：bundle 的 Loader 基准与 profile 根目录。 */
export interface MetaAnchors {
  /** Loader 解析基准文件（本仓包都能从这里解析到）。 */
  baseUrl?: string;
  /** profile 根目录；外部插件装在这里。 */
  profileRoot?: string;
}

/** 去掉 npm scope，得到可读的短包名。 */
function shortName(moduleName: string): string {
  return moduleName.startsWith("@") ? moduleName.slice(moduleName.indexOf("/") + 1) : moduleName;
}

/** 从入口文件向上找到最近的 package.json 目录。 */
function packageDirFromFile(file: string): string | null {
  let current = dirname(file);
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(current, "package.json"))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

/** 把一个模块说明符解析到包目录；解析不到返回 null。 */
export function resolvePackageDir(moduleName: string, anchors: MetaAnchors): string | null {
  if (moduleName.startsWith("file:")) {
    try {
      return packageDirFromFile(fileURLToPath(moduleName));
    } catch {
      // 相对 file: 说明符（测试夹具常见）不指向真实包目录。
      return null;
    }
  }
  const candidates = [anchors.baseUrl, anchors.profileRoot ? join(anchors.profileRoot, "package.json") : undefined];
  for (const anchor of candidates) {
    if (!anchor) continue;
    try {
      const resolved = createRequire(anchor).resolve(`${moduleName}/package.json`);
      return dirname(resolved);
    } catch {
      // 换下一个锚点；外部插件与仓库包分属不同解析基准。
    }
  }
  return null;
}

interface LocaleFile {
  meta?: { title?: unknown; description?: unknown };
}

function readLocaleMeta(dir: string, lang: "zh" | "en"): { title?: string; description?: string } {
  const file = join(dir, "locale", `${lang}.json`);
  if (!existsSync(file)) return {};
  const parsed = JSON.parse(readFileSync(file, "utf8")) as LocaleFile;
  return {
    ...(typeof parsed.meta?.title === "string" ? { title: parsed.meta.title } : {}),
    ...(typeof parsed.meta?.description === "string" ? { description: parsed.meta.description } : {}),
  };
}

/**
 * 读取一个包的显示元数据：优先包内 locale 双语 meta，缺失回落 package.json。
 * 包目录找不到时返回 null，由调用方按未安装处理。
 */
export function readPackageMeta(moduleName: string, anchors: MetaAnchors): PackageMeta | null {
  const dir = resolvePackageDir(moduleName, anchors);
  if (!dir) return null;
  try {
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { description?: unknown };
    const fallback = typeof manifest.description === "string" ? manifest.description : "";
    const zh = readLocaleMeta(dir, "zh");
    const en = readLocaleMeta(dir, "en");
    const localized = Boolean(zh.title || zh.description || en.title || en.description);
    return {
      title: { zh: zh.title ?? shortName(moduleName), en: en.title ?? shortName(moduleName) },
      description: { zh: zh.description ?? fallback, en: en.description ?? fallback },
      source: localized ? "locale" : "package",
    };
  } catch (error) {
    return {
      title: { zh: shortName(moduleName), en: shortName(moduleName) },
      description: { zh: "", en: "" },
      source: "package",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
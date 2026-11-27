// 插件清单只读投影：把 Cordis Loader 条目与 bundle 静态装配模块合成一份快照，不做缓存。
import type {
  PluginFiberPhase,
  PluginInventoryEntry,
  PluginInventorySnapshot,
  PresetSummary,
} from "../../contract/index";
import type { PackageMeta } from "../catalog/package-meta";
import { toRecordId } from "../catalog/record-id";

/** Loader 条目的最小结构：只读投影用到的字段。 */
export interface LoaderEntryLike {
  id: string;
  options: { name: string; group?: boolean | null };
  disabled: boolean;
  fiber?: { state: number; await?(): Promise<unknown> } | undefined;
}

/** 投影输入：Loader 条目来源、静态装配清单与元数据解析器。 */
export interface InventoryInput {
  profile: string;
  /** 仍由 bundle 静态装配的模块；其余插件都应来自 Loader 条目。 */
  staticModules: readonly string[];
  entries: Iterable<LoaderEntryLike>;
  presets: PresetSummary[];
  activePreset: string;
  metaOf(moduleName: string): PackageMeta | null;
  /** 是否具备写入 profile 的启停能力。 */
  managementAvailable: boolean;
}

/** Cordis FiberState 的运行时镜像（const enum 不能跨包取值）。 */
const FIBER_PHASE: Record<number, PluginFiberPhase> = {
  0: "pending",
  1: "loading",
  2: "active",
  3: "failed",
  4: null,
  5: "unloading",
};

/** 每个模块都有的回落元数据：解析不到包目录时仍能显示一行。 */
function fallbackMeta(moduleName: string): PackageMeta {
  const short = moduleName.startsWith("@") ? moduleName.slice(moduleName.indexOf("/") + 1) : moduleName;
  return { title: { zh: short, en: short }, description: { zh: "", en: "" }, source: "package" };
}

/** 失败条目的诊断文本：只有根 Fiber 失败时才等待它抛出的原因。 */
async function diagnosticOf(entry: LoaderEntryLike, phase: PluginFiberPhase): Promise<string | undefined> {
  if (phase !== "failed" || !entry.fiber?.await) return undefined;
  try {
    await entry.fiber.await();
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * 生成一次只读快照。静态装配模块排在前面（按 bundle 的装配顺序），
 * 其余按 Loader 条目顺序追加；两条来源都不再区分「已安装」与「已装配」。
 */
export async function buildInventory(input: InventoryInput): Promise<PluginInventorySnapshot> {
  const entries: PluginInventoryEntry[] = [];
  const provided = new Set(input.staticModules);

  for (const moduleName of input.staticModules) {
    entries.push({
      entryId: `bundle:${toRecordId(moduleName)}`,
      moduleName,
      meta: input.metaOf(moduleName) ?? fallbackMeta(moduleName),
      enabled: true,
      fiberPhase: "active",
      provided: true,
      kind: moduleName.startsWith("@lfaa/") ? "builtin" : "external",
      order: entries.length,
    });
  }

  for (const entry of input.entries) {
    if (entry.options.group) continue;
    if (provided.has(entry.options.name)) continue;
    const phase = entry.fiber ? (FIBER_PHASE[entry.fiber.state] ?? null) : null;
    const diagnostic = await diagnosticOf(entry, phase);
    entries.push({
      entryId: entry.id,
      moduleName: entry.options.name,
      meta: input.metaOf(entry.options.name) ?? fallbackMeta(entry.options.name),
      enabled: !entry.disabled,
      fiberPhase: phase,
      ...(diagnostic === undefined ? {} : { diagnostic }),
      provided: false,
      kind: entry.options.name.startsWith("@lfaa/") ? "builtin" : "external",
      order: entries.length,
    });
  }

  return {
    profile: input.profile,
    entries,
    presets: input.presets,
    activePreset: input.activePreset,
    managementAvailable: input.managementAvailable,
  };
}

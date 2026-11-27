// 插件模式预设的契约与摘要：预设由 bundle 提供，插件包不反向依赖 bundle。
import type { PresetSummary } from "../../contract/index";

/** 插件模式预设：由 bundle 提供，插件包不反向依赖 bundle。 */
export interface PluginPresetDefinition {
  id: string;
  name: Record<"zh" | "en", string>;
  description: Record<"zh" | "en", string>;
  sessionModules: readonly string[];
  unavailable?: boolean;
}

/** 把预设定义汇总为前端契约的摘要列表。 */
export function summaryOfPresets(presets: readonly PluginPresetDefinition[]): PresetSummary[] {
  return presets.map((preset) => ({
    id: preset.id,
    name: preset.name.zh,
    nameEn: preset.name.en,
    description: preset.description.zh,
    descriptionEn: preset.description.en,
    ...(preset.unavailable ? { unavailable: true } : {}),
    modules: [...preset.sessionModules],
  }));
}
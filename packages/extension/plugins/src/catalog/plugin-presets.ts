// 插件模式预设持久化：记录当前默认模式，校验可用性并提供新会话的模块组合。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PresetSummary } from "../../contract/index";
import { summaryOfPresets, type PluginPresetDefinition } from "./preset-summary";

export class PluginPresets {
  constructor(
    private readonly profileRoot: string,
    private readonly presets: readonly PluginPresetDefinition[],
  ) {}

  /** 预设状态文件：记录当前模式，供下次启动沿用。 */
  private presetPath(): string {
    return join(this.profileRoot, ".plugin-manager", "preset.json");
  }

  /** 读取当前模式；未设置或非法时回退到第一个预设。 */
  async readActiveId(): Promise<string> {
    const fallback = this.presets[0]?.id ?? "standard";
    try {
      const raw = JSON.parse(await readFile(this.presetPath(), "utf8")) as { id?: string };
      return this.presets.find((preset) => preset.id === raw.id && !preset.unavailable)?.id ?? fallback;
    } catch {
      return fallback;
    }
  }

  /** 读取新会话默认模式的标识及能力组合。 */
  async getActive(): Promise<{ id: string; modules: string[] }> {
    const id = await this.readActiveId();
    const preset = this.presets.find((item) => item.id === id);
    return { id, modules: preset ? [...preset.sessionModules] : [] };
  }

  /** 全局默认仅用于新会话，已选择的组合由会话本身保存。 */
  async resolveSession(id?: string): Promise<{ sessionPreset: string; sessionModules: string[] }> {
    const selected = id ?? await this.readActiveId();
    const preset = this.presets.find((item) => item.id === selected && !item.unavailable);
    if (!preset) throw new Error(`会话模式不可用：${selected}`);
    return { sessionPreset: preset.id, sessionModules: [...preset.sessionModules] };
  }

  /** 保存新会话默认模式；拒绝未知或不可用模式。 */
  async setActive(id: string): Promise<void> {
    if (!this.presets.some((preset) => preset.id === id && !preset.unavailable)) {
      throw new Error(`未知模式：${id}`);
    }
    await mkdir(dirname(this.presetPath()), { recursive: true });
    await writeFile(this.presetPath(), `${JSON.stringify({ id }, null, 2)}\n`, "utf8");
  }

  /** 前端契约使用的预设摘要。 */
  summaries(): PresetSummary[] {
    return summaryOfPresets(this.presets);
  }
}

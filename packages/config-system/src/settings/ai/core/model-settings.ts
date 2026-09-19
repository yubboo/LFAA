/**
 * 文件：model-settings.ts
 * 作用：统一校验 Provider 插件声明的模型配置值。
 * 负责：按官方 Capability 字段校验 select/boolean/integer，清理未知配置并生成默认配置。
 * 不负责：推理请求组装、Provider 判断、React UI。
 * 状态归属：纯函数，无状态。
 * 对外接口：defaultModelSettings、validateModelSettings。
 * 关联文件：provider.types.ts、account-service.ts、../providers/<provider>/plugin.ts。
 * 修改注意事项：禁止为了兼容 UI 接受 Capability 未声明的任意参数。
 */
import type { AiModelCapabilities, AiModelSettingValue } from "./provider.types.ts";

export function defaultModelSettings(capabilities: AiModelCapabilities | null): Readonly<Record<string, AiModelSettingValue>> {
  if (!capabilities) return {};
  const output: Record<string, AiModelSettingValue> = {};
  for (const field of capabilities.settings) if (field.defaultValue !== undefined) output[field.id] = field.defaultValue;
  return output;
}

export function validateModelSettings(
  capabilities: AiModelCapabilities | null,
  raw: Readonly<Record<string, AiModelSettingValue>>,
): Readonly<Record<string, AiModelSettingValue>> {
  if (!capabilities) {
    if (Object.keys(raw).length) throw new Error("该模型没有经官方资料确认的可配置参数，不能保存自定义模型参数。");
    return {};
  }
  const fields = new Map(capabilities.settings.map((field) => [field.id, field]));
  const output: Record<string, AiModelSettingValue> = {};
  for (const [id, value] of Object.entries(raw)) {
    const field = fields.get(id);
    if (!field) throw new Error(`模型参数 ${id} 未在当前模型的官方能力中声明。`);
    if (field.kind === "boolean") {
      if (typeof value !== "boolean") throw new Error(`${field.label} 必须是布尔值。`);
    } else if (field.kind === "integer") {
      if (typeof value !== "number" || !Number.isInteger(value)) throw new Error(`${field.label} 必须是整数。`);
      if (field.min !== undefined && value < field.min) throw new Error(`${field.label} 不能小于 ${field.min}。`);
      if (field.max !== undefined && value > field.max) throw new Error(`${field.label} 不能大于 ${field.max}。`);
    } else {
      if (typeof value !== "string") throw new Error(`${field.label} 必须是字符串选项。`);
      if (!field.options?.some((option) => option.value === value)) throw new Error(`${field.label} 的值不受当前模型官方接口支持。`);
    }
    output[id] = value;
  }
  return output;
}

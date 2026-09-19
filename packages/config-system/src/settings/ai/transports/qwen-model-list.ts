/**
 * 文件：qwen-model-list.ts
 * 作用：解析阿里云百炼查询模型列表接口的返回结构。
 * 负责：把 output.models 映射为 Config System 的统一模型列表。
 * 不负责：请求 Endpoint、Region/Workspace 选择、API Key、UI。
 * 状态归属：纯函数，无状态。
 * 对外接口：parseQwenModelList。
 * 关联文件：../providers/qwen/plugin.ts、../core/account-service.ts。
 * 修改注意事项：只解析官方响应字段；不要把 UI 展示逻辑塞入 transport。
 */
import type { AiAccountModel } from "../core/account.types.ts";

export function parseQwenModelList(input: unknown): readonly AiAccountModel[] {
  if (!input || typeof input !== "object") throw new Error("百炼模型列表响应不是对象。");
  const output = (input as { output?: unknown }).output;
  if (!output || typeof output !== "object") throw new Error("百炼模型列表响应缺少 output。");
  const models = (output as { models?: unknown }).models;
  if (!Array.isArray(models)) throw new Error("百炼模型列表响应缺少 output.models。");

  return models.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`百炼模型列表第 ${index + 1} 项无效。`);
    const value = item as Record<string, unknown>;
    if (typeof value.model !== "string" || value.model.trim() === "") throw new Error(`百炼模型列表第 ${index + 1} 项缺少 model。`);
    const info = value.model_info && typeof value.model_info === "object" ? value.model_info as Record<string, unknown> : undefined;
    const result: AiAccountModel = { id: value.model };
    if (typeof value.name === "string") result.name = value.name;
    if (typeof value.provider === "string") result.ownedBy = value.provider;
    if (typeof info?.context_window === "number") result.contextWindow = info.context_window;
    if (typeof info?.max_output_tokens === "number") result.maxOutputTokens = info.max_output_tokens;
    return result;
  });
}

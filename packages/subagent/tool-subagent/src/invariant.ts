/**
 * 功能：子代理模型选择的不变量校验。
 * 作用：校验模型 id 格式与选择参数合法，避免把非法选择传入驱动。
 * 关联文件：model-selection.ts、list-models.ts。
 */
import { SubagentError } from "lfaa-subagent";

/** 校验一个模型标识合法：provider/model 短横线格式。 */
export function assertModelId(modelId: unknown): asserts modelId is string {
  if (typeof modelId !== "string" || (!modelId.trim() || modelId.length > 300 || /[\u0000-\u001f\u007f]/u.test(modelId))) {
    throw new SubagentError("模型标识须为已保存账户 ID 或 provider/model，不能含控制字符。", "invalid-arguments");
  }
}

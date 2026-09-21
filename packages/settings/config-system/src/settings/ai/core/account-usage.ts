/**
 * 文件：account-usage.ts
 * 作用：把 Provider 官方余额/额度响应标准化为 LFAA 只读 Usage Snapshot。
 * 负责：DeepSeek 官方余额与阿里云 Model Studio 官方模型配额解析。
 * 不负责：发起网络请求、猜测不存在的余额、把静态价格换算成剩余额度。
 * 状态归属：纯函数，无状态。
 * 对外接口：parseDeepSeekBalance、parseQwenModelQuotas。
 * 修改注意事项：字段只能来自对应官方 API；官方未提供的数据保持缺省，禁止估算。
 */
import type { AiAccountUsageSnapshot } from "./account.types.ts";
import type { AiModelCapabilitySource } from "./provider.types.ts";

type JsonRecord = Record<string, unknown>;
function record(value: unknown): JsonRecord | null { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null; }
function number(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function string(value: unknown): string | undefined { return typeof value === "string" && value ? value : undefined; }

export function parseDeepSeekBalance(payload: unknown, source: AiModelCapabilitySource, checkedAt: string): AiAccountUsageSnapshot {
  const root = record(payload);
  const rows = Array.isArray(root?.balance_infos) ? root!.balance_infos : [];
  const balances = rows.flatMap((item) => {
    const row = record(item);
    const currency = string(row?.currency);
    const total = string(row?.total_balance);
    if (!currency || !total) return [];
    return [{
      currency,
      total,
      ...(string(row?.granted_balance) ? { granted: string(row?.granted_balance)! } : {}),
      ...(string(row?.topped_up_balance) ? { toppedUp: string(row?.topped_up_balance)! } : {}),
    }];
  });
  return {
    status: "available",
    scope: "api",
    source: { ...source, kind: "official-api" },
    checkedAt,
    message: root?.is_available === false ? "DeepSeek 官方接口报告当前余额不足以调用 API。" : "来自 DeepSeek 官方 /user/balance。",
    balances,
  };
}

export function parseQwenModelQuotas(payload: unknown, source: AiModelCapabilitySource, checkedAt: string): AiAccountUsageSnapshot {
  const root = record(payload);
  const output = record(root?.output);
  const quotas = Array.isArray(output?.quotas) ? output!.quotas : [];
  const modelQuotas = quotas.flatMap((item) => {
    const row = record(item);
    const model = string(row?.model);
    if (!model) return [];
    const modelLimit = record(row?.model_limit);
    const workspaceLimit = record(row?.workspace_limit);
    return [{
      model,
      ...(number(modelLimit?.request_limit) !== undefined ? { requestLimit: number(modelLimit?.request_limit)! } : {}),
      ...(number(modelLimit?.request_limit_period) !== undefined ? { requestLimitPeriodSec: number(modelLimit?.request_limit_period)! } : {}),
      ...(number(modelLimit?.usage_limit) !== undefined ? { tokenLimit: number(modelLimit?.usage_limit)! } : {}),
      ...(number(modelLimit?.usage_limit_period) !== undefined ? { tokenLimitPeriodSec: number(modelLimit?.usage_limit_period)! } : {}),
      ...(string(modelLimit?.usage_limit_field) ? { tokenField: string(modelLimit?.usage_limit_field)! } : {}),
      ...(number(workspaceLimit?.request_limit) !== undefined ? { workspaceRequestLimit: number(workspaceLimit?.request_limit)! } : {}),
      ...(number(workspaceLimit?.usage_limit) !== undefined ? { workspaceTokenLimit: number(workspaceLimit?.usage_limit)! } : {}),
    }];
  });
  return {
    status: "available",
    scope: "api",
    source: { ...source, kind: "official-api" },
    checkedAt,
    message: `来自阿里云 Model Studio 官方 /api/v1/quotas；返回 ${modelQuotas.length} 个模型配额。`,
    modelQuotas,
  };
}

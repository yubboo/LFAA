/**
 * 文件：account-usage.test.mjs
 * 作用：锁定 Provider 官方余额/额度响应到 LFAA Usage Snapshot 的纯函数映射。
 * 负责：DeepSeek /user/balance 与阿里云 /api/v1/quotas 的官方字段回归。
 * 不负责：真实联网、Secret 管理、设置页渲染。
 * 状态归属：测试进程临时数据。
 * 对外接口：Node test runner。
 * 关联文件：../src/settings/ai/core/account-usage.ts。
 * 修改注意事项：只能按官方响应字段断言；禁止加入估算余额或模拟“无限额度”。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { parseDeepSeekBalance, parseQwenModelQuotas } from "../src/index.ts";

const deepSeekSource = { kind: "official-docs", label: "DeepSeek", url: "https://api-docs.deepseek.com/api/get-user-balance", checkedAt: "2026-09-21" };
const qwenSource = { kind: "official-docs", label: "Model Studio", url: "https://help.aliyun.com/en/model-studio/list-quotas", checkedAt: "2026-09-21" };

test("DeepSeek 官方余额字段保持原值并区分充值/赠金", () => {
  const usage = parseDeepSeekBalance({
    is_available: true,
    balance_infos: [{ currency: "CNY", total_balance: "12.34", granted_balance: "2.34", topped_up_balance: "10.00" }],
  }, deepSeekSource, "2026-09-21T01:00:00.000Z");
  assert.equal(usage.status, "available");
  assert.equal(usage.scope, "api");
  assert.deepEqual(usage.balances, [{ currency: "CNY", total: "12.34", granted: "2.34", toppedUp: "10.00" }]);
});

test("阿里云官方模型配额只映射服务端返回的限额字段", () => {
  const usage = parseQwenModelQuotas({
    output: { quotas: [{
      model: "qwen3.8-max",
      model_limit: { request_limit: 120, request_limit_period: 60, usage_limit: 1000000, usage_limit_period: 60, usage_limit_field: "input_tokens" },
      workspace_limit: { request_limit: 240, usage_limit: 2000000 },
    }] },
  }, qwenSource, "2026-09-21T01:00:00.000Z");
  assert.equal(usage.status, "available");
  assert.deepEqual(usage.modelQuotas, [{
    model: "qwen3.8-max",
    requestLimit: 120,
    requestLimitPeriodSec: 60,
    tokenLimit: 1000000,
    tokenLimitPeriodSec: 60,
    tokenField: "input_tokens",
    workspaceRequestLimit: 240,
    workspaceTokenLimit: 2000000,
  }]);
});

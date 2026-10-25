/** 功能：保护系统模型配置的数据归属和 API 编辑边界。作用：登录账户共享读取，只有管理员可修改系统 Provider 配置。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const source = (path) => readFileSync(resolve(repository, path), "utf8");

test("系统模型写接口仅管理员可调用，读取接口仍要求登录", () => {
  const controller = source("packages/api/settings-controller/src/index.ts");
  const writeRoutes = [
    "POST /settings/ai/accounts",
    "POST /settings/ai/accounts/:accountId/refresh-models",
    "POST /settings/ai/accounts/:accountId/test-model",
    "POST /settings/ai/accounts/:accountId/test-credential",
    "PUT /settings/ai/accounts/:accountId/credential",
    "PUT /settings/ai/accounts/:accountId/model",
    "PUT /settings/ai/accounts/:accountId/reasoning",
    "POST /settings/ai/accounts/:accountId/activate",
    "DELETE /settings/ai/accounts/:accountId"
  ];
  for (const route of writeRoutes) {
    const [method, path] = route.split(" ");
    const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replaceAll(":accountId", ":accountId");
    assert.match(controller, new RegExp(`router\\.${method.toLowerCase()}\\("${escapedPath}", requireAuthentication, requireRole\\("admin"\\)`), `${route} 必须拒绝普通成员写系统配置`);
  }
  assert.match(controller, /router\.get\("\/settings\/ai\/accounts", requireAuthentication,/u, "共享模型目录仍只要求有效登录");
  assert.match(controller, /router\.get\("\/settings\/ai\/providers", requireAuthentication,/u, "Provider 目录仍只要求有效登录");
});

test("设置中心明确显示系统共享模型并将修改控件限制给管理员", () => {
  const page = source("packages/client/ui-settings/src/SettingsPage.tsx");
  assert.match(page, /所有 LFAA 登录账户共用当前 Provider 和模型/u);
  assert.match(page, /disabled=\{!canAdmin\} onClick=\{\(\) => openProviderConfiguration\(provider\)\}/u);
  assert.match(page, /更新系统模型 API Key/u);
  assert.match(page, /加密保存到系统配置/u);
});

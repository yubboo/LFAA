/**
 * 移植参考：DeepSeek Harness dsh-llm-pi-ai（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：login.ts
 * 功能：豆包 Provider 的「登录」——Ark 无网页 OAuth 登录，API Key 即唯一认证。
 * 与 DSH 差异说明：DSH 的 llm-pi-ai/login.ts 注册了基于浏览器 OAuth/授权流的登录回调；
 *   火山方舟（Ark）不提供设备码/OAuth 网页登录，只能在控制台创建 API Key 后填入设置中心。
 *   因此本模块把「登录」等价实现为：凭据校验 + 连通性诊断，而非跳转授权页。
 * 关联文件：auth.ts（密钥校验）、discovery.ts（连通性探测）。
 */
import { checkArkApiKey } from "./auth.js";
import { discoverArkModels } from "./discovery.js";

/** 登录（凭据校验+探测）结果。 */
export interface ArkLoginResult {
  loggedIn: boolean;
  message: string;
  modelCount: number;
}

/**
 * 用 API Key 完成「登录」：校验密钥并探测连通性。
 * @param secret Ark API Key。
 * @param signal 可选中止信号。
 */
export async function loginWithArkApiKey(secret: string, signal?: AbortSignal): Promise<ArkLoginResult> {
  const key = checkArkApiKey(secret);
  if (!key.ok || !key.value) return { loggedIn: false, message: key.reason ?? "API Key 无效。", modelCount: 0 };
  const result = await discoverArkModels(key.value, signal);
  return { loggedIn: result.connected, message: result.message, modelCount: result.models.length };
}

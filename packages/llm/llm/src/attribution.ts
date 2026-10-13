/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-llm。
 * 文件：attribution.ts
 * 功能：每个 Provider 请求都要带的非密钥产品身份（User-Agent）。
 * 作用：避免各适配器自行漂移；只放公开产品事实，不放密钥/路径/会话/用户标识。
 * 关联文件：completion.ts、llm-pi-ai。
 */

/** 对外产品身份；全部为公开事实。 */
export interface AppIdentity {
  product: string;
  version: string;
  url: string;
}

/** LFAA 默认身份。 */
export const APP_IDENTITY: AppIdentity = {
  product: "lfaa-harness",
  version: "0.1.1",
  url: "https://github.com/lfaa/lfaa",
};

/** 标准 User-Agent：`product/version (+url)`。 */
export function userAgent(identity: AppIdentity = APP_IDENTITY): string {
  return `${identity.product}/${identity.version} (+${identity.url})`;
}

/** 每个 Provider 请求都应合并的归因头（目前仅 user-agent，小写）。 */
export function attributionHeaders(identity: AppIdentity = APP_IDENTITY): Record<string, string> {
  return { "user-agent": userAgent(identity) };
}

/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-llm。
 * 文件：api-key.ts
 * 功能：判定一个待使用的 Provider API Key 是否可放入 HTTP 头。
 * 作用：在 fetch 之前给出可读诊断，而不是让底层以 UTF-16 码点报错。
 * 关联文件：completion.ts（注入密钥头）。
 */

/** HTTP 头可逐字节承载的可打印 ASCII（不含空格）。 */
const LEGAL_API_KEY = /^[\x21-\x7E]+$/;

/** 密钥不可用的原因。 */
export type ApiKeyRejection = "empty" | "illegalCharacters";

/** 一个待判定密钥的结论。 */
export type ApiKeyCheck =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly reason: ApiKeyRejection };

/**
 * 判定一个*已提供*的密钥，先静默去除首尾空白。
 * 空白填充的密钥有唯一读法故静默处理；其余缺陷全部上报。
 * @param raw 原样配置/存储/输入的密钥。
 * @returns 修剪后的可用密钥，或不可用原因。
 */
export function normalizeApiKey(raw: string): ApiKeyCheck {
  const value = raw.trim();
  if (value.length === 0) return { ok: false, reason: "empty" };
  if (!LEGAL_API_KEY.test(value)) return { ok: false, reason: "illegalCharacters" };
  return { ok: true, value };
}

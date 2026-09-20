/**
 * 文件：packages/credentials/credentials/src/index.ts
 * 作用：定义 LFAA 全平台唯一 Credential/Secret 契约。
 * 负责：credentialRef 语法、Secret Store Host Port、安全描述视图、通用脱敏。
 * 不负责：Windows Credential Manager、React UI、Provider/Auth 业务、插件安装。
 * 状态归属：纯 Service Definition，无运行时 Secret 状态。
 * 修改注意事项：任何新增读取 Secret 的 API 都必须证明 UI/日志无法通过返回值获得明文。
 */

/** Secret 实际持久化位置；`unavailable` 只用于安全视图，不允许伪装成可写 Store。 */
export type CredentialPersistence = "os-credential-store" | "memory" | "unavailable";

/** 带品牌的稳定 Secret 引用；配置只保存它，不保存 Secret。 */
export type CredentialRef = string & { readonly __lfaaCredentialRef: unique symbol };

const CREDENTIAL_REF_RE = /^[A-Za-z][A-Za-z0-9+.-]*:[^\s\0]{1,1023}$/;
const CREDENTIAL_PART_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function credentialRef(value: string): CredentialRef {
  const normalized = value.trim();
  if (!CREDENTIAL_REF_RE.test(normalized)) throw new Error("credentialRef 必须使用 scheme:value 形式且不能包含空白。\n");
  return normalized as CredentialRef;
}

/** 用固定 namespace + path parts 构造引用，避免不同业务自己拼接不稳定 Secret key。 */
export function createCredentialRef(namespace: string, ...parts: readonly string[]): CredentialRef {
  if (!/^[A-Za-z][A-Za-z0-9+.-]*$/.test(namespace)) throw new Error("credentialRef namespace 无效。");
  if (parts.length === 0 || parts.some((part) => !CREDENTIAL_PART_RE.test(part))) throw new Error("credentialRef path 无效。");
  return credentialRef(`${namespace}:${parts.join(":")}`);
}

/** 可以安全跨到设置 UI 的描述；永远没有 value/secret 字段。 */
export interface CredentialInfo {
  readonly configured: boolean;
  readonly persistence: CredentialPersistence;
  readonly writable: boolean;
  readonly source?: string;
}

/**
 * Secret Host Port。
 * `get` 是宿主/业务执行能力，不是 UI API；调用方必须按操作读取，禁止长期缓存明文。
 */
export interface CredentialStorePort {
  readonly persistence: Exclude<CredentialPersistence, "unavailable">;
  put(ref: string, secret: string): Promise<void>;
  get(ref: string): Promise<string | null>;
  delete(ref: string): Promise<void>;
  describe?(ref: string): Promise<CredentialInfo>;
}

const SECRET_PATTERNS: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\b(?:ghp|github_pat)_[A-Za-z0-9_]{8,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi,
  /\b(?:_authToken|authToken|api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\s*[=:]\s*[^\s,;]+/gi,
  /https?:\/\/[^\s/@:]+:[^\s/@]+@/g,
];

/** 日志/错误通用脱敏；只能作为最后一道防线，不能代替“不记录 Secret”的设计。 */
export function redactCredentialText(text: string, maxLength = 2048): string {
  let safe = text;
  for (const pattern of SECRET_PATTERNS) safe = safe.replace(pattern, "[REDACTED]");
  return safe.slice(0, Math.max(0, maxLength));
}

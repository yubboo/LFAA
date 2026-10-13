/**
 * 移植参考：DeepSeek Harness dsh-llm-pi-ai（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：auth.ts
 * 功能：Ark API Key 的校验与规范化。
 * 作用：在请求/探测前尽早给出可读诊断；密钥只经凭据服务，不落地日志。
 * 关联文件：lfaa-llm normalizeApiKey、packages/credentials/credentials。
 */
import { normalizeApiKey } from "lfaa-llm/src/api-key.js";

/** 校验结果。 */
export interface ArkKeyCheck {
  ok: boolean;
  /** 规范化后可放入 Authorization: Bearer 的密钥。 */
  value?: string;
  reason?: string;
}

/**
 * 校验并规范化 Ark API Key。
 * Ark 密钥通常为 UUID 形态或控制台生成串；本层只做修剪与 HTTP 头合法性检查，
 * 不臆测格式（不同密钥形态均允许），真正有效性由一次 /models 探测确认。
 * @param raw 用户输入的原始密钥。
 */
export function checkArkApiKey(raw: string): ArkKeyCheck {
  const checked = normalizeApiKey(raw);
  if (!checked.ok) {
    return {
      ok: false,
      reason: checked.reason === "empty"
        ? "请输入火山方舟 API Key。"
        : "API Key 含无法放入 HTTP 头的字符，请从火山方舟控制台重新复制。"
    };
  }
  if (checked.value.length > 512) return { ok: false, reason: "API Key 长度异常，请检查是否误粘贴了其他内容。" };
  return { ok: true, value: checked.value };
}

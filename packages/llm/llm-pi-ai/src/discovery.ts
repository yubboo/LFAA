/**
 * 移植参考：DeepSeek Harness dsh-llm-pi-ai（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：discovery.ts
 * 功能：豆包 Provider 能力探测：连通性、模型列表、流式支持。
 * 作用：在保存账户前验证密钥与端点；列出账户实际开通的模型/推理接入点。
 * 关联文件：settings probeAiProvider（通用探测入口）、auth.ts（密钥校验）。
 */
import { DOUBAO_CATALOG } from "./catalog.js";
import { checkArkApiKey } from "./auth.js";

/** 探测到的一个模型条目。 */
export interface DiscoveredModel {
  id: string;
  name: string;
}

/** 探测结果。 */
export interface ArkDiscoveryResult {
  connected: boolean;
  models: DiscoveredModel[];
  /** 流式 chat/completions 是否可用（Ark OpenAI 兼容默认支持）。 */
  streamingSupported: boolean;
  message: string;
}

/**
 * 探测豆包/火山方舟连通性并列出模型。
 * @param secret Ark API Key（原始）。
 * @param signal 可选中止信号。
 */
export async function discoverArkModels(secret: string, signal?: AbortSignal): Promise<ArkDiscoveryResult> {
  const key = checkArkApiKey(secret);
  if (!key.ok || !key.value) return { connected: false, models: [], streamingSupported: false, message: key.reason ?? "API Key 无效。" };
  try {
    const response = await fetch(DOUBAO_CATALOG.modelsUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${key.value}`, Accept: "application/json" },
      signal: signal ?? AbortSignal.timeout(12_000),
      redirect: "error"
    });
    if (response.status === 401 || response.status === 403) {
      return { connected: false, models: [], streamingSupported: false, message: "Ark 拒绝了 API Key，请检查密钥是否正确且已开通方舟服务。" };
    }
    if (!response.ok) {
      return { connected: false, models: [], streamingSupported: false, message: `Ark 返回 HTTP ${response.status}，暂时无法读取模型目录。` };
    }
    const payload = await response.json() as { data?: unknown };
    const list = Array.isArray(payload?.data) ? payload.data : [];
    const models: DiscoveredModel[] = list.flatMap((item) => {
      if (typeof item === "string") return [{ id: item, name: item }];
      if (typeof item === "object" && item !== null) {
        const raw = item as Record<string, unknown>;
        const id = typeof raw.id === "string" ? raw.id : "";
        return id ? [{ id, name: typeof raw.id === "string" ? raw.id : id }] : [];
      }
      return [];
    }).slice(0, 200);
    return { connected: true, models, streamingSupported: true, message: `已连接，发现 ${models.length} 个模型/接入点。` };
  } catch {
    return { connected: false, models: [], streamingSupported: false, message: "连接 Ark 失败，请检查网络与服务地址后重试。" };
  }
}

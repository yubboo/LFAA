/**
 * 文件：openai-compatible.ts
 * 作用：集中 OpenAI-compatible 配置协议的公共模型列表契约。
 * 负责：构造模型列表请求元数据、解析 OpenAI 风格 model list 响应。
 * 不负责：持有 API Key、发起 fetch、决定具体厂商 Base URL。
 * 状态归属：纯函数，无状态。
 * 对外接口：buildOpenAiCompatibleModelRequest、parseOpenAiCompatibleModelList。
 * 关联文件：../providers/<provider>/plugin.ts、../core/provider.types.ts。
 * 修改注意事项：厂商专用 Header/Base URL 留在插件；这里只处理真正共享的协议形状。
 */

export interface AiHttpRequestDescriptor {
  method: "GET";
  url: string;
  headers: Readonly<Record<string, string>>;
}

export interface AiDiscoveredModel {
  id: string;
  ownedBy?: string;
}

export function buildOpenAiCompatibleModelRequest(
  url: string,
  authHeader: { name: string; scheme?: string },
  credential: string,
): AiHttpRequestDescriptor {
  const value = authHeader.scheme ? `${authHeader.scheme} ${credential}` : credential;
  return { method: "GET", url, headers: { [authHeader.name]: value } };
}

export function parseOpenAiCompatibleModelList(input: unknown): readonly AiDiscoveredModel[] {
  if (!input || typeof input !== "object") throw new Error("模型列表响应不是对象。");
  const data = (input as { data?: unknown }).data;
  if (!Array.isArray(data)) throw new Error("模型列表响应缺少 data 数组。");

  return data.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`模型列表第 ${index + 1} 项无效。`);
    const id = (item as { id?: unknown }).id;
    const ownedBy = (item as { owned_by?: unknown }).owned_by;
    if (typeof id !== "string" || id.trim() === "") throw new Error(`模型列表第 ${index + 1} 项缺少 id。`);
    return typeof ownedBy === "string" ? { id, ownedBy } : { id };
  });
}

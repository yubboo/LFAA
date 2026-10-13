/**
 * 文件：types.ts
 * 功能：DeepSeek 搜索 Provider 私有的线上协议类型。
 * 作用：DeepSeek 走 Anthropic 兼容 Messages API，原生 web_search_20250305 服务工具返回
 *      web_search_tool_result 块与 text 块引用；本文件只描述这些线上结构，不依赖 ctx.llm。
 * 关联文件：provider.ts。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-web-search-deepseek。
 */

/** web_search_tool_result 块里的一条可引用结果。 */
export interface WebSearchResultItem {
  type: string;
  url: string;
  title?: string | null;
  /** Provider 给出的页面年龄/时间（映射为 publishedAt）。 */
  page_age?: string | null;
}

/** web_search_tool_result 内容块。 */
export interface WebSearchToolResultBlock {
  type: "web_search_tool_result";
  content?: WebSearchResultItem[];
}

/** text 块里的一条引用位置（snippet 来源）。 */
export interface CitationLocation {
  type?: string;
  url?: string | null;
  cited_text?: string | null;
}

/** text 内容块：模型正文加按 URL 的引用。 */
export interface TextBlock {
  type: "text";
  text?: string | null;
  citations?: CitationLocation[];
}

/** 任意内容块；本 Provider 只消费 web_search_tool_result 与 text。 */
export type ContentBlock = WebSearchToolResultBlock | TextBlock | { type: string };

/** DeepSeek Anthropic Messages 响应信封。 */
export interface AnthropicResponse {
  content?: ContentBlock[];
}

/** DeepSeek 错误响应信封（尽力而为，字段不固定）。 */
export interface AnthropicError {
  error?: { message?: string } | string;
  message?: string;
}

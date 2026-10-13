/**
 * 文件：types.ts
 * 功能：定义联网搜索与网页抓取能力缝（seam）的统一请求/结果/Provider 词汇表。
 * 作用：搜索与抓取共用一条注册与选择通道，Provider 选择、取消、错误码由本包统一负责，
 *      具体 HTTP/第三方搜索 Provider 只实现本文件的接口，不关心模型工具层。
 * 不负责：模型工具 schema、HTML 渲染、Provider 具体网络实现。
 * 关联文件：index.ts（WebRuntime 注册表与选择逻辑）、packages/web/tool-web、packages/web/web-fetch-http。
 * 修改注意：WebFetchBody 是闭合可辨识联合；新增 body 种类时所有消费端必须同步处理。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-web。
 */

/** 一次搜索请求。每个请求带一个 query；消费方可以并发发起多个请求。 */
export interface WebSearchRequest {
  /** 搜索关键词。 */
  readonly query: string
  /** 返回来源数上限；seam 会在返回时截断。省略=不限制。 */
  readonly maxResults?: number
  /**
   * LFAA 扩展：触发本次搜索的用户 ID。
   * Provider 据此从 settings/credentials 解析该用户自己的搜索密钥；
   * 不允许 Provider 从模型参数中读取或伪造此值。
   */
  readonly userId?: string
}

/** 归一化搜索结果。 */
export interface WebSearchResult {
  /** Provider 生成的可选摘要/回答文本（部分 Provider 不返回）。 */
  readonly content?: string
  /** 可引用来源列表，已按请求的 maxResults 截断。 */
  readonly sources: readonly WebSearchSource[]
  /** seam 是否为满足 maxResults 而截断了 sources。 */
  readonly truncated: boolean
}

/** 一条可引用来源。URL 必填；其余字段 Provider 不返回时即省略，不允许编造。 */
export interface WebSearchSource {
  readonly url: string
  readonly title?: string
  readonly snippet?: string
  /** Provider 给出的发布/抓取时间（ISO-8601 字符串）。 */
  readonly publishedAt?: string
}

/** 一次抓取请求。刻意不带超时/格式/提取控制：取消信号由执行方直接传入。 */
export interface WebFetchRequest {
  readonly url: string
  /** LFAA 扩展：触发本次抓取的用户 ID（预留，匿名 HTTP 抓取不依赖它）。 */
  readonly userId?: string
}

/** 归一化抓取结果。非 2xx 响应也是结果而非抛错。 */
export interface WebFetchResult {
  /** 允许重定向后的最终 URL。 */
  readonly url: string
  /** HTTP 状态码。 */
  readonly statusCode: number
  /** 解码后的响应体，按种类分类。 */
  readonly body: WebFetchBody
  /** Provider 是否截断了解码后的 body。 */
  readonly truncated: boolean
}

/** 抓取响应体的闭合联合：Provider 解码种类，工具层渲染种类。 */
export type WebFetchBody =
  | { readonly kind: 'html'; readonly content: string }
  | { readonly kind: 'text'; readonly content: string }

/** 可搜索后端。通过 WebRuntime.registerSearchProvider 注册。 */
export interface WebSearchProvider {
  /** 稳定唯一 ID（在搜索能力内）。 */
  readonly id: string
  /** 廉价的本地可用性检查；不得发起网络请求。 */
  available(): boolean
  /** 执行一次搜索；必须响应 signal 取消。 */
  search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>
}

/** 可抓取后端。通过 WebRuntime.registerFetchProvider 注册。 */
export interface WebFetchProvider {
  readonly id: string
  available(): boolean
  fetch(request: WebFetchRequest, signal?: AbortSignal): Promise<WebFetchResult>
}

/**
 * 带机器可读 code 的联网错误。
 * 共享码覆盖 Provider 缺失/不可用/歧义/重复、取消、Provider 失败；
 * 抓取 Provider 额外区分无效 URL、被阻止、重定向、大小/超时、不支持的内容类型。
 */
export class WebError extends Error {
  constructor(
    message: string,
    readonly code: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'WebError'
  }
}

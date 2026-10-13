/**
 * 功能：子代理投影（客户端安全视图）的词汇表。
 * 作用：把内部运行状态折叠为可安全暴露给模型/客户端的只读行，不含内部句柄或取消函数。
 * 关联文件：projection.ts、list-children.ts、tool-subagent-control。
 * 移植自 DeepSeek Harness subagent/projection-types（MIT License，commit 639ed01），按 LFAA 运行句柄适配。
 */

/** 一条直接子代理的目录行。 */
export type SubagentCatalogEntry = {
  readonly runId: string;
  readonly driver: string;
  readonly label: string;
  readonly activity: "running" | "completed" | "aborted" | "error";
  readonly startedAt: string;
};

/** 一个子代理运行的计时投影。 */
export interface SubagentTiming {
  /** 已结束阶段累计毫秒。 */
  settledMs: number;
  /** 当前仍在进行的开始时间戳；无进行中任务时缺省。 */
  activeSince?: string;
}

/** 子代理身份投影：模式 + 标签。 */
export type SubagentIdentity =
  | { readonly mode: "one-shot"; readonly label?: string }
  | { readonly mode: "continuable"; readonly label: string };

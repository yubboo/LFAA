/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-agent。
 * LFAA 适配：DSH 把选择耦合到 prompt 组装/请求事件；LFAA 保留纯数据结构与路由比较/切换提示逻辑，
 * 由 agent-loop 在发请求前读取。
 *
 * 文件：model-selection.ts
 * 功能：一次 Agent 请求选定的 provider/model/effort 与可变引用。
 * 作用：模型切换时生成一条用户可见的切换说明，避免上下文混淆。
 */
import type { Agent } from "./types.js";

/** 一次活 Agent 请求选定的完整 provider/model。 */
export interface ModelSelection {
  /** 已注册的 provider 路由。 */
  provider: string;
  /** provider 自有模型 id。 */
  model: string;
}

/** 可变模型选择 + 当前步骤捕获值。 */
export interface ModelSelectionRef {
  /** 下一步骤进入 prompt 组装前选定的模型。 */
  current: ModelSelection | undefined;
  /** 当前步骤进入组装时捕获的选择。 */
  assembled: ModelSelection | undefined;
}

/** 比较两条路由是否同 provider 同 model。 */
export function sameRoute(left: ModelSelection, right: ModelSelection): boolean {
  return left.provider === right.provider && left.model === right.model;
}

function routeLabel(route: ModelSelection, other: ModelSelection): string {
  return route.provider === other.provider ? route.model : `${route.provider}/${route.model}`;
}

/** 模型切换说明文本（在切换后追加一条用户角色提示）。 */
export function modelSwitchNotice(previous: ModelSelection, selected: ModelSelection): string {
  const from = routeLabel(previous, selected);
  const to = routeLabel(selected, previous);
  return `[model changed: 此点之前的助手回合由 ${from} 生成；本会话继续使用 ${to}]`;
}

/**
 * 判断是否需要在下一步骤前插入模型切换说明。
 * 同路由或无历史请求头时不需要；否则调用方把 notice 追加到 admitted 消息。
 */
export function modelSwitchNoticeIfChanged(
  selected: ModelSelection | undefined,
  previous: ModelSelection | undefined
): string | null {
  if (selected === undefined || previous === undefined) return null;
  if (sameRoute(selected, previous)) return null;
  return modelSwitchNotice(previous, selected);
}

/** 为某个 Agent 构造一个空的可变选择引用。 */
export function createModelSelectionRef(_agent: Agent): ModelSelectionRef {
  return { current: undefined, assembled: undefined };
}

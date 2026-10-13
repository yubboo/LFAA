/**
 * 文件：index.ts
 * 功能：回合大纲——把有序消息行折叠成 UI 轨迹用的回合条目（用户问什么、助手答了什么预览）。
 * 作用：为侧栏「回合卡片」提供轻量视图；每条只保留截断后的预览文本。
 * 边界：预览仅取用户/助手可见正文的前若干字符，不含工具调用参数/输出与系统提示。
 * 关联文件：session-projection、session-title（截断复用）、ai_messages 表。
 * 移植说明：概念参考 DSH session-turn-outline 的 turn/start→response 折叠，按 LFAA 消息行实现。
 */
import type { Context } from "@deepseek-ai/cordis";
import { truncateTitleUtf8 } from "lfaa-session-title";

/** 一个回合的大纲条目。 */
export interface TurnOutlineEntry {
  /** 从 1 开始的回合序号。 */
  readonly turn: number;
  /** 该回合用户消息的 _order（定位整轮的锚点）。 */
  readonly order: number;
  /** 用户输入预览（一行）。 */
  readonly prompt: string;
  /** 助手回复预览（最多约三行/180 字节）。 */
  readonly response: string;
}

function preview(text: string, maxBytes: number): string {
  return truncateTitleUtf8(text.replace(/\s+/gu, " ").trim(), maxBytes);
}

interface OutlineMessageRow {
  readonly role?: string;
  readonly content?: string;
  readonly _order?: number;
}

/**
 * 纯函数：按 _order 升序的消息行折叠回合。
 * 约定：每个 user 消息开启一个回合，紧随其后的第一个 assistant 消息作为其响应。
 */
export function buildTurnOutline(messages: readonly OutlineMessageRow[]): TurnOutlineEntry[] {
  const ordered = [...messages].sort((left, right) => Number(left._order ?? 0) - Number(right._order ?? 0));
  const turns: TurnOutlineEntry[] = [];
  let pending: { order: number; prompt: string } | undefined;
  for (const row of ordered) {
    if (row.role === "user") {
      pending = { order: Number(row._order ?? turns.length + 1), prompt: preview(String(row.content ?? ""), 80) };
    } else if (row.role === "assistant" && pending) {
      turns.push({ turn: turns.length + 1, order: pending.order, prompt: pending.prompt, response: preview(String(row.content ?? ""), 180) });
      pending = undefined;
    }
  }
  // 末尾尚未收到回复的用户输入，也作为一个开放回合列出。
  if (pending) turns.push({ turn: turns.length + 1, order: pending.order, prompt: pending.prompt, response: "" });
  return turns;
}

export const name = "lfaaSessionTurnOutline";
export function apply(ctx: Context): void {
  ctx.provide(name, buildTurnOutline);
}

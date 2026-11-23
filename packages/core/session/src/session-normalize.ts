// @lfaa/session 落盘数据归一：群聊配置与待回答澄清都从磁盘的未知形状还原，坏数据一律降级。
// 与 session-store 分开，避免会话读写文件同时承担「把脏数据变成可用结构」的职责。
import type { GroupSessionConfig, PendingQuestion } from "./types";

/** 读取群聊配置；成员少于两位或字段不合法时视为单聊，避免坏数据把会话卡死。 */
export function readGroupConfig(value: unknown): GroupSessionConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<GroupSessionConfig>;
  const agentIds = Array.isArray(raw.agentIds)
    ? raw.agentIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim())
    : [];
  if (agentIds.length < 2) return undefined;
  const clamp = (input: unknown, fallback: number, min: number, max: number): number => {
    const parsed = typeof input === "number" && Number.isFinite(input) ? Math.floor(input) : fallback;
    return Math.min(max, Math.max(min, parsed));
  };
  return {
    agentIds,
    ...(typeof raw.hostAgentId === "string" && raw.hostAgentId.trim() ? { hostAgentId: raw.hostAgentId.trim() } : {}),
    autoRounds: clamp(raw.autoRounds, 1, 1, 3),
    maxSpeakersPerRound: clamp(raw.maxSpeakersPerRound, 3, 1, 6),
    memberMaxSteps: clamp(raw.memberMaxSteps, 12, 1, 60),
  };
}

/** 读取待回答澄清；字段不完整时视为没有待回答问题。 */
export function readPendingQuestionValue(value: unknown): PendingQuestion | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<PendingQuestion>;
  if (typeof raw.messageId !== "string" || !raw.messageId.trim() || typeof raw.question !== "string") return undefined;
  return {
    messageId: raw.messageId,
    question: raw.question,
    options: Array.isArray(raw.options) ? raw.options.filter((option): option is string => typeof option === "string") : [],
  };
}
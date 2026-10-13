/**
 * 功能：子代理控制命令的客户端安全类型。
 * 作用：定义取消/暂停/恢复/列表等控制指令与回执，供控制工具层与驱动层之间传递。
 * 关联文件：control.ts、tool-subagent-control、manager.ts。
 * 移植自 DeepSeek Harness subagent/control-types（MIT License，commit 639ed01），去掉 Branded/SessionId 等 DSH 专属类型。
 */

/** 对子代理运行下发的控制指令。 */
export type SubagentControlCommand =
  | { readonly type: "cancel" }
  | { readonly type: "pause" }
  | { readonly type: "resume" };

/** 控制指令被受理的回执。 */
export interface SubagentControlReceipt {
  /** 是否受理；未受理时给出原因。 */
  readonly accepted: boolean;
  /** 人类可读说明（如已结束、不支持暂停）。 */
  readonly reason?: string;
}

/** 控制指令的类型标签枚举。 */
export const SUBAGENT_CONTROL_TYPES = ["cancel", "pause", "resume"] as const;
export type SubagentControlType = (typeof SUBAGENT_CONTROL_TYPES)[number];

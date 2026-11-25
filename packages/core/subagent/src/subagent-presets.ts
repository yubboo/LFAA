// 定义多角色子智能体（research / coder / browser / reviewer）的默认权限、步数预算与提示词模板。
import type { SubagentKind, SubagentMode } from "./types";

export interface SubagentRolePreset {
  kind: SubagentKind;
  defaultRole: string;
  mode: SubagentMode;
  maxSteps: number;
  buildPrompt: (role: string, prompt: string) => string;
}

const RESEARCH_PRESET: SubagentRolePreset = {
  kind: "research",
  defaultRole: "代码调研助手",
  mode: "read",
  maxSteps: 30,
  buildPrompt: (role, prompt) =>
    `[子智能体角色：${role}（只读深度调研）]
你是主智能体派发的只读调研专员。聚焦于定位根因、调用链、具体文件路径与行号。
- 禁止修改任何文件或运行破坏性命令；
- 优先使用 grep_search / find_files / read_file / git_status / git_diff 精准取证；
- 完成后给出精炼、结构化的结论，直接回传给主智能体，不要写冗长客套。

任务指令：
${prompt}`,
};

const CODER_PRESET: SubagentRolePreset = {
  kind: "coder",
  defaultRole: "代码实现助手",
  mode: "write",
  maxSteps: 40,
  buildPrompt: (role, prompt) =>
    `[子智能体角色：${role}（定向实现与验证）]
你是主智能体派发的代码实现专员。
- 先读清目标文件再做最小必要改动，遵守项目类型安全与代码规范；
- 改动后尽量运行针对性校验/单测确认结果；
- 完成后简明汇报改动文件路径、核心变更与验证结果，回传给主智能体。

任务指令：
${prompt}`,
};

const REVIEWER_PRESET: SubagentRolePreset = {
  kind: "reviewer",
  defaultRole: "代码审查助手",
  mode: "read",
  maxSteps: 25,
  buildPrompt: (role, prompt) =>
    `[子智能体角色：${role}（只读代码审查）]
你是主智能体派发的代码审查专员。
- 重点核查逻辑缺陷、边界条件、类型安全、权限隔离、性能退化与规范违例；
- 按严重程度列出具体问题（含文件路径、行号与修复建议），不要修改文件；
- 完成后将审查结论直接回传给主智能体。

任务指令：
${prompt}`,
};

const GENERAL_PRESET: SubagentRolePreset = {
  kind: "general",
  defaultRole: "子助手",
  mode: "read",
  maxSteps: 35,
  buildPrompt: (role, prompt) => `[子智能体角色：${role}]\n${prompt}`,
};

/** 按显式 kind 与兼容 mode 归一化出子智能体角色预设。 */
export function resolveSubagentPreset(
  kind: SubagentKind | undefined,
  mode: SubagentMode | undefined,
): SubagentRolePreset {
  if (kind === "browser" || mode === "browser") {
    return {
      kind: "browser",
      defaultRole: "浏览器验收助手",
      mode: "browser",
      maxSteps: 15,
      buildPrompt: (role, prompt) => `[子智能体角色：${role}]\n${prompt}`,
    };
  }
  if (kind === "research") return RESEARCH_PRESET;
  if (kind === "coder") return CODER_PRESET;
  if (kind === "reviewer") return REVIEWER_PRESET;
  if (mode === "write") return { ...GENERAL_PRESET, mode: "write" };
  return GENERAL_PRESET;
}

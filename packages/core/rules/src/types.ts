// 定义 @lfaa/rules 的无 DOM 领域契约：规则层级、规则文档及提示词装配输出。
export type RuleLayer = "system" | "project" | "user";

/** 描述单层规则的来源、作用域与文本。 */
export interface RuleDocument {
  id: string;
  layer: RuleLayer;
  title: string;
  source: string;
  content: string;
  readOnly: boolean;
}

/** 提供合成当前项目和用户规则所需的上下文参数。 */
export interface ComposeRulesInput {
  projectPaths?: string[];
  memoryHints?: string[];
}

/** 返回最终注入的规则文本及各层来源，供 Agent 和设置页使用。 */
export interface ComposedRulesResult {
  systemPrompt: string;
  documents: RuleDocument[];
}

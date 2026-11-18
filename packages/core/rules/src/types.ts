// 定义 @lfaa/rules 的无 DOM 领域契约：规则层级、规则文档及提示词装配输出。
export type RuleLayer = "system" | "project" | "user";

export interface RuleDocument {
  id: string;
  layer: RuleLayer;
  title: string;
  source: string;
  content: string;
  readOnly: boolean;
}

export interface ComposeRulesInput {
  projectPaths?: string[];
  memoryHints?: string[];
}

export interface ComposedRulesResult {
  systemPrompt: string;
  documents: RuleDocument[];
}

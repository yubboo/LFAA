// 系统提示词渲染：把各段提示按固定顺序拼成一条 system 消息内容，供运行循环每轮复用。
export interface SystemContentInput {
  systemPrompt: string;
  permissionHint: string;
  workspaceHint: string;
  modelHint: string;
  shellHint: string;
  libraryHint: string;
  progressHint: string;
  skillsCatalogHint: string;
  skillsSection: string;
  historyDigest: string;
  remainingSteps?: number;
  truncationHint: string;
  extraSystemHint: string;
}

/** 步数接近上限时的提醒；只在剩余步数不多时出现，避免每轮改动前缀。 */
function budgetHint(remainingSteps: number | undefined): string {
  return remainingSteps !== undefined && remainingSteps <= 8
    ? `\n步数预算：本轮仅剩 ${remainingSteps} 次工具步数，已接近上限。请先完成关键动作并收口；任务仍大时先交付可运行的一小步。`
    : "";
}

/** 按既有顺序渲染 system 内容；插件段落固定追加在末尾，保持前缀稳定。 */
export function renderSystemContent(input: SystemContentInput): string {
  const digestHint = input.historyDigest
    ? `\n前序工具轨迹（来自历史步骤，可直接复用，无需重复探查）：${input.historyDigest}`
    : "";
  const extra = input.extraSystemHint ? `\n\n${input.extraSystemHint}` : "";
  return `${input.systemPrompt}\n\n${input.permissionHint}\n${input.workspaceHint}\n${input.modelHint ? `${input.modelHint}\n` : ""}${input.shellHint ? `${input.shellHint}\n` : ""}${input.libraryHint}\n${input.progressHint}${input.skillsCatalogHint}${input.skillsSection}${digestHint}${budgetHint(input.remainingSteps)}${input.truncationHint}${extra}`;
}
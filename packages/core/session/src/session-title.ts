// 根据用户首条提问生成简洁会话标题：去掉客套与指令前缀，并按中英文长度预算截断。

const FILLER_PREFIX_RE =
  /^(?:你好[，,！!。.\s]*|您好[，,！!。.\s]*|请问[，,\s]*|请只[：:\s]*|请(?:你|帮我|帮忙)?(?:不要调用工具[，,\s]*)?(?:直接)?(?:用\s*\d+\s*[句话个自然段条项]+[，,\s]*)?(?:简短|详细)?(?:介绍一下|介绍|输出一个|输出|生成一个|生成|写一个|写|解释|分析|总结|对比|帮我|告诉我|回答)[：:\s]*|帮我(?:看看|检查|修复|优化|实现|写)[：:\s]*|hi[,\s]+|hello[,\s]+|please[,\s]+|can you[,\s]+|could you[,\s]+|help me[,\s]+)/iu;

/** 根据用户首条提问提炼简洁语义标题（去除客套与指令前缀，避免整段原句直接截断）。 */
export function generateConciseSessionTitle(rawContent: string): string {
  const firstLine = rawContent
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/[#>*_`]/gu, "")
    .trim()
    .split(/\r?\n/u)[0] ?? "";
  let text = firstLine.replace(/\s+/gu, " ").trim();
  for (let i = 0; i < 4; i += 1) {
    const stripped = text.replace(FILLER_PREFIX_RE, "").trim();
    if (stripped === text || !stripped) break;
    text = stripped;
  }
  const primaryClause = text.split(/[。！？；;\n]|，不要|，并且|，然后/u)[0]?.trim() || text;
  const cleaned = primaryClause.replace(/^[，,：:\s]+|[，,。.！!？?：:;；\s]+$/gu, "");
  const fallback = firstLine.replace(/\s+/gu, " ").trim();
  const base = cleaned || fallback || "新聊天";
  const cjkCount = (base.match(/[\u4e00-\u9fff]/gu) ?? []).length;
  const maxLen = cjkCount >= 3 ? 16 : 24;
  return base.length > maxLen ? base.slice(0, maxLen).trim() : base;
}

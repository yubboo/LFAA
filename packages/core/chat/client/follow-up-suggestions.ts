// 根据最新一轮问答上下文生成 3 条轻量延伸追问建议，显示在助手最新回复下方供一键点击追问。

function extractTopicLabel(userPrompt: string, assistantReply: string, isZh: boolean): string {
  const cleanUser = userPrompt
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/[#>*_`]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  const stripped = cleanUser
    .replace(/^(?:请不要调用工具[，,\s]*|请用\s*\d+\s*[句话个自然段条项]+[，,\s]*|简短|详细|介绍一下|介绍|说明|解释|对比|帮我|请问|你好[，,\s]*)+/iu, "")
    .split(/[。！？；;\n，,]/u)[0]
    ?.trim();
  if (stripped && stripped.length >= 2 && stripped.length <= 14) {
    return stripped;
  }

  const headingMatch = /^#{1,3}\s+([^\n]+)/mu.exec(assistantReply);
  if (headingMatch?.[1]) {
    const h = headingMatch[1].replace(/[*`]/gu, "").trim();
    if (h.length >= 2 && h.length <= 14) return h;
  }
  return isZh ? "这个方案" : "this topic";
}

/** 基于当前问答内容生成 3 条不重复的延伸追问建议 */
export function buildFollowUpSuggestions(
  userPrompt: string,
  assistantReply: string,
  isZh: boolean,
): string[] {
  const topic = extractTopicLabel(userPrompt, assistantReply, isZh);
  const hasCode = /```[\s\S]+?```/u.test(assistantReply);
  const hasTable = /\|.+\|\s*\n\s*\|[:\s|-]+\|/u.test(assistantReply);
  const hasList = /^\s*(?:[-*+]|\d+[.)])\s+/mu.test(assistantReply);

  if (isZh) {
    if (hasCode) {
      return [
        `这段${topic === "这个方案" ? "代码" : topic}有哪些边界情况需要注意？`,
        `能为这段实现补充对应的单元测试吗？`,
        `如何在性能和可读性上进一步优化？`,
      ];
    }
    if (hasTable) {
      return [
        `能针对「${topic}」给出更具体的实战示例吗？`,
        `不同方案之间在实际选型时该如何取舍？`,
        `有哪些常见误区或容易踩坑的地方？`,
      ];
    }
    if (hasList) {
      return [
        `关于「${topic}」，最核心的关键点是哪几项？`,
        `能结合具体场景展开举个例子吗？`,
        `下一步应该如何具体落地或验证？`,
      ];
    }
    return [
      `关于「${topic}」，能展开讲讲核心细节吗？`,
      `有没有实际案例或更直观的对比？`,
      `使用或实践过程中需要注意哪些问题？`,
    ];
  }

  if (hasCode) {
    return [
      "What edge cases should I watch out for in this code?",
      "Can you write unit tests for this implementation?",
      "How can we optimize performance and readability further?",
    ];
  }
  if (hasTable) {
    return [
      `Can you give a concrete example for ${topic}?`,
      "How should I choose between these options in practice?",
      "What common pitfalls should I avoid?",
    ];
  }
  return [
    `Can you elaborate on the key details of ${topic}?`,
    "Could you share a practical example or comparison?",
    "What should the next concrete step be?",
  ];
}

// 视频直连参数解析：从用户描述里读出时长，并去掉“帮我生成一个…五秒视频”这类指令词，
// 让真正送给视频模型的是画面描述，而不是聊天指令。
const CN_DIGITS: Record<string, number> = {
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

/** 解析中文数字 1–15（五 / 十 / 十二 / 十五）。 */
function chineseNumber(raw: string): number | undefined {
  if (raw === "十") return 10;
  if (raw.length === 1) return CN_DIGITS[raw];
  if (raw.length === 2 && raw[1] === "十") return (CN_DIGITS[raw[0]!] ?? 0) * 10;
  if (raw.startsWith("十")) return 10 + (CN_DIGITS[raw[1]!] ?? 0);
  if (raw.length === 3 && raw[1] === "十") return (CN_DIGITS[raw[0]!] ?? 0) * 10 + (CN_DIGITS[raw[2]!] ?? 0);
  return undefined;
}

/** 从描述里读取视频时长（秒）：支持 5秒 / 五秒 / 5s / 时长 5 秒；没写返回 undefined。 */
export function resolveVideoDuration(prompt: string): number | undefined {
  const text = prompt.trim();
  const numeric = /(\d{1,2})\s*(?:秒钟|秒|s(?:\b|$)|sec(?:ond)?s?\b)/iu.exec(text);
  if (numeric?.[1]) return Math.max(1, Math.min(Number(numeric[1]), 15));
  const chinese = /([一二两三四五六七八九十]{1,3})\s*(?:秒钟|秒)/u.exec(text);
  const value = chinese?.[1] ? chineseNumber(chinese[1]) : undefined;
  return value ? Math.max(1, Math.min(value, 15)) : undefined;
}

/** 清掉“帮我生成一个…的五秒视频”里的指令与时长尾巴，保留纯画面描述。 */
export function cleanVideoPrompt(prompt: string): string {
  const original = prompt.trim();
  let text = original
    .replace(/^(?:请|麻烦)?\s*(?:帮我|帮忙|给我|替我)?\s*(?:生成|做|来|出|制作)(?:一个|一段|一条|个|段|条)?\s*[，,：:\s]*/u, "")
    .replace(/[，,、]?\s*(?:的)?\s*(?:时长|长度)?\s*(?:\d{1,2}|[一二两三四五六七八九十]{1,3})\s*(?:秒钟|秒|s|sec(?:ond)?s?)\s*(?:的)?\s*(?:短视频|视频|短片)?\s*$/iu, "")
    .replace(/[，,、]\s*$/u, "")
    .trim();
  // 清完为空或只剩“视频”这类占位词时退回原文，避免把用户需求清没。
  return text && !/^(?:视频|短片|短视频|动画)$/u.test(text) ? text : original;
}
// 工具调用参数的解析与流式路径识别，供运行循环与工具执行器共用。

/** 解析模型返回的工具参数；仅接受 JSON 对象并给出可读错误。 */
export function safeParseArgs(raw: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: "工具参数必须为 JSON 对象。" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (err) {
    return { ok: false, error: `工具参数 JSON 解析失败：${err instanceof Error ? err.message : String(err)}` };
  }
}

// 参数流可能还没结束。只识别已闭合的首个 path 字段，不发布其余参数。
export function readStreamingPath(prefix: string): string | undefined {
  const quoted = /^\s*\{\s*"path"\s*:\s*("(?:\\.|[^"\\])*")/u.exec(prefix)?.[1];
  if (!quoted) return undefined;
  const parsed = safeParseArgs('{"path":' + quoted + '}');
  return parsed.ok && typeof parsed.value.path === "string" ? parsed.value.path.slice(0, 500) : undefined;
}

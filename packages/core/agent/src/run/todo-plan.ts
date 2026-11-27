// 任务清单策略：把 todo_write 排到工具列表首位，并在多步任务迟迟不建清单时给一次提醒。
/** 提醒模型的固定文案；同时作为「本轮已提醒过」的标记。 */
export const TODO_NUDGE_MARK = "【任务清单提醒】";
export const TODO_NUDGE_TEXT = `${TODO_NUDGE_MARK}本轮已经执行了多次工具调用，但还没有建立任务清单。如果任务仍需多步推进，请先调用 todo_write 列出剩余步骤并标注进行中，再继续；如果已接近完成，可以忽略这条提醒。`;

/** 把 todo_write 提到工具清单最前，其余按工具名确定性字典序排列，确保跨轮与跨重启的 tools schema 字节级稳定以命中 KV Cache。 */
export function preferTodoFirst<T extends { name: string }>(tools: readonly T[]): T[] {
  return [...tools].sort((a, b) => {
    if (a.name === "todo_write" && b.name !== "todo_write") return -1;
    if (b.name === "todo_write" && a.name !== "todo_write") return 1;
    return a.name.localeCompare(b.name);
  });
}

/** 是否该给模型补一条建清单的提醒：会话还没有清单、已执行多次工具、且本次运行没提醒过。 */
export function shouldNudgeTodos(input: {
  existingTodos: number;
  executedToolCount: number;
  alreadyNudged: boolean;
}): boolean {
  return !input.alreadyNudged && input.existingTodos === 0 && input.executedToolCount >= 3;
}
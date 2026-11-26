// 输入区附件插入历史：记录每次新增附件的批次与当时草稿，供 Ctrl+Z 只撤回「最近一次插入」。
// 纯数据操作，不触碰 React 状态；文字被改动后不再接管撤销，交回浏览器原生历史。

/** 一次附件插入批次：新增附件 id 与插入瞬间的草稿文本。 */
export interface AttachmentInsertBatch {
  ids: string[];
  draft: string;
}

/** 追加一次插入批次；没有新增附件时不入栈，避免空撤销。 */
export function pushInsertBatch(history: AttachmentInsertBatch[], ids: string[], draft: string): void {
  if (ids.length === 0) return;
  history.push({ ids: [...ids], draft });
}

/**
 * 取出可撤回的批次：草稿与插入时一致才说明「最后一次操作是插入附件」，
 * 此时返回该批次的附件 id；否则返回 null，让浏览器处理原生文字撤销。
 */
export function takeUndoBatch(history: AttachmentInsertBatch[], draft: string): string[] | null {
  const batch = history.at(-1);
  if (!batch || batch.draft !== draft) return null;
  history.pop();
  return batch.ids;
}

/** 手动移除附件后同步裁剪历史，避免撤回时再处理已经不存在的条目。 */
export function dropAttachmentFromHistory(history: AttachmentInsertBatch[], id: string): void {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const batch = history[index];
    if (!batch) continue;
    const remaining = batch.ids.filter((item) => item !== id);
    if (remaining.length === batch.ids.length) continue;
    if (remaining.length === 0) history.splice(index, 1);
    else batch.ids = remaining;
  }
}
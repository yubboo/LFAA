/**
 * 功能：按浏览器帧合并 AI 流式文本增量。
 * 作用：减少逐 token React 更新；非文本事件前刷新以保留协议顺序，取消/卸载时撤销待处理帧。
 * 关联文件：api.ts 的 streamAiChat；AiWorkChat 消费完整且有序的增量。
 */
type TextDelta = { messageId: string; delta: string; partId?: string; partStart?: number };
export function createStreamDeltas(emit: (value: TextDelta) => void) {
  let pending: TextDelta | null = null;
  let frame: number | null = null;
  function flush() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    const value = pending;
    pending = null;
    if (value) emit(value);
  }
  function dispose() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    pending = null;
  }
  return {
    push(value: TextDelta) {
      if (pending && (pending.messageId !== value.messageId || pending.partId !== value.partId || pending.partStart !== value.partStart)) flush();
      if (pending) pending.delta += value.delta;
      else pending = { ...value };
      if (frame === null) frame = requestAnimationFrame(flush);
    },
    flush,
    dispose
  };
}

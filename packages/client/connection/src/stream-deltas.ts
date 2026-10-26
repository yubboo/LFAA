/**
 * 功能：按浏览器帧合并 AI 流式文本增量。
 * 作用：减少逐 token React 更新；非文本事件前刷新以保留协议顺序，取消/卸载时撤销待处理帧。
 * 关联文件：api.ts 的 streamAiChat；AiWorkChat 消费完整且有序的增量。
 */
type TextDelta = { messageId: string; delta: string; partId?: string; partStart?: number };
const MAX_STREAM_DELTA_WAIT_MS = 72;
const MAX_STREAM_DELTA_LENGTH = 2048;
const STREAM_DELTA_BOUNDARY = /[\s,.;:!?，。；：！？、…]/u;

export function createStreamDeltas(emit: (value: TextDelta) => void) {
  let pending: TextDelta | null = null;
  let frame: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  function cancelScheduledFlush() {
    if (frame !== null) cancelAnimationFrame(frame);
    if (timer !== null) clearTimeout(timer);
    frame = null;
    timer = null;
  }
  function flush() {
    cancelScheduledFlush();
    const value = pending;
    pending = null;
    if (value) emit(value);
  }
  function dispose() {
    cancelScheduledFlush();
    pending = null;
  }
  function scheduleFrameFlush() {
    if (frame === null) frame = requestAnimationFrame(flush);
  }
  return {
    push(value: TextDelta) {
      if (pending && (pending.messageId !== value.messageId || pending.partId !== value.partId || pending.partStart !== value.partStart)) flush();
      let offset = 0;
      while (offset < value.delta.length) {
        if (!pending) pending = { ...value, delta: "" };
        let length = Math.min(MAX_STREAM_DELTA_LENGTH - pending.delta.length, value.delta.length - offset);
        const lastCodeUnit = value.delta.charCodeAt(offset + length - 1);
        if (offset + length < value.delta.length && lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) length -= 1;
        if (length === 0) {
          flush();
          continue;
        }
        pending.delta += value.delta.slice(offset, offset + length);
        offset += length;
        if (pending.delta.length >= MAX_STREAM_DELTA_LENGTH) flush();
      }

      // 标点/空白处尽快成批显示；无自然边界时用短计时器和长度上限兜底。
      // 计时器使后台标签页也不会无限积压，长度上限在事件循环繁忙时继续约束队列。
      if (pending) {
        if (STREAM_DELTA_BOUNDARY.test(value.delta)) scheduleFrameFlush();
        if (timer === null) timer = setTimeout(flush, MAX_STREAM_DELTA_WAIT_MS);
      }
    },
    flush,
    dispose
  };
}

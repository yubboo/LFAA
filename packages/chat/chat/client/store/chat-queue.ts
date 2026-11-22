// 排队消息的纯数据操作：新增、删除、上移/下移、编辑与一次性取出全部，便于单测与状态复用。

/** 一条排队中的后续消息。 */
export interface QueuedMessage {
  id: string;
  text: string;
}

let counter = 0;

/** 生成稳定 id，避免同一毫秒内重复。 */
export function createQueuedMessage(text: string): QueuedMessage {
  counter += 1;
  return { id: `queued-${Date.now()}-${counter}`, text: text.trim() };
}

/** 追加一条排队消息；空文本忽略。 */
export function enqueueMessage(queue: QueuedMessage[], text: string): QueuedMessage[] {
  const trimmed = text.trim();
  if (!trimmed) return queue;
  return [...queue, createQueuedMessage(trimmed)];
}

/** 删除指定下标的排队消息。 */
export function removeQueuedAt(queue: QueuedMessage[], index: number): QueuedMessage[] {
  return queue.filter((_, idx) => idx !== index);
}

/** 编辑指定排队消息的文本；空白文本视为删除。 */
export function updateQueuedAt(queue: QueuedMessage[], index: number, text: string): QueuedMessage[] {
  return queue.map((item, idx) => (idx === index ? { ...item, text: text.trim() } : item))
    .filter((item) => item.text.length > 0);
}

/** 上移/下移一条排队消息；越界时保持原样。 */
export function moveQueuedAt(queue: QueuedMessage[], index: number, delta: number): QueuedMessage[] {
  const target = index + delta;
  if (index < 0 || index >= queue.length || target < 0 || target >= queue.length) return queue;
  const next = [...queue];
  const [item] = next.splice(index, 1);
  if (item) next.splice(target, 0, item);
  return next;
}

/** 取出队首并返回剩余队列，用于一次运行结束后自动发送下一条。 */
export function takeQueuedHead(queue: QueuedMessage[]): { head: QueuedMessage | undefined; rest: QueuedMessage[] } {
  const [head, ...rest] = queue;
  return { head, rest };
}
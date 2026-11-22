// 输入栏排队消息区块：集中绑定 store 的排队操作，避免 ChatComposer 继续膨胀。
import type { ChatClientStore } from "../store/chat-store";
import type { QueuedMessage } from "../store/chat-queue";
import { ComposerQueuePanel } from "./ComposerQueuePanel";

export function ComposerQueueSection({ isZh, queue, store }: {
  isZh: boolean;
  queue: QueuedMessage[];
  store: ChatClientStore;
}) {
  return (
    <ComposerQueuePanel
      isZh={isZh}
      queue={queue}
      onEdit={(index, text) => store.updateQueuedMessage(index, text)}
      onRemove={(index) => store.removeQueuedMessage(index)}
      onMove={(index) => store.moveQueuedMessage(index, -1)}
      onSendNow={(index) => void store.sendQueuedNow(index)}
      onClear={() => store.clearQueuedMessages()}
      onFlush={() => void store.flushQueuedMessages()}
    />
  );
}
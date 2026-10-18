/**
 * 功能：为 AI Work 中正在运行的耗时标签提供一个共享秒级时钟。
 * 作用：只有订阅耗时文本的叶子组件接收时钟更新，不驱动聊天消息列表状态。
 * 关联文件：AiWorkResponse.tsx 持有订阅生命周期；AiWorkChat.tsx 只在运行时启动时钟。
 */
export interface AiActivityClockStore {
  getSnapshot(): number;
  subscribe(listener: () => void): () => void;
  start(): () => void;
}

export function createAiActivityClockStore(options: {
  now?: () => number;
  setInterval?: (callback: () => void, delayMs: number) => ReturnType<typeof setInterval>;
  clearInterval?: (timer: ReturnType<typeof setInterval>) => void;
} = {}): AiActivityClockStore {
  const readNow = options.now ?? Date.now;
  const schedule = options.setInterval ?? globalThis.setInterval;
  const cancel = options.clearInterval ?? globalThis.clearInterval;
  const listeners = new Set<() => void>();
  let now = readNow();
  let activeUsers = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  return {
    getSnapshot: () => now,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      activeUsers += 1;
      if (activeUsers === 1) {
        const current = readNow();
        if (current !== now) {
          now = current;
          notify();
        }
        timer = schedule(() => {
          now = readNow();
          notify();
        }, 1000);
      }

      let released = false;
      return () => {
        if (released) return;
        released = true;
        activeUsers = Math.max(0, activeUsers - 1);
        if (activeUsers === 0 && timer !== undefined) {
          cancel(timer);
          timer = undefined;
        }
      };
    }
  };
}

export const aiActivityClock = createAiActivityClockStore();

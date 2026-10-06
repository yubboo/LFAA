/**
 * 功能：为 Client 提供共享的浏览器状态存储和防抖写入器。
 * 作用：统一版本/作用域键、编解码、存储异常降级及离页/卸载写入生命周期；不替代 Server/Daemon 业务 Owner。
 * 关联文件：ai-work-drafts.ts、scroll-restoration.ts、ui-layout/Workbench.tsx。
 */

export interface BrowserStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PersistenceCodec<T> {
  encode(value: T): string;
  /** 返回 undefined 表示内容无法解码或不符合目标类型。 */
  decode(serialized: string): T | undefined;
}

export const stringPersistenceCodec: PersistenceCodec<string> = {
  encode: (value) => {
    if (typeof value !== "string") throw new TypeError("此值不是字符串。");
    return value;
  },
  decode: (serialized) => serialized
};

export const finiteNumberPersistenceCodec: PersistenceCodec<number> = {
  encode: (value) => {
    if (!Number.isFinite(value)) throw new TypeError("此值不是有限数值。");
    return String(value);
  },
  decode: (serialized) => {
    if (!serialized.trim()) return undefined;
    const value = Number(serialized);
    return Number.isFinite(value) ? value : undefined;
  }
};

/** JSON 存储必须提供运行时守卫，避免把失效或旧格式数据当作当前类型使用。 */
export function createJsonPersistenceCodec<T>(isValue: (value: unknown) => value is T): PersistenceCodec<T> {
  return {
    encode: (value) => {
      if (!isValue(value)) throw new TypeError("此值不符合 JSON 持久化类型。");
      const serialized = JSON.stringify(value);
      if (typeof serialized !== "string") throw new TypeError("此值无法序列化为 JSON 文本。");
      return serialized;
    },
    decode: (serialized) => {
      const value: unknown = JSON.parse(serialized);
      return isValue(value) ? value : undefined;
    }
  };
}

/** 版本与作用域进入键名，旧版本自然隔离；每个作用域分段单独编码，避免分隔符冲突。 */
export function createClientPersistenceKey(namespace: string, version: number, scope: readonly string[] = []): string {
  if (!/^[a-z0-9][a-z0-9.-]*$/iu.test(namespace)) throw new TypeError("持久化 namespace 只能包含字母、数字、点和短横线。");
  if (!Number.isSafeInteger(version) || version < 1) throw new RangeError("持久化版本必须是正安全整数。");
  const suffix = scope.map((part) => encodeURIComponent(part)).join(":");
  return `lfaa.${namespace}.v${version}${suffix ? `:${suffix}` : ""}`;
}

export interface BrowserPersistenceOptions<T> {
  key: string;
  codec: PersistenceCodec<T>;
  area?: "local" | "session";
  /** 测试、桌面适配和受限环境可注入实现；显式 null 表示禁用存储。 */
  storage?: BrowserStorageAdapter | null;
}

export interface BrowserPersistence<T> {
  readonly key: string;
  read(): T | undefined;
  write(value: T): boolean;
  remove(): boolean;
}

/** 统一隔离 localStorage 的权限、配额、隐私模式与序列化异常。 */
export function createBrowserPersistence<T>(options: BrowserPersistenceOptions<T>): BrowserPersistence<T> {
  const area = options.area ?? "local";
  const getStorage = (): BrowserStorageAdapter | null => {
    if (options.storage !== undefined) return options.storage;
    try {
      if (typeof window === "undefined") return null;
      return area === "session" ? window.sessionStorage : window.localStorage;
    } catch {
      return null;
    }
  };

  return {
    key: options.key,
    read(): T | undefined {
      const storage = getStorage();
      if (!storage) return undefined;
      try {
        const serialized = storage.getItem(options.key);
        if (serialized === null) return undefined;
        const value = options.codec.decode(serialized);
        if (value === undefined) {
          try { storage.removeItem(options.key); } catch { /* 清理坏值失败不影响读取降级。 */ }
        }
        return value;
      } catch {
        return undefined;
      }
    },
    write(value: T): boolean {
      const storage = getStorage();
      if (!storage) return false;
      let serialized: string;
      try {
        serialized = options.codec.encode(value);
      } catch {
        return false;
      }
      try {
        if (storage.getItem(options.key) === serialized) return true;
      } catch { /* 读取失败时仍尝试一次写入；存储自身会决定是否允许提交。 */ }
      try {
        storage.setItem(options.key, serialized);
        return true;
      } catch {
        return false;
      }
    },
    remove(): boolean {
      const storage = getStorage();
      if (!storage) return false;
      try {
        if (storage.getItem(options.key) === null) return true;
      } catch { /* 读取失败时仍尝试删除，避免失败的读取妨碍清空。 */ }
      try { storage.removeItem(options.key); return true; } catch { return false; }
    }
  };
}

export interface DebouncedPersistenceWriterOptions<T> {
  delayMs: number;
  removeWhen?: (value: T) => boolean;
  /** 可注入页面生命周期订阅；默认绑定浏览器 pagehide。 */
  subscribePageHide?: (flush: () => void) => () => void;
}

export interface DebouncedPersistenceWriter<T> {
  schedule(value: T): void;
  flush(): boolean;
  cancel(): void;
  clear(): boolean;
  bindPageLifecycle(): void;
  dispose(): void;
}

/**
 * 把定时写入、空值清理、pagehide 冲刷和卸载释放收敛到一个有界生命周期。
 * 创建本身无副作用；React 消费者应在 effect 中绑定生命周期，并在清理函数中 dispose。
 */
export function createDebouncedPersistenceWriter<T>(
  persistence: BrowserPersistence<T>,
  options: DebouncedPersistenceWriterOptions<T>
): DebouncedPersistenceWriter<T> {
  if (!Number.isFinite(options.delayMs) || options.delayMs < 0) throw new RangeError("防抖延迟必须是非负有限数值。");

  let timer: ReturnType<typeof setTimeout> | null = null;
  let hasPendingValue = false;
  let hasPendingRemoval = false;
  let pendingValue!: T;
  let disposed = false;
  let unsubscribePageHide: (() => void) | null = null;

  const cancelTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const writer: DebouncedPersistenceWriter<T> = {
    schedule(value) {
      if (disposed) return;
      let shouldRemove = false;
      try { shouldRemove = options.removeWhen?.(value) ?? false; } catch { /* 谓词异常时保存原值，避免误删用户内容。 */ }
      if (shouldRemove) {
        writer.clear();
        return;
      }
      cancelTimer();
      hasPendingRemoval = false;
      pendingValue = value;
      hasPendingValue = true;
      timer = setTimeout(() => { writer.flush(); }, options.delayMs);
    },
    flush() {
      cancelTimer();
      if (hasPendingRemoval) {
        const removed = persistence.remove();
        if (removed) hasPendingRemoval = false;
        return removed;
      }
      if (!hasPendingValue) return true;
      const value = pendingValue;
      const written = persistence.write(value);
      if (written) hasPendingValue = false;
      return written;
    },
    cancel() {
      cancelTimer();
      hasPendingValue = false;
      hasPendingRemoval = false;
    },
    clear() {
      cancelTimer();
      hasPendingValue = false;
      hasPendingRemoval = true;
      const removed = persistence.remove();
      if (removed) hasPendingRemoval = false;
      return removed;
    },
    bindPageLifecycle() {
      if (disposed || unsubscribePageHide) return;
      if (options.subscribePageHide) {
        try { unsubscribePageHide = options.subscribePageHide(() => { writer.flush(); }); } catch { unsubscribePageHide = null; }
        return;
      }
      try {
        if (typeof window === "undefined") return;
        const flushOnPageHide = () => { writer.flush(); };
        window.addEventListener("pagehide", flushOnPageHide);
        unsubscribePageHide = () => window.removeEventListener("pagehide", flushOnPageHide);
      } catch {
        unsubscribePageHide = null;
      }
    },
    dispose() {
      if (disposed) return;
      writer.flush();
      try { unsubscribePageHide?.(); } catch { /* 生命周期解除失败不阻断组件卸载。 */ }
      unsubscribePageHide = null;
      disposed = true;
    }
  };

  return writer;
}

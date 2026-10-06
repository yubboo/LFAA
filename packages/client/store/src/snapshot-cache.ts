/**
 * 功能：管理各工作区的短期首屏快照。
 * 作用：按最近使用淘汰内存缓存，并在登录身份失效时统一释放；缓存不替代权威请求或持久化数据。
 * 关联文件：App、SettingsPage、MinecraftWorkspace、FileManagerPage、AiWorkChat。
 */
const caches = new Set<{ clear(): void }>();
// 内部缓存预算限制常驻内存，不是用户内容/历史条数限制；超预算只放弃首屏预热，原数据照常从 Host 读取。
const SNAPSHOT_ENTRY_BUDGET = 16;
const SNAPSHOT_TEXT_BUDGET = 8 * 1024 * 1024;

export function createSnapshotCache<T>(textSize: (value: T) => number = () => 0) {
  const entries = new Map<string, { value: T; size: number }>();
  let totalSize = 0;
  const remove = (key: string) => {
    const entry = entries.get(key);
    if (entry) totalSize -= entry.size;
    entries.delete(key);
  };
  const cache = {
    get(key: string): T | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key); entries.set(key, entry);
      return entry.value;
    },
    set(key: string, value: T) {
      remove(key);
      const size = textSize(value);
      if (!Number.isFinite(size) || size < 0 || size > SNAPSHOT_TEXT_BUDGET) return;
      entries.set(key, { value, size }); totalSize += size;
      while (entries.size > SNAPSHOT_ENTRY_BUDGET || totalSize > SNAPSHOT_TEXT_BUDGET) {
        remove(entries.keys().next().value!);
      }
    },
    clear() { entries.clear(); totalSize = 0; },
    dispose() { cache.clear(); caches.delete(cache); }
  };
  caches.add(cache);
  return cache;
}

export function clearClientSnapshots(): void { for (const cache of caches) cache.clear(); }

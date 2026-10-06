/**
 * 功能：恢复生产构建切换后仍打开的旧 Web 页面。
 * 作用：识别懒加载模块资源失败，在同一标签页会话内自动刷新一次并防止刷新循环。
 * 关联文件：packages/client/modules/src/client/index.ts、apps/cli/tests/client-stale-chunk-recovery.test.mjs。
 */
const STALE_CHUNK_RELOAD_GUARD_KEY = "lfaa:web-stale-chunk-reload";
const STALE_CHUNK_RELOAD_GUARD_DELAY_MS = 15_000;
const STALE_MODULE_LOAD_FAILURE = /(?:failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|unable to preload css)/iu;

/** 新文档启动后短暂保留保护，避免构建仍不完整时再次自动刷新。 */
export function initializeStaleChunkRecovery(target: Window = window): void {
  try {
    const storage = target.sessionStorage;
    if (storage.getItem(STALE_CHUNK_RELOAD_GUARD_KEY) !== "1") return;
    target.setTimeout(() => {
      try {
        storage.removeItem(STALE_CHUNK_RELOAD_GUARD_KEY);
      } catch {
        // 会话存储不可用时保留已有保护，避免自动刷新循环。
      }
    }, STALE_CHUNK_RELOAD_GUARD_DELAY_MS);
  } catch {
    // 会话存储不可用时继续运行；后续导入错误由 React 错误边界显示。
  }
}

/** 返回 true 表示检测到静态懒加载资源故障并已发起一次刷新。 */
export function recoverFromStaleClientModuleLoad(error: unknown, target: Window = window): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!STALE_MODULE_LOAD_FAILURE.test(message)) return false;

  try {
    const storage = target.sessionStorage;
    if (storage.getItem(STALE_CHUNK_RELOAD_GUARD_KEY) === "1") return false;
    storage.setItem(STALE_CHUNK_RELOAD_GUARD_KEY, "1");
  } catch {
    // 存储被禁用时不自动重载；React 错误边界仍提供手动刷新入口。
    return false;
  }

  target.location.reload();
  return true;
}

/** 在 ClientModules 的实际动态导入边界恢复旧资源错误，并保留原始异常供错误边界处理。 */
export async function loadClientModuleWithRecovery<T>(load: () => Promise<T>, target: Window = window): Promise<T> {
  try {
    return await load();
  } catch (error) {
    recoverFromStaleClientModuleLoad(error, target);
    throw error;
  }
}

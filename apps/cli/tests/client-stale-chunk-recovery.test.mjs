/**
 * 功能：回归验证 Vite 懒加载资源过期后的单次恢复策略。
 * 作用：验证已打开的旧客户端最多自动刷新一次，重复失败不会形成页面刷新循环。
 * 关联文件：packages/client/web/src/stale-chunk-recovery.ts。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { initializeStaleChunkRecovery, loadClientModuleWithRecovery, recoverFromStaleClientModuleLoad } from "lfaa-client-modules/src/client/stale-chunk-recovery.js";

const guardKey = "lfaa:web-stale-chunk-reload";

function createWindowHarness(initialGuard = null) {
  const values = new Map(initialGuard ? [[guardKey, initialGuard]] : []);
  const timers = [];
  let reloadCount = 0;
  const target = {
    sessionStorage: {
      getItem(key) { return values.get(key) ?? null; },
      setItem(key, value) { values.set(key, value); },
      removeItem(key) { values.delete(key); }
    },
    location: { reload() { reloadCount += 1; } },
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
  };
  return {
    target,
    values,
    timers,
    get reloadCount() { return reloadCount; }
  };
}

test("旧哈希懒加载失败会触发一次刷新并设置会话保护", () => {
  const harness = createWindowHarness();

  assert.equal(recoverFromStaleClientModuleLoad(new TypeError("Failed to fetch dynamically imported module: /assets/ApplicationWorkspace-old.js"), harness.target), true);
  assert.equal(recoverFromStaleClientModuleLoad(new TypeError("Failed to fetch dynamically imported module"), harness.target), false);

  assert.equal(harness.reloadCount, 1);
  assert.equal(harness.values.get(guardKey), "1");
  assert.equal(harness.timers.length, 0);
});

test("Client 模块导入边界会恢复旧资源并继续抛出原始错误", async () => {
  const harness = createWindowHarness();
  const failure = new TypeError("Failed to fetch dynamically imported module: /assets/ApplicationWorkspace-old.js");

  await assert.rejects(loadClientModuleWithRecovery(() => Promise.reject(failure), harness.target), error => error === failure);

  assert.equal(harness.reloadCount, 1);
  assert.equal(harness.values.get(guardKey), "1");
});

test("普通模块异常不会触发资源刷新", () => {
  const harness = createWindowHarness();

  const retried = recoverFromStaleClientModuleLoad(new Error("浏览器模块未装配：ApplicationWorkspace"), harness.target);

  assert.equal(retried, false);
  assert.equal(harness.reloadCount, 0);
  assert.equal(harness.values.has(guardKey), false);
});

test("刷新后保护在短暂稳定窗口结束时清理，重复失败不会再次刷新", () => {
  const harness = createWindowHarness("1");
  initializeStaleChunkRecovery(harness.target);

  const retried = recoverFromStaleClientModuleLoad(new TypeError("Failed to fetch dynamically imported module"), harness.target);
  assert.equal(harness.reloadCount, 0);
  assert.equal(retried, false);
  assert.equal(harness.timers.length, 1);
  assert.equal(harness.timers[0].delay, 15_000);

  harness.timers[0].callback();
  assert.equal(harness.values.has(guardKey), false);
});

test("会话存储不可用时不尝试自动刷新", () => {
  const harness = createWindowHarness();
  Object.defineProperty(harness.target, "sessionStorage", { get() { throw new Error("blocked"); } });
  initializeStaleChunkRecovery(harness.target);
  const retried = recoverFromStaleClientModuleLoad(new TypeError("Failed to fetch dynamically imported module"), harness.target);

  assert.equal(harness.reloadCount, 0);
  assert.equal(retried, false);
});

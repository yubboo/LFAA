// 验证内置浏览器双引擎模式判定、同源防自嵌套与 CDP 修饰键掩码计算。
import assert from "node:assert/strict";
import test from "node:test";
import {
  canUseNativeEngine,
  computeCdpModifiers,
  isSelfOriginUrl,
  resolveEffectiveRenderMode,
} from "../client/panes/browser-render-mode";

test("isSelfOriginUrl 拦住与宿主同源地址，放行其他本地端口与外部网页", () => {
  assert.equal(isSelfOriginUrl("http://127.0.0.1:5173/chat", "http://127.0.0.1:5173"), true);
  assert.equal(isSelfOriginUrl("http://127.0.0.1:5174/", "http://127.0.0.1:5173"), false);
  assert.equal(isSelfOriginUrl("https://example.com/", "http://127.0.0.1:5173"), false);
  assert.equal(isSelfOriginUrl("about:blank", "http://127.0.0.1:5173"), false);
});

test("resolveEffectiveRenderMode 原生优先：可嵌入页一律走原生 iframe，仅拦截站与同源回退 CDP", () => {
  const hostOrigin = "http://127.0.0.1:5173";

  // 本地开发页与普通可嵌入网页无论谁操作都直接走原生 GPU 加速直连
  const localSnap = { url: "http://127.0.0.1:5174/", embeddable: true };
  assert.equal(canUseNativeEngine(localSnap, hostOrigin), true);
  assert.equal(resolveEffectiveRenderMode(localSnap, hostOrigin), "native");

  // 被 X-Frame-Options/CSP 拦截或与宿主同源时自动静默回退到 CDP 兜底
  const blockedSnap = { url: "https://github.com/", embeddable: false };
  assert.equal(canUseNativeEngine(blockedSnap, hostOrigin), false);
  assert.equal(resolveEffectiveRenderMode(blockedSnap, hostOrigin), "cdp");

  const selfSnap = { url: "http://127.0.0.1:5173/", embeddable: true };
  assert.equal(canUseNativeEngine(selfSnap, hostOrigin), false);
  assert.equal(resolveEffectiveRenderMode(selfSnap, hostOrigin), "cdp");

  assert.equal(resolveEffectiveRenderMode(null, hostOrigin), "cdp");
});

test("computeCdpModifiers 按 Alt=1、Ctrl=2、Meta=4、Shift=8 组合位掩码", () => {
  assert.equal(computeCdpModifiers({}), 0);
  assert.equal(computeCdpModifiers({ altKey: true }), 1);
  assert.equal(computeCdpModifiers({ ctrlKey: true }), 2);
  assert.equal(computeCdpModifiers({ metaKey: true, shiftKey: true }), 12);
  assert.equal(computeCdpModifiers({ altKey: true, ctrlKey: true, metaKey: true, shiftKey: true }), 15);
});

// 内置浏览器双引擎模式判定、同源递归防呆、CDP 修饰键掩码与 Base64 帧解码辅助。
import type { BrowserSessionSnapshot } from "../api/browser-client";

export type EffectiveRenderMode = "native" | "cdp";

/** 判断目标地址是否与宿主页面同源，避免在内置浏览器中打开 LFAA 自身引发无限递归嵌套。 */
export function isSelfOriginUrl(rawUrl: string, hostOrigin: string): boolean {
  if (!rawUrl || !hostOrigin) return false;
  try {
    return new URL(rawUrl).origin === hostOrigin;
  } catch {
    return false;
  }
}

/** 当前快照是否具备使用原生 iframe 直连的条件。 */
export function canUseNativeEngine(
  snap: Pick<BrowserSessionSnapshot, "url" | "embeddable"> | null,
  hostOrigin: string,
): boolean {
  if (!snap?.url || snap.url === "about:blank") return false;
  if (snap.embeddable === false) return false;
  if (isSelfOriginUrl(snap.url, hostOrigin)) return false;
  return /^https?:\/\//iu.test(snap.url);
}

/**
 * 解析当前生效的渲染引擎（原生优先，零多余切换）：
 * - 凡是可嵌入页面（本地开发页、未拦截嵌入的网页），无论 Agent 是否在运行，一律直接使用原生 `<iframe>`
 *   享受宿主浏览器 GPU 硬件加速与 60/120fps 丝滑渲染，控制权由「接管 / 交还 Agent」与防误触护盾统一管理；
 * - 仅在页面未加载、被 X-Frame-Options / CSP 拒绝嵌入或与宿主同源防自嵌套时，静默自动回退到 2x CDP 画布兜底。
 */
export function resolveEffectiveRenderMode(
  snap: Pick<BrowserSessionSnapshot, "url" | "embeddable"> | null,
  hostOrigin: string,
): EffectiveRenderMode {
  return canUseNativeEngine(snap, hostOrigin) ? "native" : "cdp";
}

/** 将浏览器事件修饰键转换为 CDP modifiers 位掩码（Alt=1, Ctrl=2, Meta=4, Shift=8）。 */
export function computeCdpModifiers(event: {
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}): number {
  return (event.altKey ? 1 : 0)
    | (event.ctrlKey ? 2 : 0)
    | (event.metaKey ? 4 : 0)
    | (event.shiftKey ? 8 : 0);
}

/** 若运行环境支持原生 Uint8Array.fromBase64（Chromium 140+）则零 JS 循环转为 Blob；否则返回 null 交由原生 img.decode() 解码。 */
export function tryDecodeBase64ToBlobNative(base64: string, mime: string): Blob | null {
  const fromBase64 = (Uint8Array as unknown as { fromBase64?: (input: string) => Uint8Array<ArrayBuffer> }).fromBase64;
  if (typeof fromBase64 !== "function") return null;
  try {
    return new Blob([fromBase64(base64)], { type: mime });
  } catch {
    return null;
  }
}

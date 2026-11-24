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

/** Agent 实操和人工接管阶段均展示宿主标签，完成后保留 Agent 操作留下的页面状态。 */
export function resolveEffectiveRenderMode(
  snap: Pick<BrowserSessionSnapshot, "url" | "embeddable"> & Partial<Pick<BrowserSessionSnapshot, "lastActor" | "takeoverPaused">> | null,
  hostOrigin: string,
  browserAutomationActive = false,
): EffectiveRenderMode {
  if (browserAutomationActive || snap?.lastActor === "agent" || snap?.takeoverPaused) return "cdp";
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

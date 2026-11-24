// 将前端轻量输入负载映射为 Chromium CDP Input 协议命令，绕过 Playwright 定位与截图往返实现毫秒级键鼠响应。
import type { CDPSession } from "playwright-core";
import type { BrowserInputPayload } from "../types";

const SPECIAL_KEY_CODES: Record<string, number> = {
  Backspace: 8,
  Tab: 9,
  Enter: 13,
  Escape: 27,
  " ": 32,
  PageUp: 33,
  PageDown: 34,
  End: 35,
  Home: 36,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  Delete: 46,
};

/** 计算常用按键的 Windows 虚拟键码，确保 Chromium 正确响应 Ctrl+A/C/V、退格、回车与方向键。 */
export function resolveVirtualKeyCode(key: string): number | undefined {
  if (key in SPECIAL_KEY_CODES) return SPECIAL_KEY_CODES[key];
  if (key.length === 1) {
    const upper = key.toUpperCase().charCodeAt(0);
    if ((upper >= 65 && upper <= 90) || (upper >= 48 && upper <= 57)) {
      return upper;
    }
  }
  return undefined;
}

/** 通过已建立的常驻 CDPSession 派发滚轮、鼠标、拖拽、按键与文本输入。 */
export async function dispatchCdpInput(cdp: CDPSession, payload: BrowserInputPayload): Promise<void> {
  if (payload.kind === "wheel") {
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: Math.round(payload.x),
      y: Math.round(payload.y),
      deltaX: Math.round(payload.deltaX),
      deltaY: Math.round(payload.deltaY),
      modifiers: payload.modifiers ?? 0,
    });
    return;
  }

  if (payload.kind === "mousemove") {
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: Math.round(payload.x),
      y: Math.round(payload.y),
      buttons: payload.buttons ?? 0,
      modifiers: payload.modifiers ?? 0,
    });
    return;
  }

  if (payload.kind === "mousedown" || payload.kind === "mouseup") {
    const button = payload.button ?? "left";
    const defaultButtons = payload.kind === "mousedown"
      ? (button === "right" ? 2 : button === "middle" ? 4 : 1)
      : 0;
    await cdp.send("Input.dispatchMouseEvent", {
      type: payload.kind === "mousedown" ? "mousePressed" : "mouseReleased",
      x: Math.round(payload.x),
      y: Math.round(payload.y),
      button,
      buttons: payload.buttons ?? defaultButtons,
      clickCount: payload.clickCount ?? 1,
      modifiers: payload.modifiers ?? 0,
    });
    return;
  }

  if (payload.kind === "text") {
    if (payload.text) {
      await cdp.send("Input.insertText", { text: payload.text });
    }
    return;
  }

  if (payload.kind !== "keydown" && payload.kind !== "keyup") return;

  const keyCode = resolveVirtualKeyCode(payload.key);
  const modifiers = payload.modifiers ?? 0;
  // 按下 Ctrl/Meta/Alt 组合键时不注入字符 text，避免 Ctrl+A 输入字母 a。
  const hasCommandMod = (modifiers & (1 | 2 | 4)) !== 0;
  const text = payload.kind === "keydown" && !hasCommandMod
    ? (payload.text ?? (payload.key.length === 1 ? payload.key : undefined))
    : undefined;
  await cdp.send("Input.dispatchKeyEvent", {
    type: payload.kind === "keydown" ? (text ? "keyDown" : "rawKeyDown") : "keyUp",
    key: payload.key,
    ...(payload.code ? { code: payload.code } : {}),
    ...(text ? { text, unmodifiedText: text } : {}),
    modifiers,
    ...(keyCode !== undefined ? { windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode } : {}),
  });
}

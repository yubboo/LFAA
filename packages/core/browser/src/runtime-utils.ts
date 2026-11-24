// 浏览器运行时公共校验、可执行路径探测与 DOM 快照提取辅助函数。
import { existsSync } from "node:fs";
import type { Page } from "playwright-core";
import type { BrowserInteractiveElement, BrowserSettingsConfig } from "./types";

/** 校验目标 URL 仅允许安全的 http(s) 地址，拦截 file://、元数据地址与危险协议。 */
export function validateBrowserUrl(rawUrl: string): { url: string; isLocalhost: boolean } {
  const trimmed = rawUrl.trim();
  if (!trimmed) throw new Error("网址不能为空。");
  const hasExplicitScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/|^(?:file|javascript|data|vbscript|about|mailto|tel):/iu.test(trimmed);
  const withScheme = hasExplicitScheme ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error(`无效的网址格式：${rawUrl}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`出于安全边界，内置浏览器仅支持 http/https 协议，已拦截：${parsed.protocol}`);
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "169.254.169.254" || host === "metadata.google.internal") {
    throw new Error(`禁止访问云元数据地址：${host}`);
  }
  const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  return { url: parsed.toString(), isLocalhost };
}

/** 查找本机可用 Edge / Chrome 可执行文件，避免下载大型二进制。 */
export function detectLocalBrowserExecutable(settings: BrowserSettingsConfig): string | undefined {
  if (settings.customExecutablePath.trim() && existsSync(settings.customExecutablePath.trim())) {
    return settings.customExecutablePath.trim();
  }
  const edgeCandidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/microsoft-edge",
  ];
  const chromeCandidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ];
  const ordered = settings.preferredChannel === "chrome"
    ? [...chromeCandidates, ...edgeCandidates]
    : [...edgeCandidates, ...chromeCandidates];
  return ordered.find((p) => existsSync(p));
}

/** 在受控页面内提取可见可交互元素与文本摘要，供小鱼 Agent 精准引用操作。 */
export async function extractPageStructure(page: Page): Promise<{
  elements: BrowserInteractiveElement[];
  textExcerpt: string;
}> {
  return page.evaluate(() => {
    const interactive = [...document.querySelectorAll("a, button, input, select, textarea, [role='button'], [role='link'], [tabindex]")];
    const elements: Array<{ ref: string; tag: string; role?: string; text: string; type?: string; placeholder?: string; href?: string }> = [];
    let idx = 0;
    for (const el of interactive) {
      if (!(el instanceof HTMLElement)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      idx += 1;
      const ref = `e${idx}`;
      el.setAttribute("data-lfaa-ref", ref);
      const text = (el.innerText || el.getAttribute("aria-label") || (el as HTMLInputElement).value || "")
        .trim()
        .replace(/\s+/gu, " ")
        .slice(0, 80);
      const item: { ref: string; tag: string; role?: string; text: string; type?: string; placeholder?: string; href?: string } = {
        ref,
        tag: el.tagName.toLowerCase(),
        text,
      };
      const role = el.getAttribute("role");
      if (role) item.role = role;
      const type = el.getAttribute("type");
      if (type) item.type = type;
      const placeholder = el.getAttribute("placeholder");
      if (placeholder) item.placeholder = placeholder;
      const href = el.getAttribute("href");
      if (href) item.href = href.slice(0, 140);
      elements.push(item);
      if (elements.length >= 60) break;
    }
    const textExcerpt = (document.body?.innerText || "").replace(/\s+/gu, " ").trim().slice(0, 3000);
    return { elements, textExcerpt };
  }).catch(() => ({ elements: [] as BrowserInteractiveElement[], textExcerpt: "" }));
}

export function clampViewport(width: number, height: number): { width: number; height: number } {
  const safeW = Number.isFinite(width) ? Math.max(320, Math.min(2560, Math.round(width))) : 1024;
  const safeH = Number.isFinite(height) ? Math.max(240, Math.min(2400, Math.round(height))) : 768;
  return { width: safeW, height: safeH };
}

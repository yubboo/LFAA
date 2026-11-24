// Agent 页面操控可视化指示层：极简无边框虚拟指针、柔和点击涟漪与轻量悬浮动作标签。
// 仅在 Agent 主动交互时注入，pointer-events: none 不干扰业务点击，空闲 1.8s 后自动淡出，视觉截图前自动隐藏。
import type { Page } from "playwright-core";

export interface AgentOverlayBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AgentOverlayAction {
  kind: "click" | "hover" | "type" | "scroll" | "key";
  x: number;
  y: number;
  label: string;
  box?: AgentOverlayBox | undefined;
}

/** 根据 ref 或 selector 获取元素在视口中的中心点与包围盒，便于将虚拟指针滑向目标。 */
export async function locateAgentTarget(
  page: Page,
  target: { ref?: string; selector?: string; x?: number; y?: number },
): Promise<{ x: number; y: number; box?: AgentOverlayBox } | null> {
  if (typeof target.x === "number" && typeof target.y === "number") {
    return { x: target.x, y: target.y };
  }
  const locator = target.ref
    ? page.locator(`[data-lfaa-ref="${target.ref}"]`).first()
    : target.selector
      ? page.locator(target.selector).first()
      : null;
  if (!locator) return null;
  try {
    await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
    const rect = await locator.boundingBox({ timeout: 1500 });
    if (!rect) return null;
    return {
      x: Math.round(rect.x + rect.width / 2),
      y: Math.round(rect.y + rect.height / 2),
      box: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  } catch {
    return null;
  }
}

/** 在受控页面内展示无目标方框边框的极简指针、柔光点击涟漪与轻量悬浮标签。 */
export async function showAgentActionOverlay(page: Page, action: AgentOverlayAction): Promise<void> {
  await page.evaluate((payload) => {
    const ROOT_ID = "__lfaa_agent_overlay__";
    const STYLE_ID = "__lfaa_agent_overlay_style__";
    const doc = document;
    if (!doc.documentElement) return;

    if (!doc.getElementById(STYLE_ID)) {
      const style = doc.createElement("style");
      style.id = STYLE_ID;
      style.textContent = [
        `#${ROOT_ID}{position:fixed;inset:0;pointer-events:none;z-index:2147483647;overflow:hidden;transition:opacity 180ms ease;}`,
        `#${ROOT_ID} .lfaa-cur{position:fixed;top:0;left:0;will-change:transform;transition:transform 140ms cubic-bezier(0.22,1,0.36,1);filter:drop-shadow(0 2px 4px rgba(15,23,42,0.28));}`,
        `#${ROOT_ID} .lfaa-tag{position:fixed;top:0;left:0;padding:3px 10px;border-radius:999px;background:rgba(15,23,42,0.78);color:#f8fafc;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font:500 11.5px/1.35 system-ui,-apple-system,sans-serif;white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 4px 12px rgba(15,23,42,0.18);transition:transform 140ms cubic-bezier(0.22,1,0.36,1);}`,
        `#${ROOT_ID} .lfaa-rip{position:fixed;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(236,72,153,0.26);animation:lfaaRipple 340ms cubic-bezier(0.16,1,0.3,1) forwards;}`,
        `@keyframes lfaaRipple{0%{transform:scale(0.35);opacity:0.9;}100%{transform:scale(2.1);opacity:0;}}`,
      ].join("");
      (doc.head || doc.documentElement).appendChild(style);
    }

    let root = doc.getElementById(ROOT_ID) as (HTMLDivElement & { __fadeTimer?: number }) | null;
    if (!root) {
      root = doc.createElement("div") as HTMLDivElement & { __fadeTimer?: number };
      root.id = ROOT_ID;
      root.innerHTML = [
        `<div class="lfaa-cur" style="transform:translate3d(${payload.x}px,${payload.y}px,0)">`,
        `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4.5 3.5L18.5 11.5L11.8 13.3L9 20L4.5 3.5Z" fill="#ffffff" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
        `</div>`,
        `<div class="lfaa-tag"></div>`,
      ].join("");
      doc.documentElement.appendChild(root);
    }
    root.style.opacity = "1";
    if (root.__fadeTimer) window.clearTimeout(root.__fadeTimer);
    root.__fadeTimer = window.setTimeout(() => {
      if (root) root.style.opacity = "0";
    }, 1800);

    const cur = root.querySelector(".lfaa-cur") as HTMLDivElement | null;
    const tag = root.querySelector(".lfaa-tag") as HTMLDivElement | null;

    const clampedX = Math.max(8, Math.min(window.innerWidth - 16, payload.x));
    const clampedY = Math.max(8, Math.min(window.innerHeight - 16, payload.y));
    if (cur) cur.style.transform = `translate3d(${clampedX}px,${clampedY}px,0)`;
    if (tag) {
      tag.textContent = payload.label;
      const tagX = clampedX + 16 > window.innerWidth - 200 ? Math.max(8, clampedX - 180) : clampedX + 16;
      const tagY = clampedY + 14 > window.innerHeight - 34 ? Math.max(8, clampedY - 26) : clampedY + 14;
      tag.style.transform = `translate3d(${tagX}px,${tagY}px,0)`;
    }

    if (payload.kind === "click") {
      const ripple = doc.createElement("div");
      ripple.className = "lfaa-rip";
      ripple.style.left = `${clampedX}px`;
      ripple.style.top = `${clampedY}px`;
      root.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 360);
    }
  }, action).catch(() => {});
}

/** 在 Agent 平滑滚动页面时以短时长流畅滚动，避免生硬瞬移跳帧。 */
export async function smoothScrollPage(page: Page, deltaX: number, deltaY: number): Promise<void> {
  await page.evaluate(({ dx, dy }) => {
    window.scrollBy({ left: dx, top: dy, behavior: "smooth" });
  }, { dx: deltaX, dy: deltaY }).catch(() => {});
  await page.waitForTimeout(160);
}

/** 视觉模型截图核查前临时隐藏指示层，避免光标遮挡页面元素。 */
export async function hideAgentActionOverlay(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.getElementById("__lfaa_agent_overlay__");
    if (root) root.style.opacity = "0";
  }).catch(() => {});
}

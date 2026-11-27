// 内置浏览器一键页面体检与诊断工具集（browser_diagnose / browser_console / browser_network）。
import type { ToolsService } from "@lfaa/tools";
import type { BrowserRuntime } from "../session/browser-service";

export interface DomDiagnoseRaw {
  viewport: { width: number; height: number };
  scroll: { width: number; height: number; overflowX: number };
  textLength: number;
  blankRisk: boolean;
  brokenImages: Array<{ src: string; alt: string; selector: string }>;
  overflowElements: Array<{ selector: string; rightOverflow: number; width: number }>;
  invisibleTextElements: Array<{ selector: string; tag: string; text: string; reason: string }>;
  occludedControls: Array<{ selector: string; text: string; coveredBy: string }>;
}

/** 纯字符串页面诊断探针（避免 tsdown/esbuild 注入 __name 辅助函数导致受控页面报 ReferenceError）。 */
export const BROWSER_DIAGNOSE_SCRIPT = `(function () {
  var vw = window.innerWidth || document.documentElement.clientWidth || 0;
  var vh = window.innerHeight || document.documentElement.clientHeight || 0;
  var sw = document.documentElement.scrollWidth || 0;
  var sh = document.documentElement.scrollHeight || 0;
  var overflowX = Math.max(0, Math.round(sw - vw));

  function describeEl(el) {
    if (!el || !el.tagName) return 'unknown';
    var tag = el.tagName.toLowerCase();
    var id = el.id ? '#' + el.id : '';
    var cls = typeof el.className === 'string'
      ? el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 2).map(function (c) { return '.' + c; }).join('')
      : '';
    return tag + id + cls;
  }

  var bodyText = (document.body && document.body.innerText ? document.body.innerText : '').trim();
  var blankRisk = bodyText.length < 10 && sh < vh * 0.5;

  var brokenImages = [];
  var imgs = document.querySelectorAll('img');
  for (var i = 0; i < imgs.length && brokenImages.length < 10; i++) {
    var img = imgs[i];
    var rect = img.getBoundingClientRect();
    if (img.complete && img.naturalWidth === 0 && (rect.width > 0 || rect.height > 0 || img.getAttribute('src'))) {
      brokenImages.push({
        src: (img.currentSrc || img.getAttribute('src') || '').slice(0, 140),
        alt: (img.getAttribute('alt') || '').slice(0, 60),
        selector: describeEl(img),
      });
    }
  }

  var overflowElements = [];
  if (overflowX > 2) {
    var all = document.querySelectorAll('body *');
    for (var j = 0; j < all.length && overflowElements.length < 8; j++) {
      var el = all[j];
      var r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.right > vw + 2) {
        overflowElements.push({
          selector: describeEl(el),
          rightOverflow: Math.round(r.right - vw),
          width: Math.round(r.width),
        });
      }
    }
  }

  var invisibleTextElements = [];
  var textNodes = document.querySelectorAll('h1,h2,h3,h4,p,a,button,span,li');
  for (var k = 0; k < textNodes.length && invisibleTextElements.length < 8; k++) {
    var node = textNodes[k];
    var txt = (node.textContent || '').trim();
    if (txt.length < 2) continue;
    var nr = node.getBoundingClientRect();
    if (nr.width < 8 || nr.height < 8 || nr.bottom < 0 || nr.top > vh) continue;
    var cs = getComputedStyle(node);
    if (cs.display === 'none') continue;
    var reason = '';
    if (cs.visibility === 'hidden') reason = 'visibility:hidden';
    else if (parseFloat(cs.opacity) === 0) reason = 'opacity:0';
    else if (cs.color === 'rgba(0, 0, 0, 0)' || cs.color === 'transparent') reason = 'color:transparent';
    if (reason) {
      invisibleTextElements.push({
        selector: describeEl(node),
        tag: node.tagName.toLowerCase(),
        text: txt.slice(0, 40),
        reason: reason,
      });
    }
  }

  var occludedControls = [];
  var controls = document.querySelectorAll('button,a[href],input,select,textarea,[role="button"]');
  for (var m = 0; m < controls.length && occludedControls.length < 6; m++) {
    var ctrl = controls[m];
    var cr = ctrl.getBoundingClientRect();
    if (cr.width < 12 || cr.height < 12 || cr.top < 0 || cr.left < 0 || cr.bottom > vh || cr.right > vw) continue;
    var ccs = getComputedStyle(ctrl);
    if (ccs.visibility === 'hidden' || parseFloat(ccs.opacity) === 0 || ccs.pointerEvents === 'none') continue;
    var cx = cr.left + cr.width / 2;
    var cy = cr.top + cr.height / 2;
    var topEl = document.elementFromPoint(cx, cy);
    if (topEl && topEl !== ctrl && !ctrl.contains(topEl) && !topEl.contains(ctrl)) {
      occludedControls.push({
        selector: describeEl(ctrl),
        text: (ctrl.textContent || ctrl.getAttribute('aria-label') || '').trim().slice(0, 30),
        coveredBy: describeEl(topEl),
      });
    }
  }

  return {
    viewport: { width: vw, height: vh },
    scroll: { width: sw, height: sh, overflowX: overflowX },
    textLength: bodyText.length,
    blankRisk: blankRisk,
    brokenImages: brokenImages,
    overflowElements: overflowElements,
    invisibleTextElements: invisibleTextElements,
    occludedControls: occludedControls,
  };
})()`;

export interface DiagnoseSummaryResult {
  issueCount: number;
  summary: string;
  report: string;
  compactForVision: string;
}

/** 汇总控制台错误、失败网络请求与 DOM 探针结果，输出供 Agent 与视觉模型直接消费的结构化体检报告。 */
export function buildDiagnoseReport(params: {
  url: string;
  title: string;
  consoleLogs: ReadonlyArray<{ level: string; text: string }>;
  networkItems: ReadonlyArray<{ method: string; url: string; status?: number; failed?: boolean; errorText?: string }>;
  dom: DomDiagnoseRaw | null;
}): DiagnoseSummaryResult {
  const { url, title, consoleLogs, networkItems, dom } = params;
  const consoleErrors = consoleLogs.filter((l) => l.level === "error" || l.level === "pageerror");
  const failedRequests = networkItems.filter((n) => n.failed || (typeof n.status === "number" && n.status >= 400));

  const lines: string[] = [];
  const compactHints: string[] = [];
  let issueCount = 0;

  if (consoleErrors.length > 0) {
    issueCount += consoleErrors.length;
    compactHints.push(`控制台错误 ${consoleErrors.length} 条`);
    lines.push(`[严重] 控制台报错 (${consoleErrors.length} 条):`);
    for (const err of consoleErrors.slice(-5)) {
      lines.push(`  - [${err.level}] ${err.text.slice(0, 220)}`);
    }
  }

  if (failedRequests.length > 0) {
    issueCount += failedRequests.length;
    compactHints.push(`失败请求 ${failedRequests.length} 条`);
    lines.push(`[严重] 网络请求失败/4xx/5xx (${failedRequests.length} 条):`);
    for (const req of failedRequests.slice(-5)) {
      const statusText = req.status !== undefined ? `HTTP ${req.status}` : (req.errorText || "FAILED");
      lines.push(`  - ${req.method} ${statusText} ${req.url.slice(0, 160)}`);
    }
  }

  if (dom) {
    if (dom.blankRisk) {
      issueCount += 1;
      compactHints.push("疑似白屏/内容缺失");
      lines.push(`[严重] 疑似白屏或空挂载：页面可见文本仅 ${dom.textLength} 字，内容高 ${dom.scroll.height}px（视口高 ${dom.viewport.height}px）。`);
    }
    if (dom.brokenImages.length > 0) {
      issueCount += dom.brokenImages.length;
      compactHints.push(`破图 ${dom.brokenImages.length} 张`);
      lines.push(`[高] 图片加载失败 (${dom.brokenImages.length} 张):`);
      for (const img of dom.brokenImages) {
        lines.push(`  - ${img.selector} src="${img.src}"${img.alt ? ` alt="${img.alt}"` : ""}`);
      }
    }
    if (dom.scroll.overflowX > 2) {
      issueCount += 1;
      compactHints.push(`横向溢出 +${dom.scroll.overflowX}px`);
      lines.push(`[高] 页面横向溢出：scrollWidth=${dom.scroll.width}px > viewport=${dom.viewport.width}px (+${dom.scroll.overflowX}px):`);
      for (const el of dom.overflowElements.slice(0, 5)) {
        lines.push(`  - ${el.selector} 超出右缘 +${el.rightOverflow}px (width=${el.width}px)`);
      }
    }
    if (dom.invisibleTextElements.length > 0) {
      issueCount += dom.invisibleTextElements.length;
      compactHints.push(`隐形/透明文字 ${dom.invisibleTextElements.length} 处`);
      lines.push(`[中] 视口内存在占据尺寸但不可见的文字元素 (${dom.invisibleTextElements.length} 处):`);
      for (const item of dom.invisibleTextElements.slice(0, 5)) {
        lines.push(`  - ${item.selector} (${item.reason}) "${item.text}"`);
      }
    }
    if (dom.occludedControls.length > 0) {
      issueCount += dom.occludedControls.length;
      compactHints.push(`控件被遮挡 ${dom.occludedControls.length} 处`);
      lines.push(`[中] 视口内可交互控件中心点被其它元素遮挡 (${dom.occludedControls.length} 处):`);
      for (const item of dom.occludedControls.slice(0, 5)) {
        lines.push(`  - ${item.selector}${item.text ? ` "${item.text}"` : ""} 被 ${item.coveredBy} 遮挡`);
      }
    }
  }

  const header = `页面诊断：${title || "未命名"} (${url})${dom ? ` · 视口 ${dom.viewport.width}×${dom.viewport.height}` : ""}`;
  if (issueCount === 0) {
    return {
      issueCount: 0,
      summary: "页面体检通过（0 异常）",
      report: `${header}\n结论：未发现控制台报错、失败请求、破图、横向溢出、隐形文字或控件遮挡。`,
      compactForVision: "DOM/控制台/网络自动体检：0 项异常。",
    };
  }

  return {
    issueCount,
    summary: `发现 ${issueCount} 项页面异常`,
    report: `${header}\n共检出 ${issueCount} 项异常：\n${lines.join("\n")}`,
    compactForVision: `DOM/控制台/网络自动体检检出 ${issueCount} 项异常（${compactHints.join("、")}）。`,
  };
}

/** 对当前活动页面执行一键体检，异常时安全降级仍输出控制台与网络结果。 */
export async function runBrowserDiagnose(runtime: BrowserRuntime, sessionId: string): Promise<DiagnoseSummaryResult> {
  const snap = await runtime.getSnapshot(sessionId);
  let dom: DomDiagnoseRaw | null = null;
  try {
    const raw = await runtime.evaluate(sessionId, BROWSER_DIAGNOSE_SCRIPT, false, true);
    if (raw && typeof raw === "object") dom = raw as DomDiagnoseRaw;
  } catch {
    dom = null;
  }
  return buildDiagnoseReport({
    url: snap.url,
    title: snap.title,
    consoleLogs: runtime.getConsole(sessionId),
    networkItems: runtime.getNetwork(sessionId),
    dom,
  });
}

/** 为 navigate/click/type 快照提取最新报错摘要，避免 Agent 忽略控制台与网络错误。 */
export function formatRecentBrowserErrors(runtime: BrowserRuntime, sessionId: string): string {
  const consoleErrors = runtime
    .getConsole(sessionId)
    .filter((l) => l.level === "error")
    .slice(-3)
    .map((l) => `[${l.level}] ${l.text.slice(0, 160)}`);
  const failedNet = runtime
    .getNetwork(sessionId)
    .filter((n) => n.failed || (typeof n.status === "number" && n.status >= 400))
    .slice(-3)
    .map((n) => `[${n.method} ${n.status ?? "FAIL"}] ${n.url.slice(0, 120)}`);
  const combined = [...consoleErrors, ...failedNet].slice(-3);
  return combined.length > 0 ? `Recent errors:\n${combined.map((line) => `- ${line}`).join("\n")}` : "";
}

/** 注册浏览器诊断类工具（一键体检、控制台日志、网络请求），供主循环与浏览器子智能体使用。 */
export function registerBrowserDiagnosticTools(tools: ToolsService, runtime: BrowserRuntime): Array<() => void> {
  return [
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_diagnose",
      title: "页面一键诊断体检",
      description: "一次扫描当前页面的控制台错误、4xx/5xx 失败请求、破图、横向溢出与撑宽元素、透明隐形文字、疑似白屏及被遮挡的可交互控件，返回结构化缺陷报告。",
      permissionLevel: "read",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const result = await runBrowserDiagnose(runtime, ctx.sessionId);
        return { ok: true, output: result.report, summary: result.summary };
      },
    }),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_console",
      title: "读取网页控制台日志",
      description: "读取内置浏览器累计捕获的 Console 错误、警告及 HTTP >= 400 失败请求。",
      permissionLevel: "read",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const logs = runtime.getConsole(ctx.sessionId);
        return {
          ok: true,
          output: logs.length > 0 ? JSON.stringify(logs.slice(-40), null, 2) : "（暂无控制台或网络异常记录）",
          summary: `共 ${logs.length} 条浏览器日志`,
        };
      },
    }),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_network",
      title: "读取网页网络请求",
      description: "读取内置浏览器近期 HTTP 请求记录、状态码与失败请求详情。",
      permissionLevel: "read",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const items = runtime.getNetwork(ctx.sessionId);
        return {
          ok: true,
          output: items.length > 0 ? JSON.stringify(items.slice(-40), null, 2) : "（暂无网络请求记录）",
          summary: `共 ${items.length} 条网络记录`,
        };
      },
    }),
  ];
}

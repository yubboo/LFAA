// 为小鱼 Agent 注册内置浏览器工具集（导航、元素快照、点击、输入、滚动、按键、截图、控制台排查）。
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { resolveSafeWorkspacePath } from "@lfaa/fs";
import type { LlmService } from "@lfaa/llm";
import type { ToolsService } from "@lfaa/tools";
import { validateBrowserUrl, type BrowserRuntime } from "../session/browser-service";
import { formatRecentBrowserErrors, registerBrowserDiagnosticTools, runBrowserDiagnose } from "./browser-diagnose";

/** 根据扩展名取图片 MIME；不支持的格式直接拒绝。 */
function imageMime(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return null;
}

/** 调当前模型做视觉理解；兼容推理型多模态模型（留足 maxTokens + low 推理档位，并兼容 reasoningContent 兜底），空响应或不支持图片时显式抛错。 */
async function visionAnswer(
  llm: LlmService,
  prompt: string,
  dataUrl: string,
  profileId?: string,
  signal?: AbortSignal,
): Promise<string> {
  const output = await llm.complete({
    ...(profileId ? { profileId } : {}),
    ...(signal ? { signal } : {}),
    messages: [{ role: "user", content: prompt, images: [dataUrl] }],
    reasoningEffort: "low",
    maxTokens: 4096,
  });
  const text = output.content.trim() || output.reasoningContent?.trim() || "";
  if (!text) {
    throw new Error("视觉模型返回空内容（当前模型可能不支持图片输入或响应被截断）");
  }
  return text;
}

const DEVICE_VIEWPORT_PRESETS: Record<string, { width: number; height: number }> = {
  "4k": { width: 2560, height: 1440 }, "laptop-l": { width: 1440, height: 900 }, laptop: { width: 1280, height: 800 },
  "surface-pro-7": { width: 912, height: 1368 }, "ipad-air": { width: 820, height: 1180 }, "ipad-mini": { width: 768, height: 1024 },
  "surface-duo": { width: 540, height: 720 }, "iphone-15-pro-max": { width: 430, height: 932 }, "pixel-8": { width: 412, height: 915 },
  "iphone-15-pro": { width: 393, height: 852 }, "galaxy-s24-ultra": { width: 412, height: 915 }, "iphone-se": { width: 375, height: 667 },
};

export function registerBrowserAgentTools(tools: ToolsService, llm: LlmService, runtime: BrowserRuntime): () => void {
  const formatSnapshotOutput = (snap: Awaited<ReturnType<BrowserRuntime["snapshot"]>>, sessionId?: string) => {
    const els = snap.elements.slice(0, 35).map((e) =>
      `[${e.ref}] <${e.tag}${e.type ? ` type=${e.type}` : ""}> ${e.text || e.placeholder || e.href || ""}`.trim(),
    );
    const recentErrors = sessionId ? formatRecentBrowserErrors(runtime, sessionId) : "";
    return [
      `URL: ${snap.url}`,
      `Title: ${snap.title}`,
      `Errors: ${snap.errorCount} (console total: ${snap.consoleCount})`,
      ...(recentErrors ? [recentErrors] : []),
      "Interactive elements:",
      els.join("\n") || "(无可见可交互元素)",
      "Text excerpt:",
      snap.textExcerpt.slice(0, 1600) || "(空页面)",
    ].join("\n");
  };

  const cleanups = [
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_present",
      title: "展示浏览器预览",
      description: "展开右侧浏览器，展示当前标签给用户查看。仅在提供了不同目标地址时导航一次。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "可选目标地址；省略时复用当前标签" } },
      },
      execute: async (args, ctx) => {
        const rawUrl = typeof args.url === "string" ? args.url.trim() : "";
        const url = rawUrl ? validateBrowserUrl(rawUrl).url : undefined;
        let snap = await runtime.getSnapshot(ctx.sessionId);
        if (url && snap.url !== url) {
          if (ctx.allowsTool?.("browser_navigate") === false) {
            return { ok: false, output: "当前会话不允许导航到其他网页。", summary: "导航受限" };
          }
          snap = await runtime.navigate(ctx.sessionId, url, true);
        }
        return {
          ok: true,
          output: snap.active && snap.url !== "about:blank" ? `已展示 ${snap.url}` : "已展开浏览器，当前没有打开的网页。",
          summary: "已展示浏览器",
        };
      },
    }),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_evaluate",
      title: "网页执行表达式",
      description: [
        "在当前内置浏览器页面上下文执行 JavaScript 表达式，返回 JSON/文本结果。",
        "用于读取 DOM、getComputedStyle、元素尺寸、动画名、滚动位置等文本快照看不到的状态；不能访问 Node 或本机文件。",
        "表达式应是一个值，例如 `({ color: getComputedStyle(document.querySelector('.x')).color })`。",
      ].join(""),
      permissionLevel: "exec",
      parameters: {
        type: "object",
        properties: {
          expression: { type: "string", description: "在页面上下文求值的 JavaScript 表达式" },
          awaitPromise: { type: "boolean", description: "表达式返回 Promise 时是否等待结果，默认 false" },
          target: { type: "string", description: "要核查的页面区域或属性" },
        },
        required: ["expression"],
      },
      execute: async (args, ctx) => {
        const expression = typeof args.expression === "string" ? args.expression : "";
        const result = await runtime.evaluate(ctx.sessionId, expression, args.awaitPromise === true, true);
        let text: string;
        try {
          text = typeof result === "string" ? result : JSON.stringify(result, null, 2) ?? String(result);
        } catch {
          text = String(result);
        }
        const output = text.length > 12_000 ? `${text.slice(0, 12_000)}\n…（结果已截断）` : text;
        return { ok: true, output, summary: `网页求值完成（${output.length} 字符）` };
      },
    }),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_navigate",
      title: "内置浏览器打开网页",
      description: "使用内置浏览器打开指定 http/https 网址并返回页面元素快照与控制台错误数。",
      permissionLevel: "write",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "目标网页地址，例如 http://127.0.0.1:5173" } },
        required: ["url"],
      },
      execute: async (args, ctx) => {
        const rawUrl = typeof args.url === "string" ? args.url : "";
        validateBrowserUrl(rawUrl);
        const snap = await runtime.navigate(ctx.sessionId, rawUrl, true);
        if (snap.downloadStarted) return { ok: true, output: "页面触发了下载。保存结果在内置浏览器的下载面板查看；如需审批，请由用户确认。", summary: "触发下载" };
        return { ok: true, output: formatSnapshotOutput(snap, ctx.sessionId), summary: `打开 ${snap.title || snap.url}` };
      },
    }),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_snapshot",
      title: "读取网页元素快照",
      description: "读取内置浏览器当前页面的文本摘要、可交互元素索引（如 e1、e2）及控制台错误计数。",
      permissionLevel: "read",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const snap = await runtime.snapshot(ctx.sessionId, false);
        const waiting = runtime.downloads.list(ctx.sessionId).some((item) => item.state === "awaiting");
        const formatted = formatSnapshotOutput(snap, ctx.sessionId);
        const output = waiting ? `有文件等待用户确认下载。\n${formatted}` : formatted;
        return { ok: true, output, summary: `快照 ${snap.elements.length} 个元素` };
      },
    }),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_click",
      title: "点击网页元素",
      description: "根据 browser_snapshot 返回的元素引用（如 e3）或 CSS 选择器点击网页元素。",
      permissionLevel: "write",
      parameters: {
        type: "object",
        properties: {
          ref: { type: "string", description: "元素引用 ID，例如 e1" },
          selector: { type: "string", description: "可选 CSS 选择器（无 ref 时使用）" },
          target: { type: "string", description: "操作记录中的控件名称，例如下载按钮" },
        },
      },
      execute: async (args, ctx) => {
        const label = typeof args.target === "string" && args.target.trim() ? args.target.trim() : undefined;
        const snap = await runtime.click(ctx.sessionId, {
          ...(typeof args.ref === "string" ? { ref: args.ref } : {}),
          ...(typeof args.selector === "string" ? { selector: args.selector } : {}),
          ...(label ? { label } : {}),
        }, true);
        return { ok: true, output: formatSnapshotOutput(snap, ctx.sessionId), summary: `点击完成 -> ${snap.url}` };
      },
    }),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_type",
      title: "网页输入文本",
      description: "向指定输入框元素填写文本，可选自动回车提交。",
      permissionLevel: "write",
      parameters: {
        type: "object",
        properties: {
          ref: { type: "string", description: "元素引用 ID，例如 e2" },
          selector: { type: "string", description: "可选 CSS 选择器" },
          text: { type: "string", description: "要输入的文本内容" },
          submit: { type: "boolean", description: "输入后是否按 Enter 提交" },
          target: { type: "string", description: "操作记录中的输入框名称" },
        },
        required: ["text"],
      },
      execute: async (args, ctx) => {
        const label = typeof args.target === "string" && args.target.trim() ? args.target.trim() : undefined;
        const snap = await runtime.typeText(ctx.sessionId, {
          ...(typeof args.ref === "string" ? { ref: args.ref } : {}),
          ...(typeof args.selector === "string" ? { selector: args.selector } : {}),
          text: typeof args.text === "string" ? args.text : "",
          submit: args.submit === true,
          ...(label ? { label } : {}),
        }, true);
        return { ok: true, output: formatSnapshotOutput(snap, ctx.sessionId), summary: "已在网页输入文本" };
      },
    }),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_scroll",
      title: "滚动网页",
      description: "平滑滚动内置浏览器当前页面（正数向下，负数向上）。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          deltaY: { type: "number", description: "纵向滚动像素量，默认 500" },
          deltaX: { type: "number", description: "可选横向滚动像素量，默认 0" },
          target: { type: "string", description: "可选：要滚动查看的区域名，例如 作品区" },
        },
      },
      execute: async (args, ctx) => {
        const deltaY = typeof args.deltaY === "number" ? args.deltaY : 500;
        const deltaX = typeof args.deltaX === "number" ? args.deltaX : 0;
        const label = typeof args.target === "string" && args.target.trim() ? args.target.trim() : undefined;
        const snap = await runtime.scroll(ctx.sessionId, deltaY, deltaX, true, false, label ? { label } : undefined);
        return { ok: true, output: formatSnapshotOutput(snap), summary: `滚动页面 ${deltaY}px` };
      },
    }),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_press_key",
      title: "网页按键",
      description: "向当前页面发送键盘按键（如 Enter、Escape、Tab、ArrowDown）。",
      permissionLevel: "write",
      parameters: {
        type: "object",
        properties: { key: { type: "string", description: "按键名，例如 Enter / Escape" } },
        required: ["key"],
      },
      execute: async (args, ctx) => {
        const key = typeof args.key === "string" ? args.key : "Enter";
        const snap = await runtime.pressKey(ctx.sessionId, key, true);
        return { ok: true, output: formatSnapshotOutput(snap, ctx.sessionId), summary: `按下 ${key}` };
      },
    }),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_set_viewport",
      title: "切换内置浏览器响应式尺寸",
      description: "调整内置浏览器视口尺寸或切换常见设备预设（如 iphone-15-pro、ipad-air、laptop、4k），用于响应式布局验收。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          device: { type: "string", description: "可选设备预设：4k / laptop-l / laptop / ipad-air / ipad-mini / iphone-15-pro-max / iphone-15-pro / pixel-8 / iphone-se" },
          width: { type: "number", description: "自定义视口宽度（像素，320–2560）" },
          height: { type: "number", description: "自定义视口高度（像素，240–2400）" },
        },
      },
      execute: async (args, ctx) => {
        const deviceKey = typeof args.device === "string" ? args.device.trim().toLowerCase() : "";
        const preset = deviceKey ? DEVICE_VIEWPORT_PRESETS[deviceKey] : undefined;
        const width = typeof args.width === "number" ? args.width : preset?.width;
        const height = typeof args.height === "number" ? args.height : preset?.height;
        if (!width || !height) {
          return { ok: false, output: "请提供有效的 width 与 height，或指定 device 预设名。", summary: "缺少视口尺寸参数" };
        }
        const snap = await runtime.setViewport(ctx.sessionId, width, height);
        return {
          ok: true,
          output: `已切换视口至 ${snap.viewport.width} × ${snap.viewport.height}${deviceKey ? ` (${deviceKey})` : ""}`,
          summary: `视口 ${snap.viewport.width}×${snap.viewport.height}`,
        };
      },
    }),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_screenshot",
      title: "截取网页画面",
      description: "截取当前内置浏览器页面作为本次操作的可查看证据。",
      permissionLevel: "read",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const snap = await runtime.snapshot(ctx.sessionId, true);
        const browserEvidenceId = runtime.saveEvidence(snap);
        if (!browserEvidenceId) return { ok: false, output: "当前截图不可用或超过预览容量。", summary: "截图不可保存" };
        return {
          ok: true,
          output: `已截图：${snap.url} (${snap.title})，视口 ${snap.viewport.width} × ${snap.viewport.height}`,
          summary: `截图 · ${snap.viewport.width} × ${snap.viewport.height}`,
          metadata: { browserEvidenceId },
        };
      },
    }),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_visual_check",
      title: "用视觉模型检查页面截图",
      description: "截取当前内置浏览器页面，按指定区域与验收项判断可见表现，回传结论和截图。视觉模型不可用时可改用浏览器测量，并注明局限。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          focus: { type: "string", description: "可选：希望重点检查的区域或问题" },
          requirements: { type: "string", description: "可选：用户原始需求或需逐条核对的验收要点" },
        },
      },
      execute: async (args, ctx) => {
        const focus = typeof args.focus === "string" ? args.focus.trim() : "";
        const requirements = typeof args.requirements === "string" ? args.requirements.trim() : "";
        if (!focus && !requirements) {
          return { ok: false, output: "请提供本轮的验收要点或明确的页面区域。", summary: "缺少验收目标" };
        }
        const snap = await runtime.snapshot(ctx.sessionId, true);
        if (!snap.screenshotBase64) {
          return { ok: false, output: "页面截图不可用，请先打开一个网页。", summary: "截图不可用" };
        }
        const mime = snap.screenshotMime ?? "image/png";
        const dataUrl = `data:${mime};base64,${snap.screenshotBase64}`;
        const browserEvidenceId = runtime.saveEvidence(snap);
        const diag = await runBrowserDiagnose(runtime, ctx.sessionId);
        const runtimeMeta = `当前页面：${snap.title || "未命名"} (${snap.url}) · 视口 ${snap.viewport.width} × ${snap.viewport.height}\n${diag.compactForVision}`;
        const prompt = [
          "结合下方自动 DOM/控制台/网络体检事实与页面截图核查问题。逐项写明区域、期望和可见现象，只有确实违背验收要点或存在可见/控制台硬伤才判定失败。",
          `自动体检事实：${diag.compactForVision}`,
          "末尾单独一行输出 VERDICT: PASS、VERDICT: NEEDS_FIX 或 VERDICT: UNVERIFIED。截图不足以确认目标时写 UNVERIFIED。",
          ...(requirements ? [`用户需求与验收要点：\n${requirements}`] : []),
          ...(focus ? [`重点检查区域：${focus}`] : []),
        ].join("\n");
        try {
          const answer = await visionAnswer(llm, prompt, dataUrl, ctx.parentProfileId, ctx.signal);
          const verdict = /^VERDICT:[ \t]*(PASS|NEEDS_FIX|UNVERIFIED)[ \t]*$/imu.exec(answer)?.[1]?.toLowerCase();
          const browserVerdict = verdict === "pass" || verdict === "needs_fix" ? verdict : "unverified";
          return {
            ok: true,
            output: `${runtimeMeta}\n\n视觉验收报告：\n${answer}`,
            summary: browserVerdict === "pass" ? "视觉项通过" : browserVerdict === "needs_fix" ? "发现不符项" : "视觉项未验证",
            metadata: { browserEvidenceId, browserVerdict },
          };
        } catch (error) {
          return {
            ok: false,
            output: `${runtimeMeta}\n\n视觉检查失败：${error instanceof Error ? error.message : String(error)}。当前模型可能不支持图片输入，请改用 browser_evaluate 读取关键元素的 getBoundingClientRect / getComputedStyle / DOM 状态并结合 browser_console 完成闭环验收。`,
            summary: "视觉模型不可用，需改用 DOM 自检",
            metadata: { browserEvidenceId, browserVerdict: "unverified" },
          };
        }
      },
    }),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "read_image",
      title: "读取并理解图片",
      description: "读取工作区图片（png/jpg/webp/gif），交给当前视觉模型描述内容与可见问题；当前模型不支持图片输入时会明确失败。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "图片路径，支持工作区相对路径或绝对路径" },
          prompt: { type: "string", description: "可选：希望模型重点回答的问题" },
        },
        required: ["path"],
      },
      execute: async (args, ctx) => {
        const rawPath = typeof args.path === "string" ? args.path.trim() : "";
        if (!rawPath) return { ok: false, output: "请提供图片路径。", summary: "缺少路径" };
        try {
          const { path: file } = await resolveSafeWorkspacePath(rawPath, ctx.workspaceRoots, {
            allowOutsideWorkspace: ctx.allowOutsideWorkspace,
          });
          const mime = imageMime(file);
          if (!mime) return { ok: false, output: "仅支持 png/jpg/jpeg/webp/gif 图片。", summary: "不支持的图片格式" };
          const buffer = await readFile(file);
          if (buffer.length > 10 * 1024 * 1024) {
            return { ok: false, output: "图片超过 10MB，无法读取。", summary: "图片过大" };
          }
          const prompt = typeof args.prompt === "string" && args.prompt.trim()
            ? args.prompt.trim()
            : "请描述这张图片的内容；如果它是界面截图，请检查布局、对齐、颜色、溢出和可见异常，只描述能看到的事实。";
          const answer = await visionAnswer(llm, prompt, `data:${mime};base64,${buffer.toString("base64")}`, ctx.parentProfileId, ctx.signal);
          return { ok: true, output: answer, summary: `已读取图片 ${basename(file)}` };
        } catch (error) {
          return {
            ok: false,
            output: `读取图片失败：${error instanceof Error ? error.message : String(error)}`,
            summary: "读取图片失败",
          };
        }
      },
    }),
    ...registerBrowserDiagnosticTools(tools, runtime),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_tabs",
      title: "管理浏览器标签页",
      description: "新建、切换、关闭或列出当前会话内置浏览器的所有真实标签页。",
      permissionLevel: "write",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", description: "list | new | activate | close" },
          url: { type: "string", description: "action=new 时可选打开网址" },
          tabId: { type: "string", description: "action=activate/close 时的目标标签 ID" },
        },
        required: ["action"],
      },
      execute: async (args, ctx) => {
        const action = typeof args.action === "string" ? args.action : "list";
        if (action === "new") {
          const snap = await runtime.createTab(ctx.sessionId, typeof args.url === "string" ? args.url : undefined, true);
          return { ok: true, output: JSON.stringify(snap.tabs, null, 2), summary: `新建标签 ${snap.activeTabId}` };
        }
        if (action === "activate" && typeof args.tabId === "string") {
          const snap = await runtime.activateTab(ctx.sessionId, args.tabId, true);
          return { ok: true, output: formatSnapshotOutput(snap), summary: `切到标签 ${snap.activeTabId}` };
        }
        if (action === "close" && typeof args.tabId === "string") {
          const snap = await runtime.closeTab(ctx.sessionId, args.tabId, true);
          return { ok: true, output: JSON.stringify(snap.tabs, null, 2), summary: `已关闭标签` };
        }
        const snap = await runtime.getSnapshot(ctx.sessionId);
        return { ok: true, output: JSON.stringify(snap.tabs, null, 2), summary: `共 ${snap.tabs.length} 个标签页` };
      },
    }),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_hover",
      title: "悬停网页元素",
      description: "将鼠标移动到指定元素或坐标，用于触发悬停菜单或提示。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          ref: { type: "string" },
          selector: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
        },
      },
      execute: async (args, ctx) => {
        const snap = await runtime.hover(ctx.sessionId, {
          ...(typeof args.ref === "string" ? { ref: args.ref } : {}),
          ...(typeof args.selector === "string" ? { selector: args.selector } : {}),
          ...(typeof args.x === "number" ? { x: args.x } : {}),
          ...(typeof args.y === "number" ? { y: args.y } : {}),
        }, true);
        return { ok: true, output: formatSnapshotOutput(snap), summary: "悬停完成" };
      },
    }),
  ];
  return () => {
    for (const off of cleanups) off();
  };
}

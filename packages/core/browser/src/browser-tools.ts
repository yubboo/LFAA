// 为小鱼 Agent 注册内置浏览器工具集（导航、元素快照、点击、输入、滚动、按键、截图、控制台排查）。
import type { ToolsService } from "@lfaa/tools";
import { validateBrowserUrl, type BrowserRuntime } from "./browser-service";

export function registerBrowserAgentTools(tools: ToolsService, runtime: BrowserRuntime): () => void {
  const formatSnapshotOutput = (snap: Awaited<ReturnType<BrowserRuntime["snapshot"]>>) => {
    const els = snap.elements.slice(0, 35).map((e) =>
      `[${e.ref}] <${e.tag}${e.type ? ` type=${e.type}` : ""}> ${e.text || e.placeholder || e.href || ""}`.trim(),
    );
    return [
      `URL: ${snap.url}`,
      `Title: ${snap.title}`,
      `Errors: ${snap.errorCount} (console total: ${snap.consoleCount})`,
      "Interactive elements:",
      els.join("\n") || "(无可见可交互元素)",
      "Text excerpt:",
      snap.textExcerpt.slice(0, 1600) || "(空页面)",
    ].join("\n");
  };

  const cleanups = [
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
        return { ok: true, output: formatSnapshotOutput(snap), summary: `打开 ${snap.title || snap.url}` };
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
        const snap = await runtime.snapshot(ctx.sessionId, true);
        return { ok: true, output: formatSnapshotOutput(snap), summary: `快照 ${snap.elements.length} 个元素` };
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
        },
      },
      execute: async (args, ctx) => {
        const snap = await runtime.click(ctx.sessionId, {
          ...(typeof args.ref === "string" ? { ref: args.ref } : {}),
          ...(typeof args.selector === "string" ? { selector: args.selector } : {}),
        }, true);
        return { ok: true, output: formatSnapshotOutput(snap), summary: `点击完成 -> ${snap.url}` };
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
        },
        required: ["text"],
      },
      execute: async (args, ctx) => {
        const snap = await runtime.typeText(ctx.sessionId, {
          ...(typeof args.ref === "string" ? { ref: args.ref } : {}),
          ...(typeof args.selector === "string" ? { selector: args.selector } : {}),
          text: typeof args.text === "string" ? args.text : "",
          submit: args.submit === true,
        }, true);
        return { ok: true, output: formatSnapshotOutput(snap), summary: "已在网页输入文本" };
      },
    }),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_scroll",
      title: "滚动网页",
      description: "纵向滚动内置浏览器当前页面（正数向下，负数向上）。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: { deltaY: { type: "number", description: "滚动像素量，默认 500" } },
      },
      execute: async (args, ctx) => {
        const deltaY = typeof args.deltaY === "number" ? args.deltaY : 500;
        const deltaX = typeof args.deltaX === "number" ? args.deltaX : 0;
        const snap = await runtime.scroll(ctx.sessionId, deltaY, deltaX, true);
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
        return { ok: true, output: formatSnapshotOutput(snap), summary: `按下 ${key}` };
      },
    }),
    tools.registerTool({
      moduleName: "@lfaa/browser",
      name: "browser_screenshot",
      title: "截取网页画面",
      description: "抓取当前内置浏览器页面截图并同步刷新右栏浏览器预览。",
      permissionLevel: "read",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const snap = await runtime.snapshot(ctx.sessionId, true);
        return {
          ok: true,
          output: `已截图并更新右栏浏览器预览：${snap.url} (${snap.title})，控制台异常数：${snap.errorCount}`,
          summary: "已更新页面截图",
        };
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
          const snap = await runtime.activateTab(ctx.sessionId, args.tabId);
          return { ok: true, output: formatSnapshotOutput(snap), summary: `切到标签 ${snap.activeTabId}` };
        }
        if (action === "close" && typeof args.tabId === "string") {
          const snap = await runtime.closeTab(ctx.sessionId, args.tabId);
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
  return () => {
    for (const off of cleanups) off();
  };
}

// 验证 @lfaa/browser 的独占驱动注册、URL 安全校验、真实本机 Edge 浏览交互与卸载清理。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { llmPlugin } from "@lfaa/llm";
import { toolsPlugin } from "@lfaa/tools";
import { browserPlugin, BrowserUseRegistry, detectLocalBrowserExecutable, validateBrowserUrl } from "../src/index";

test("BrowserUseRegistry 严格保证独占注册与卸载释放，validateBrowserUrl 拦截危险协议", () => {
  const ctx = new Context();
  const reg = new BrowserUseRegistry(ctx);
  const off = reg.register("edge-driver");
  assert.equal(reg.providerName, "edge-driver");
  assert.throws(() => reg.register("chrome-driver"), /已注册/);
  off();
  assert.equal(reg.providerName, undefined);

  assert.equal(validateBrowserUrl("127.0.0.1:5173").isLocalhost, true);
  assert.throws(() => validateBrowserUrl("file:///C:/Windows/win.ini"), /仅支持 http\/https/);
  assert.throws(() => validateBrowserUrl("http://169.254.169.254/latest"), /元数据/);
});

test("BrowserService 驱动本机浏览器打开测试页、交互、截图并收集控制台异常", async (t) => {
  const exe = detectLocalBrowserExecutable({
    preferredChannel: "auto",
    customExecutablePath: "",
    headless: true,
    autoApproveLocalhost: true,
  });
  if (!exe) {
    t.skip("本机未检测到 Edge/Chrome 可执行文件，跳过真实浏览器集成测试");
    return;
  }

  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html>
      <html><head><title>LFAA 浏览器测试页</title></head>
      <body>
        <h1 id="heading">初始状态</h1>
        <button id="btn" onclick="document.getElementById('heading').textContent='已点击'; console.error('test-console-err');">点我触发</button>
      </body></html>`);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-browser-test-"));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));

  const ctx = new Context();
  await ctx.plugin(toolsPlugin);
  // 浏览器工具里的截图问答依赖 LlmService；这里只装载不调用，无需真实 provider。
  await ctx.plugin(llmPlugin);
  const fiber = ctx.plugin(browserPlugin, { storeFilePath: path.join(tempDir, "browser.json") });
  t.after(() => fiber.dispose());
  await fiber;

  const execCtx = {
    workspaceRoots: [tempDir],
    sessionId: "sess-b1",
    runId: "run-b1",
    signal: new AbortController().signal,
  };

  const nav = await ctx.tools.executeTool("browser_navigate", { url: `http://127.0.0.1:${port}/` }, execCtx);
  assert.equal(nav.ok, true);
  assert.ok(nav.output.includes("LFAA 浏览器测试页"));
  assert.ok(nav.output.includes("[e1]"));

  const clickRes = await ctx.tools.executeTool("browser_click", { ref: "e1" }, execCtx);
  assert.equal(clickRes.ok, true);
  assert.ok(clickRes.output.includes("已点击"));

  const logsRes = await ctx.tools.executeTool("browser_console", {}, execCtx);
  assert.equal(logsRes.ok, true);
  assert.ok(logsRes.output.includes("test-console-err"));

  const evalRes = await ctx.tools.executeTool("browser_evaluate", {
    expression: "({ title: document.title, heading: document.getElementById('heading')?.textContent, color: getComputedStyle(document.getElementById('heading')).color })",
  }, execCtx);
  assert.equal(evalRes.ok, true);
  assert.match(evalRes.output, /已点击/u);
  assert.match(evalRes.output, /LFAA 浏览器测试页/u);
  assert.match(evalRes.output, /color/u);

  const netRes = await ctx.tools.executeTool("browser_network", {}, execCtx);
  assert.equal(netRes.ok, true);
  assert.ok(netRes.output.includes(`http://127.0.0.1:${port}/`));

  const tabNew = await ctx.tools.executeTool("browser_tabs", { action: "new", url: `http://127.0.0.1:${port}/` }, execCtx);
  assert.equal(tabNew.ok, true);
  const parsedTabs = JSON.parse(tabNew.output) as Array<{ tabId: string }>;
  assert.equal(parsedTabs.length, 2);
  const resized = await ctx.browser.setViewport("sess-b1", 900, 720, { deviceScaleFactor: 2, colorScheme: "light" });
  assert.deepEqual(resized.viewport, { width: 900, height: 720 });
  assert.equal(resized.deviceScaleFactor, 2);
  assert.equal(resized.colorScheme, "light");

  // 人工快速操作路径：跳过结构扫描且支持 CDP Screencast 推流
  let streamFrameCount = 0;
  const offStream = ctx.browser.subscribeStream("sess-b1", (frame) => {
    if (frame.data.length > 0) streamFrameCount += 1;
  }, { deviceScaleFactor: 2, colorScheme: "dark" });
  const fastClick = await ctx.browser.click("sess-b1", { selector: "#btn" }, true);
  assert.equal(fastClick.elements.length, 0);
  await ctx.browser.scroll("sess-b1", 120, 0, true);
  await new Promise((r) => setTimeout(r, 250));
  offStream();
  assert.ok(streamFrameCount >= 1);

  await ctx.tools.executeTool("browser_tabs", { action: "close", tabId: parsedTabs[1]!.tabId }, execCtx);

  // 开启人工接管暂停后，Agent 调用会被礼貌阻断直到恢复
  ctx.browser.setTakeover("sess-b1", true);
  const blocked = await ctx.tools.executeTool("browser_click", { ref: "e1" }, execCtx);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.output.includes("人工接管"));

  await fiber.dispose();
  assert.equal((ctx as { browser?: unknown }).browser, undefined);
  assert.equal(ctx.tools.getTool("browser_navigate"), undefined);
});

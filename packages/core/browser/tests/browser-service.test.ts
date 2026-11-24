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
import { isHeadersEmbeddable } from "../src/session/browser-tabs";
import { resolveVirtualKeyCode } from "../src/session/cdp-input";

/** 从 JPEG 二进制流提取 SOF0/SOF2 帧宽度，用于验证 2x Retina 物理像素分辨率。 */
function readJpegWidth(buf: Buffer): number {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return 0;
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1]!;
    if (marker === 0xc0 || marker === 0xc2) {
      return buf.readUInt16BE(offset + 7);
    }
    const segLen = buf.readUInt16BE(offset + 2);
    if (segLen < 2) break;
    offset += 2 + segLen;
  }
  return 0;
}

test("isHeadersEmbeddable 准确识别 X-Frame-Options 与 CSP frame-ancestors，resolveVirtualKeyCode 映射常用键码", () => {
  assert.equal(isHeadersEmbeddable({}), true);
  assert.equal(isHeadersEmbeddable({ "x-frame-options": "DENY" }), false);
  assert.equal(isHeadersEmbeddable({ "x-frame-options": "sameorigin" }), false);
  assert.equal(isHeadersEmbeddable({ "content-security-policy": "default-src 'self'; frame-ancestors 'none'" }), false);
  assert.equal(isHeadersEmbeddable({ "content-security-policy": "frame-ancestors 'self' https://example.com" }), false);
  assert.equal(isHeadersEmbeddable({ "content-security-policy": "frame-ancestors *" }), true);

  assert.equal(resolveVirtualKeyCode("Enter"), 13);
  assert.equal(resolveVirtualKeyCode("Backspace"), 8);
  assert.equal(resolveVirtualKeyCode("a"), 65);
  assert.equal(resolveVirtualKeyCode("9"), 57);
  assert.equal(resolveVirtualKeyCode("ArrowDown"), 40);
});

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

  const server = createServer((req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (req.url === "/blocked") {
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
    }
    res.end(`<!doctype html>
      <html><head><title>LFAA 浏览器测试页</title></head>
      <body style="height:2200px">
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
  // 浏览器工具里的视觉检查依赖 LlmService；这里用隔离目录与自定义适配器，验证 reasoningContent 兜底与无视觉降级。
  let visionCallCount = 0;
  let lastVisionInput: { maxTokens?: number; reasoningEffort?: string; profileId?: string } | undefined;
  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempDir, "llm.json"),
    adapter: async (profile, input) => {
      visionCallCount += 1;
      lastVisionInput = {
        ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
        ...(input.reasoningEffort !== undefined ? { reasoningEffort: input.reasoningEffort } : {}),
        ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
      };
      if (visionCallCount === 1) {
        // 模拟推理型多模态模型只在 reasoningContent 输出分析时的兜底兼容。
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          reasoningContent: "VERDICT: NEEDS_FIX\n1. 按钮对齐略有偏差，建议微调。",
          toolCalls: [],
          finishReason: "stop",
        };
      }
      throw new Error("image_url is not supported by this text-only model");
    },
  });
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

  const currentUrl = `http://127.0.0.1:${port}/`;
  const preview = await ctx.tools.executeTool("browser_present", { url: currentUrl }, execCtx);
  assert.equal(preview.ok, true);
  const unchanged = await ctx.tools.executeTool("browser_snapshot", {}, execCtx);
  assert.match(unchanged.output, /已点击/u);
  const noGoal = await ctx.tools.executeTool("browser_visual_check", {}, execCtx);
  assert.equal(noGoal.ok, false);
  assert.equal(visionCallCount, 0);

  const logsRes = await ctx.tools.executeTool("browser_console", {}, execCtx);
  assert.equal(logsRes.ok, true);
  assert.ok(logsRes.output.includes("test-console-err"));
  // 回归校验：初始化脚本必须为纯字符串 JS，严禁被构建器注入 __name 而在客体页抛 ReferenceError。
  assert.equal(logsRes.output.includes("__name"), false);

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

  // 恒定 2x Retina JPEG 推流 + 控制权隔离：未接管时忽略人工 dispatchInput，接管后放行并通知 Agent。
  const snapAfterNav = await ctx.browser.getSnapshot("sess-b1");
  assert.equal(snapAfterNav.embeddable, true);
  assert.equal(snapAfterNav.lastActor, "agent");
  assert.equal(ctx.browser.describeTakeoverHint("sess-b1"), "");

  let streamFrameCount = 0;
  let crispFrameWidth = 0;
  const offStream = ctx.browser.subscribeStream("sess-b1", (frame) => {
    if (frame.data.length > 0) streamFrameCount += 1;
    if (frame.mime === "image/jpeg") {
      const w = readJpegWidth(Buffer.from(frame.data, "base64"));
      if (w > 0) crispFrameWidth = w;
    } else if (frame.mime === "image/png") {
      const buf = Buffer.from(frame.data, "base64");
      if (buf.length >= 24) crispFrameWidth = buf.readUInt32BE(16);
    }
  }, { deviceScaleFactor: 2, colorScheme: "dark" });

  // 未接管态下人工键鼠直通被忽略，保护 Agent 控制权。
  await ctx.browser.dispatchInput("sess-b1", { kind: "wheel", x: 120, y: 120, deltaX: 0, deltaY: 260 });
  assert.equal((await ctx.browser.getSnapshot("sess-b1")).lastActor, "agent");

  const fastClick = await ctx.browser.click("sess-b1", { selector: "#btn" }, true);
  assert.equal(fastClick.elements.length, 0);
  for (let i = 0; i < 20 && crispFrameWidth === 0; i += 1) {
    await new Promise((r) => setTimeout(r, 80));
  }
  // 开启人工接管：Agent 立刻收到接管提示，且人工键鼠直通生效。
  ctx.browser.setTakeover("sess-b1", true);
  assert.match(ctx.browser.describeTakeoverHint("sess-b1"), /接管/u);
  await ctx.browser.dispatchInput("sess-b1", { kind: "wheel", x: 120, y: 120, deltaX: 0, deltaY: 260 });
  await ctx.browser.dispatchInput("sess-b1", { kind: "mousemove", x: 60, y: 60 });
  await ctx.browser.dispatchInput("sess-b1", { kind: "keydown", key: "ArrowDown", code: "ArrowDown" });
  await ctx.browser.dispatchInput("sess-b1", { kind: "keyup", key: "ArrowDown", code: "ArrowDown" });
  offStream();
  assert.ok(streamFrameCount >= 1);
  // 视口宽 900 × 2x Retina = 1800 物理像素，验证原生 Screencast 恒定 2x 清晰度且流畅推流。
  assert.equal(crispFrameWidth, 1800);

  const afterUserInput = await ctx.browser.getSnapshot("sess-b1");
  assert.equal(afterUserInput.lastActor, "user");

  // 交还 Agent 后恢复自动化导航并验证 X-Frame-Options 探测与视觉验收无多模态降级提示。
  ctx.browser.setTakeover("sess-b1", false);
  assert.equal(ctx.browser.describeTakeoverHint("sess-b1"), "");
  const visualOk = await ctx.tools.executeTool("browser_visual_check", {
    focus: "检查标题与按钮状态",
    requirements: "标题必须显示已点击且控制台无未捕获错误",
  }, { ...execCtx, parentProfileId: "deepseek-chat" });
  assert.equal(visualOk.ok, true);
  assert.match(visualOk.output, /NEEDS_FIX/u);
  assert.equal(visualOk.metadata?.browserVerdict, "needs_fix");
  const evidenceId = visualOk.metadata?.browserEvidenceId;
  assert.equal(typeof evidenceId, "string");
  assert.equal(ctx.browser.getEvidence(execCtx.sessionId, String(evidenceId))?.mime, "image/png");
  assert.equal(ctx.browser.getEvidence("another-session", String(evidenceId)), undefined);
  assert.equal(lastVisionInput?.maxTokens, 4096);
  assert.equal(lastVisionInput?.reasoningEffort, "low");
  assert.equal(lastVisionInput?.profileId, "deepseek-chat");

  const visualFallback = await ctx.tools.executeTool("browser_visual_check", {
    focus: "检查标题与按钮状态",
    requirements: "标题必须显示已点击且控制台无未捕获错误",
  }, execCtx);
  assert.equal(visualFallback.ok, false);
  assert.equal(visualFallback.metadata?.browserVerdict, "unverified");
  assert.match(visualFallback.output, /browser_evaluate/u);
  const blockedSnap = await ctx.browser.navigate("sess-b1", `http://127.0.0.1:${port}/blocked`);
  assert.equal(blockedSnap.embeddable, false);

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

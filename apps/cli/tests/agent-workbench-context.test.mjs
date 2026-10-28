/**
 * 功能：验证 Agent Run 接收的当前工作台面板提示受限、临时且可脱敏。
 * 作用：覆盖 Client 裁剪、严格 API 合同及 Agent Loop 提示生成，不连接真实 Provider。
 * 关联文件：ui-workspace/agent-workbench-view.ts、api/remotes/route-contracts.ts、agent-loop/workbench-context.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";

const { createAgentWorkbenchView } = await import("lfaa-client-ui-workspace/src/agent-workbench-view.ts");
const { formatAgentWorkbenchContext } = await import("lfaa-agent-loop/src/workbench-context.js");
const { aiChatMessageSchema } = await import("lfaa-api-remotes/src/route-contracts.js");

test("Client 只在已打开的 Browser Dock 且设置启用时传安全页面位置", () => {
  const base = { rightPane: "browser", rightPaneOpen: true, bottomTerminalOpen: false };
  const enabled = createAgentWorkbenchView({ ...base, browserUseEnabled: true, activeBrowserUrl: "https://user:secret@example.com/docs/start?token=private#section" });
  assert.equal(enabled.browserUrl, "https://example.com/docs/start");

  const disabled = createAgentWorkbenchView({ ...base, browserUseEnabled: false, activeBrowserUrl: "https://example.com/docs/start?token=private" });
  assert.equal("browserUrl" in disabled, false);
  const collapsed = createAgentWorkbenchView({ ...base, rightPaneOpen: false, browserUseEnabled: true, activeBrowserUrl: "https://example.com/docs/start" });
  assert.equal("browserUrl" in collapsed, false);
  const nonBrowser = createAgentWorkbenchView({ ...base, rightPane: "git", browserUseEnabled: true, activeBrowserUrl: "https://example.com/docs/start" });
  assert.equal("browserUrl" in nonBrowser, false);
});

test("API 只接受已登记面板和条件匹配的 HTTP(S) 浏览器地址", () => {
  const message = { appId: "workspace", sessionId: null, content: "查看当前页面" };
  const valid = { rightPane: "browser", rightPaneOpen: true, bottomTerminalOpen: true, browserUrl: "https://example.com/docs" };
  assert.equal(aiChatMessageSchema.validate({ ...message, workspaceView: valid }).error, undefined);
  assert.ok(aiChatMessageSchema.validate({ ...message, workspaceView: { ...valid, extra: true } }).error);
  assert.ok(aiChatMessageSchema.validate({ ...message, workspaceView: { ...valid, browserUrl: "ftp://example.com" } }).error);
  assert.ok(aiChatMessageSchema.validate({ ...message, workspaceView: { ...valid, rightPane: "git" } }).error);
  assert.ok(aiChatMessageSchema.validate({ ...message, workspaceView: { ...valid, rightPaneOpen: false } }).error);
  assert.equal(aiChatMessageSchema.validate({ ...message, workspaceView: { rightPane: "project-file", rightPaneOpen: true, bottomTerminalOpen: false } }).error, undefined);
});

test("Agent Loop 将受限 JSON 作为界面提示，不把它当能力或权限", () => {
  const view = { rightPane: "browser", rightPaneOpen: true, bottomTerminalOpen: false, browserUrl: "https://user:secret@example.com/page?token=private#hash" };
  const enabled = formatAgentWorkbenchContext(view, true);
  assert.ok(enabled?.includes('"rightPane":"browser"'));
  assert.ok(enabled?.includes('"browserUrl":"https://example.com/page"'));
  assert.ok(!enabled.includes("secret"));
  assert.ok(!enabled.includes("private"));
  assert.ok(!enabled.includes("hash"));
  assert.ok(enabled.includes("不代表工具可用或授权"));

  const disabled = formatAgentWorkbenchContext(view, false);
  assert.ok(disabled);
  assert.ok(!disabled.includes("browserUrl"));
  assert.ok(formatAgentWorkbenchContext({ ...view, rightPane: "project-file" }, true)?.includes('"rightPane":"project-file"'));
  assert.equal(formatAgentWorkbenchContext({ ...view, rightPane: "not-a-pane" }, true), undefined);
});

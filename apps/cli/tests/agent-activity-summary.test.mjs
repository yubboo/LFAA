/**
 * 功能：核对电脑操控活动记录展示真实动作类型与安全回执。
 * 作用：防止摘要把动作请求说成已验证结果，也确保截图和输入正文不进入记录。
 * 关联文件：packages/core/agent-loop/src/execute-turn.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { computerUseActivitySummary, computerUseActivityTitle } from "../../../packages/core/agent-loop/src/computer-use-activity.ts";
import { projectFileActivityInvocation } from "../../../packages/core/agent-loop/src/project-file-activity.ts";
import { terminalActivityInvocationSummary, terminalActivityResultSummary, terminalActivityTitle } from "../../../packages/core/agent-loop/src/terminal-activity.ts";

test("电脑操控活动按真实工具类型命名", () => {
  assert.equal(computerUseActivityTitle("computer-use.observe"), "观察本机桌面");
  assert.equal(computerUseActivityTitle("computer-use.click"), "点击桌面坐标");
  assert.equal(computerUseActivityTitle("computer-use.type-text"), "向目标窗口输入文本");
  assert.equal(computerUseActivityTitle("computer-use.hotkey"), "向目标窗口发送快捷键");
  assert.equal(computerUseActivityTitle("computer-use.scroll"), "滚动桌面位置");
});

test("屏幕观察记录确认图像只临时交给模型，不能冒充已持久化证据", () => {
  const summary = computerUseActivitySummary({ images: [{ mimeType: "image/png", dataBase64: "SENSITIVE_SCREEN_BYTES" }], windows: [], screenshotForwarded: true, screenshotPersisted: false }, "computer-use.observe");
  assert.match(summary, /截图未保存/u);
  assert.match(summary, /临时交给本轮模型/u);
  assert.match(summary, /实际观察/u);
  assert.doesNotMatch(summary, /已经看到|结果为|SENSITIVE_SCREEN_BYTES/u);
  assert.match(computerUseActivitySummary({ observed: false, screenshotForwarded: false }, "computer-use.observe"), /不能据此确认屏幕状态/u);
});

test("桌面动作摘要显示安全回执与目标，但不保留用户输入内容", () => {
  const sensitiveInput = "private-user-text";
  const typed = computerUseActivitySummary({ isError: false }, "computer-use.type-text", { text: sensitiveInput, pid: 42, windowId: "1001" });
  assert.match(typed, /窗口 1001（进程 42）/u);
  assert.match(typed, /正文未保存/u);
  assert.match(typed, /是否输入成功/u);
  assert.doesNotMatch(typed, /已向.*发送输入/u);
  assert.doesNotMatch(typed, new RegExp(sensitiveInput, "u"));

  const click = computerUseActivitySummary({ effect: "unverifiable", verificationRequired: true }, "computer-use.click", { x: 1150, y: 500, button: "right", count: 2 });
  assert.match(click, /坐标 \(1150, 500\).*右键双击/u);
  assert.match(click, /驱动未能确认是否执行/u);
  assert.match(click, /仍需后续观察核实/u);
  assert.doesNotMatch(click, /点击成功/u);

  const scroll = computerUseActivitySummary({ isError: false }, "computer-use.scroll", { x: 80, y: 90, direction: "down", amount: 2 });
  assert.match(scroll, /坐标 \(80, 90\).*向下滚动 2 格/u);
  assert.match(scroll, /是否生效/u);

  const failed = computerUseActivitySummary({ isError: true, errorCode: "WINDOW_NOT_FOUND", text: sensitiveInput }, "computer-use.hotkey", { keys: ["ALT", "F4"], pid: 42, windowId: "1001" });
  assert.match(failed, /操作失败（WINDOW_NOT_FOUND）/u);
  assert.doesNotMatch(failed, new RegExp(sensitiveInput, "u"));
});

test("持久终端活动按真实阶段记录，脱敏命令且不复制输出正文", () => {
  assert.equal(terminalActivityTitle({ action: "create" }), "创建本机终端会话");
  assert.equal(terminalActivityTitle({ action: "send" }), "运行本机终端命令");
  assert.equal(terminalActivityTitle({ action: "read" }), "读取本机终端输出");
  assert.equal(terminalActivityTitle({ action: "close" }), "关闭本机终端会话");

  const command = 'Invoke-RestMethod -Headers @{ Authorization = "Bearer terminal-secret-value" } --api-key="sk-test-12345678901234567890"';
  const invocation = terminalActivityInvocationSummary({ action: "send", input: command, submit: true });
  assert.match(invocation, /向本机终端提交命令/u);
  assert.match(invocation, /Invoke-RestMethod/u);
  assert.doesNotMatch(invocation, /terminal-secret-value|sk-test-12345678901234567890/u);
  assert.match(terminalActivityInvocationSummary({ action: "read" }), /不保存输出正文/u);

  assert.match(terminalActivityResultSummary({ sessionId: "session-1" }, { action: "create" }), /会话已创建/u);
  assert.match(terminalActivityResultSummary({ sent: true, submitted: true }, { action: "send" }), /仍需通过读取终端回执核验/u);
  const output = "敏感终端输出正文";
  const readSummary = terminalActivityResultSummary({ output }, { action: "read" });
  assert.match(readSummary, /8 个字符/u);
  assert.doesNotMatch(readSummary, /敏感终端输出正文/u);
  assert.match(terminalActivityResultSummary({ sent: true, submitted: false }, { action: "send" }), /尚不能据此认定命令已运行/u);
  assert.match(terminalActivityResultSummary({ closed: true }, { action: "close" }), /会话已关闭/u);
  assert.equal(terminalActivityResultSummary({ output }, { action: "unknown" }), null);
});

test("项目文件活动显示具体操作和安全的相对路径", () => {
  assert.deepEqual(projectFileActivityInvocation({ operation: "read", path: "src/agent.ts", rootDirectory: "D:/private/workspace" }), {
    title: "读取项目文件",
    detail: "读取项目文件：src/agent.ts"
  });
  assert.deepEqual(projectFileActivityInvocation({ operation: "list", path: "" }), {
    title: "列出项目文件",
    detail: "列出项目文件：项目根目录"
  });
  assert.deepEqual(projectFileActivityInvocation({ operation: "write", path: "../secrets.env", rootDirectory: "D:/private/workspace" }), {
    title: "修改项目文件",
    detail: "修改项目文件（目标路径未纳入活动摘要）"
  });
  assert.equal(projectFileActivityInvocation({ operation: "read", path: "D:\\private\\secret.ts" }).detail, "读取项目文件（目标路径未纳入活动摘要）");
  assert.equal(projectFileActivityInvocation({ operation: "unknown", path: "src/agent.ts" }), null);
});

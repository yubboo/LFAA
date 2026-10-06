/** 功能：使用隔离 CUA Driver 替身验证本机电脑操控的 Profile、账户与单次 Agent Run 边界。 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";

let registerComputerUseTools;
let listAiBusinessTools;
let registerAiBusinessTool;
let listRegisteredAiTools;
let getUserSettings;
let saveUserSettings;
let computerControlSettingsSchema;
let storedToolArguments;
let persistedModelMessages;
let persistedComputerToolResult;
let computerObservationContent;
let releaseOlderComputerImages;

function fakeDriverModule(driver) {
  const ctor = { new: value => value };
  return {
    CuaDriver: { create: async () => driver },
    GetDesktopStateInput: ctor,
    ActionTarget: { Desktop: ctor },
    ClickPosition: { Coordinates: ctor },
    ClickInput: ctor,
    TypeTextInput: ctor,
    HotkeyInput: ctor,
    ScrollInput: ctor,
    ClickButton: { Left: "left", Right: "right", Middle: "middle" },
    InputDeliveryMode: { Foreground: "foreground" },
    ScrollDirection: { Up: "up", Down: "down", Left: "left", Right: "right" }
  };
}

function makeHarness(module, enabled, profile = "desktop") {
  const tools = new Map();
  const cleanups = [];
  const ctx = {
    lfaaTools: { registerTool: registerAiBusinessTool },
    effect(callback) {
      const cleanup = callback();
      if (typeof cleanup === "function") cleanups.push(cleanup);
      return cleanup;
    }
  };
  registerComputerUseTools(ctx, { name: profile }, module, {
    platform: "win32",
    desktopMode: true,
    isEnabledForUser: enabled
  });
  for (const tool of listRegisteredAiTools()) if (tool.id.startsWith("computer-use.")) tools.set(tool.name, tool);
  return { tools, cleanups };
}

function runContext(agentRunId, userId = "user-a", cleanupSet = new Set()) {
  return {
    userId,
    userRole: "admin",
    applicationId: "workspace",
    agentRunId,
    onRunDispose: cleanup => cleanupSet.add(cleanup),
    signal: new AbortController().signal,
    onProgress() {}
  };
}

test("电脑操控受 desktop Profile、账户开关、逐轮观察和隔离 Driver 生命周期约束", async () => {
  const repo = resolve(process.cwd(), "../..");
  const testRoot = resolve(repo, "dist/.tmp");
  mkdirSync(testRoot, { recursive: true });
  const dataDirectory = mkdtempSync(join(testRoot, "computer-use-test-"));
  const oldEnvironment = Object.fromEntries(["LFAA_DATA_DIR", "NODE_ENV", "JWT_SECRET"].map(name => [name, process.env[name]]));
  process.env.LFAA_DATA_DIR = dataDirectory;
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "";
  try {
  ({ registerComputerUseTools } = await import("lfaa-computer-use/src/index.js"));
  ({ listAiBusinessTools } = await import("lfaa-tools/src/business-tools.js"));
  ({ registerAiBusinessTool, listRegisteredAiTools } = await import("lfaa-tools/src/registry.js"));
  ({ getUserSettings, saveUserSettings } = await import("lfaa-settings/src/service.js"));
  ({ computerControlSettingsSchema } = await import("lfaa-api-remotes/src/route-contracts.js"));
  ({ storedToolArguments, persistedModelMessages, persistedComputerToolResult, computerObservationContent, releaseOlderComputerImages } = await import("lfaa-agent-loop/src/execute-turn.js"));
  const { database } = await import("lfaa-storage-sqlite/src/database.js");
  database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('computer-a',1,'computer-a','salt','hash','admin',1),('computer-b',2,'computer-b','salt','hash','member',0)").run();
  assert.equal(getUserSettings("computer-a").computerControl.enabled, false, "new accounts default to disabled");
  saveUserSettings("computer-a", "computer-control", { enabled: true });
  assert.equal(getUserSettings("computer-a").computerControl.enabled, true, "the account setting is persisted by its Owner");
  assert.equal(getUserSettings("computer-b").computerControl.enabled, false, "another account retains its own disabled default");
  assert.equal(computerControlSettingsSchema.validate({ enabled: true }).error, undefined);
  assert.ok(computerControlSettingsSchema.validate({ enabled: true, extra: "not allowed" }).error, "the API rejects unknown setting fields");
  const providerObservation = computerObservationContent({ images: [{ mimeType: "image/png", dataBase64: "U0VDUkVU" }] });
  assert.equal(JSON.stringify(providerObservation).includes("U0VDUkVU"), true, "the Provider receives a standard image input");
  const userImage = { role: "user", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,VVNFUg==" } }] };
  const transientHistory = [{ role: "tool", content: providerObservation }, userImage];
  releaseOlderComputerImages(transientHistory);
  assert.equal(Array.isArray(transientHistory[0].content), false, "a fresh screenshot releases earlier desktop images from Run memory");
  assert.equal(Array.isArray(userImage.content), true, "user-provided images are preserved");
  transientHistory.push({ role: "tool", content: providerObservation });
  assert.equal(transientHistory.filter(message => message.role === "tool" && Array.isArray(message.content)).length, 1, "only the latest desktop image remains in Run memory");
  const persistedObservation = persistedModelMessages([{ role: "tool", content: providerObservation }]);
  assert.equal(JSON.stringify(persistedObservation).includes("U0VDUkVU"), false, "image bytes are removed from stored model history");
  assert.equal(JSON.stringify(persistedObservation).includes("本机屏幕截图未保存"), true);
  assert.equal(storedToolArguments("computer_use_type_text", JSON.stringify({ text: "private text" })).includes("private text"), false);
  assert.equal(persistedComputerToolResult("computer_use_observe", JSON.stringify({ image: "U0VDUkVU" })).includes("U0VDUkVU"), false);
  const forbiddenDriver = { isAvailable: () => true, shutdown() {}, getDesktopState() { throw new Error("不应读取桌面"); } };
  const web = makeHarness(fakeDriverModule(forbiddenDriver), () => true, "web");
  assert.equal(web.tools.size, 0, "web profile must not register computer-use tools");
  assert.equal(web.cleanups.length, 0);

  const deniedCalls = { create: 0 };
  const disabled = makeHarness(fakeDriverModule({
    isAvailable: () => true,
    async getDesktopState() { throw new Error("disabled account must not observe"); },
    async shutdown() {}
  }), () => false);
  assert.equal(disabled.tools.size, 5);
  assert.equal(listAiBusinessTools("workspace", "admin", null, "ask", false, false, false).some(tool => tool.id.startsWith("computer-use.")), false);
  assert.equal(listAiBusinessTools("workspace", "admin", null, "ask", false, false, true).filter(tool => tool.id.startsWith("computer-use.")).length, 5);
  await assert.rejects(disabled.tools.get("computer_use_observe").execute({}, runContext("disabled-run")), /设置中心启用/u);
  for (const cleanup of [...disabled.cleanups].reverse()) if (typeof cleanup === "function") await cleanup();

  const calls = { create: 0, observations: 0, clicks: [], typed: [], hotkeys: [], scrolls: [], shutdown: 0, destroyed: 0 };
  let releaseClick;
  let clickGate = null;
  const driver = {
    isAvailable: () => true,
    async getDesktopState(input) {
      calls.observations += 1;
      assert.equal(input.maxImageDimension, 1280);
      return { text: "screen text is never copied into the tool result", images: [{ mimeType: "image/png", dataBase64: "AAAA" }], isError: false };
    },
    async click(input) {
      calls.clicks.push(input);
      if (clickGate) await new Promise(resolve => { releaseClick = resolve; });
      return { effect: 0, summary: "mock click", error: null };
    },
    async typeText(input) { calls.typed.push(input); return { text: "mock typed result", isError: false }; },
    async hotkey(input) { calls.hotkeys.push(input); return { text: "mock hotkey result", isError: false }; },
    async scroll(input) { calls.scrolls.push(input); return { text: "mock scroll result", isError: false }; },
    async shutdown() { calls.shutdown += 1; },
    uniffiDestroy() { calls.destroyed += 1; }
  };
  const real = makeHarness({ ...fakeDriverModule(driver), CuaDriver: { create: async () => { calls.create += 1; return driver; } } }, () => true);
  assert.deepEqual([...real.tools.keys()].sort(), ["computer_use_click", "computer_use_hotkey", "computer_use_observe", "computer_use_scroll", "computer_use_type_text"]);
  assert.equal(calls.create, 0, "driver creation is lazy until a real tool call");
  assert.equal(real.tools.get("computer_use_observe").risk({}), "read");
  for (const name of ["computer_use_click", "computer_use_hotkey", "computer_use_scroll", "computer_use_type_text"]) {
    assert.equal(real.tools.get(name).risk({}), "dangerous");
  }

  const cleanupA = new Set();
  const runA = runContext("run-a", "user-a", cleanupA);
  const observed = await real.tools.get("computer_use_observe").execute({}, runA);
  assert.equal(observed.images[0].dataBase64, "AAAA");
  assert.equal("text" in observed, false, "desktop OCR text is not returned from the observation tool");
  const click = real.tools.get("computer_use_click");
  const clickParams = click.parse({ x: 25, y: 50 });
  assert.equal(click.approval(clickParams, runA).summary, "点击屏幕坐标 (25, 50)");
  assert.equal((await click.execute(clickParams, runA)).effect, "confirmed");
  await assert.rejects(click.execute(clickParams, runA), /先观察/u);

  const runB = runContext("run-b", "user-b");
  await real.tools.get("computer_use_observe").execute({}, runB);
  await click.execute(clickParams, runB);
  await assert.rejects(click.execute(clickParams, runA), /其他桌面操作改变/u);

  await real.tools.get("computer_use_observe").execute({}, runA);
  const typed = real.tools.get("computer_use_type_text");
  const typedParams = typed.parse({ text: "non-sensitive mock text" });
  assert.equal(typed.approval(typedParams, runA).summary.includes("non-sensitive mock text"), false);
  await typed.execute(typedParams, runA);
  await real.tools.get("computer_use_observe").execute({}, runA);
  await real.tools.get("computer_use_hotkey").execute(real.tools.get("computer_use_hotkey").parse({ keys: ["CTRL", "S"] }), runA);
  await real.tools.get("computer_use_observe").execute({}, runA);
  await real.tools.get("computer_use_scroll").execute(real.tools.get("computer_use_scroll").parse({ x: 10, y: 20, direction: "down" }), runA);
  assert.equal(calls.observations, 5);
  assert.equal(calls.clicks.length, 2);
  assert.equal(calls.typed.length, 1);
  assert.equal(calls.hotkeys.length, 1);
  assert.equal(calls.scrolls.length, 1);

  for (const cleanup of cleanupA) cleanup();
  await assert.rejects(click.execute(clickParams, runA), /先观察/u, "disposed Agent Run observations cannot be reused");

  clickGate = true;
  await real.tools.get("computer_use_observe").execute({}, runB);
  const pendingClick = click.execute(clickParams, runB);
  await new Promise(resolve => setImmediate(resolve));
  const disposal = real.cleanups.at(-1)();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.shutdown, 0, "unload waits for a driver input already in flight");
  releaseClick();
  await pendingClick;
  await disposal;
  assert.equal(calls.shutdown, 1);
  assert.equal(calls.destroyed, 1);
  for (const cleanup of [...real.cleanups].reverse().slice(1)) if (typeof cleanup === "function") await cleanup();
  } finally {
    const { configuration } = await import("lfaa-storage-domain/src/configuration.js");
    const { closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
    configuration.close();
    closeDatabase();
    for (const [name, value] of Object.entries(oldEnvironment)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    rmSync(dataDirectory, { recursive: true, force: true });
  }
});

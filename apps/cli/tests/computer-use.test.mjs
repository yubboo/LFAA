/** 功能：使用隔离 CUA Driver 替身验证本机电脑操控的 Profile、账户与单次 Agent Run 边界。 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";

let registerComputerUseTools;
let listAiBusinessTools;
let registerAiBusinessTool;
let listRegisteredAiTools;
let getUserSettings;
let saveUserSettings;
let computerControlSettingsSchema;
let browserUseSettingsSchema;
let storedToolArguments;
let persistedModelMessages;
let persistedComputerToolResult;
let computerObservationContent;
let browserObservationContent;
let releaseOlderComputerImages;
let createBrowserTools;
let BrowserSessionManager;
let createWindowsProcessLauncher;
let createLocalAppsRuntime;

function fakeDriverModule(driver) {
  const ctor = { new: value => value };
  return {
    CuaDriver: { create: async () => driver },
    GetDesktopStateInput: ctor,
    ListWindowsInput: ctor,
    ActionTarget: { Desktop: ctor, Window: ctor },
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

function makeHarness(module, enabled, profile = "desktop", localApps = {}, mode = {}) {
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
    desktopMode: profile === "desktop",
    localWebMode: mode.localWebMode ?? false,
    isEnabledForUser: enabled,
    localApps
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

test("电脑操控受 Profile、本机监听、账户开关、逐轮观察和隔离 Driver 生命周期约束", async () => {
  const repo = resolve(process.cwd(), "../..");
  const testRoot = resolve(repo, "dist/.tmp");
  mkdirSync(testRoot, { recursive: true });
  const dataDirectory = mkdtempSync(join(testRoot, "computer-use-test-"));
  const oldEnvironment = Object.fromEntries(["LFAA_HOME", "LFAA_DATA_DIR", "NODE_ENV", "JWT_SECRET"].map(name => [name, process.env[name]]));
  process.env.LFAA_HOME = join(dataDirectory, "home");
  process.env.LFAA_DATA_DIR = join(dataDirectory, "data");
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "";
  try {
  // 先完成产品真实存储迁移，再导入依赖 Writing 的工具目录；不能在旧 schema 上启动业务 Owner。
  await import("lfaa-settings/src/service.js");
  await import("lfaa-session/src/sessions.js");
  await import("lfaa-session-persistence-jsonl/src/repository.js");
  (await import("lfaa-storage-domain/src/migration.js")).retireLegacyFileTables();
  ({ registerComputerUseTools } = await import("lfaa-computer-use/src/index.js"));
  const { allowsLocalComputerUse } = await import("lfaa-launch-environment/src/config.js");
  assert.equal(allowsLocalComputerUse({ LFAA_LOCAL_MODE: true, SERVER_HOST: "localhost" }, "win32"), true);
  assert.equal(allowsLocalComputerUse({ LFAA_LOCAL_MODE: true, SERVER_HOST: "127.0.0.2" }, "win32"), true);
  assert.equal(allowsLocalComputerUse({ LFAA_LOCAL_MODE: true, SERVER_HOST: "::1" }, "win32"), true);
  assert.equal(allowsLocalComputerUse({ LFAA_LOCAL_MODE: true, SERVER_HOST: "0.0.0.0" }, "win32"), false);
  assert.equal(allowsLocalComputerUse({ LFAA_LOCAL_MODE: false, SERVER_HOST: "127.0.0.1" }, "win32"), false);
  assert.equal(allowsLocalComputerUse({ LFAA_LOCAL_MODE: true, SERVER_HOST: "127.0.0.1" }, "linux"), false);
  ({ listAiBusinessTools } = await import("lfaa-tools/src/business-tools.js"));
  ({ registerAiBusinessTool, listRegisteredAiTools } = await import("lfaa-tools/src/registry.js"));
  ({ getUserSettings, saveUserSettings } = await import("lfaa-settings/src/service.js"));
  ({ computerControlSettingsSchema } = await import("lfaa-api-remotes/src/route-contracts.js"));
  ({ browserUseSettingsSchema } = await import("lfaa-api-remotes/src/route-contracts.js"));
  ({ storedToolArguments, persistedModelMessages, persistedComputerToolResult, computerObservationContent, browserObservationContent, releaseOlderComputerImages } = await import("lfaa-agent-loop/src/execute-turn.js"));
  ({ createBrowserTools } = await import("lfaa-browser-use/src/browser-tools.js"));
  ({ BrowserSessionManager } = await import("lfaa-browser-use/src/session-manager.js"));
  const { apply: applyBrowserController } = await import("lfaa-api-browser-controller/src/index.js");
  ({ createWindowsProcessLauncher, createLocalAppsRuntime } = await import("lfaa-computer-use/src/local-apps.js"));
  const { database } = await import("lfaa-storage-sqlite/src/database.js");
  assert.equal(Number(database.prepare("PRAGMA user_version").get().user_version), 61, "数据库必须完成当前产品真实迁移");
  database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('computer-a',1,'computer-a','salt','hash','admin',1),('computer-b',2,'computer-b','salt','hash','member',0)").run();
  assert.equal(getUserSettings("computer-a").computerControl.enabled, false, "new accounts default to disabled");
  saveUserSettings("computer-a", "computer-control", { enabled: true });
  assert.equal(getUserSettings("computer-a").computerControl.enabled, true, "the account setting is persisted by its Owner");
  assert.equal(getUserSettings("computer-b").computerControl.enabled, false, "another account retains its own disabled default");
  assert.equal(getUserSettings("computer-a").browserUse.recordRecentSites, true, "recent websites are enabled by the shared account default");
  const browserControllerRoutes = new Map();
  const browserDockCalls = [];
  const browserDockSnapshotCalls = [];
  const browserRouteManager = {
    listProviders: () => [{ id: "lfaa-managed-edge", name: "LFAA Edge", available: true, isolation: "new-profile" }],
    navigate: async (...args) => { browserDockCalls.push(args); return { sessionId: "browser-session-a", providerId: args[2], revision: 1, url: args[3], title: "Example", pageText: "", controls: [], tabs: [], screenshot: null }; },
    getPanelSnapshot: async (...args) => { browserDockSnapshotCalls.push(args); return null; },
    streamDockFrames: async () => undefined,
    getPanelRevision: async () => null,
    resizeViewport: async () => null,
    back: async () => ({}), forward: async () => ({}), reload: async () => ({}), clickAt: async () => ({}), dragAt: async () => ({}), typeText: async () => ({}), pressKey: async () => ({}), scroll: async () => ({}), closeSession: async () => undefined
  };
  const browserControllerRouter = Object.fromEntries(["get", "post", "delete"].map(method => [method, (path, ...handlers) => browserControllerRoutes.set(`${method.toUpperCase()} ${path}`, handlers)]));
  applyBrowserController({ apiGateway: { register: (_context, _id, register) => register(browserControllerRouter) }, lfaaBrowser: browserRouteManager });
  const invokeBrowserControllerRoute = (routeKey, request) => new Promise((resolve, reject) => {
    const handler = browserControllerRoutes.get(routeKey)?.at(-1);
    assert.equal(typeof handler, "function", `route is registered: ${routeKey}`);
    const headers = request.headers ?? {};
    handler({ ...request, get: request.get ?? (name => headers[name.toLowerCase()]), auth: { user: { id: "computer-a" } } }, { json: resolve }, error => error ? reject(error) : resolve(undefined));
  });
  assert.equal(browserControllerRoutes.has("POST /browser/dock/prewarm"), false, "the Dock no longer starts an unused browser process before navigation");
  const emptyDockSnapshot = await invokeBrowserControllerRoute("GET /browser/dock/sessions/:sourceSessionId", {
    params: { sourceSessionId: "session-a" }, query: { providerId: "lfaa-managed-edge" }, body: {}
  });
  assert.deepEqual(emptyDockSnapshot, { session: null });
  assert.deepEqual(browserDockSnapshotCalls[0], ["computer-a", "session-a", "lfaa-managed-edge", false, false], "ordinary Dock status reads do not capture screenshots or page text");
  assert.equal(browserControllerRoutes.has("GET /browser/dock/sessions/:sourceSessionId/stream"), true, "the authenticated Dock can subscribe to the Browser Owner live page stream");
  assert.equal(browserControllerRoutes.has("POST /browser/dock/sessions/:sourceSessionId/capture-handle"), false, "the Dock no longer requires a browser chooser or capture identity handshake");
  const manualBrowserResponse = await invokeBrowserControllerRoute("POST /browser/dock/sessions/:sourceSessionId/navigate", {
    params: { sourceSessionId: "session-a" }, query: {}, body: { providerId: "lfaa-managed-edge", url: "https://example.test/" }
  });
  assert.equal(manualBrowserResponse.session.url, "https://example.test/", "the authenticated user can navigate directly in Browser Dock without enabling an Agent provider");
  assert.deepEqual(browserDockCalls[0].slice(0, 3), ["computer-a", "session-a", "lfaa-managed-edge"], "Dock navigation remains bound to the authenticated account and active LFAA Session");
  saveUserSettings("computer-a", "browser-use", { ...getUserSettings("computer-a").browserUse, enabled: true, enabledProviderIds: [] });
  const automaticallyAvailableBrowserResponse = await invokeBrowserControllerRoute("POST /browser/sessions/:sourceSessionId/navigate", {
    params: { sourceSessionId: "session-a" }, query: {}, body: { providerId: "lfaa-managed-edge", url: "https://example.test/current-session" }
  });
  assert.equal(automaticallyAvailableBrowserResponse.session.url, "https://example.test/current-session", "the Agent-facing built-in browser route does not require a per-provider connection preference");
  assert.deepEqual(getUserSettings("computer-a").browserUse.enabledProviderIds, [], "using the built-in browser does not write enabledProviderIds");
  saveUserSettings("computer-a", "browser-use", { ...getUserSettings("computer-a").browserUse, enabled: false });
  await assert.rejects(invokeBrowserControllerRoute("POST /browser/sessions/:sourceSessionId/navigate", {
    params: { sourceSessionId: "session-a" }, query: {}, body: { providerId: "lfaa-managed-edge", url: "https://example.test/" }
  }), error => error?.errorCode === "browser_use_disabled", "the Agent-facing route still obeys the Browser Use master switch");
  assert.equal(getUserSettings("computer-a").browserUse.enabled, false, "manual Dock navigation does not turn on Agent browser tools");
  assert.deepEqual(getUserSettings("computer-a").browserUse.enabledProviderIds, [], "manual Dock navigation does not add an Agent provider connection");
  assert.equal(computerControlSettingsSchema.validate({ enabled: true }).error, undefined);
  assert.ok(computerControlSettingsSchema.validate({ enabled: true, extra: "not allowed" }).error, "the API rejects unknown setting fields");
  assert.equal(browserUseSettingsSchema.validate({ enabled: true, enabledProviderIds: ["lfaa-managed-edge"], showFullUrl: true, recordRecentSites: true }).error, undefined);
  const appData = join(dataDirectory, "profile");
  const programData = join(dataDirectory, "shared");
  const userPrograms = join(appData, "Microsoft", "Windows", "Start Menu", "Programs");
  const steamRoot = join(dataDirectory, "Steam");
  const steamLibrary = join(dataDirectory, "SteamLibrary");
  const portableApp = join(dataDirectory, "PCL+正式版+2.12.8.2", "Plain Craft Launcher 2.exe");
  mkdirSync(join(userPrograms, "Games"), { recursive: true });
  mkdirSync(join(steamRoot, "steamapps"), { recursive: true });
  mkdirSync(join(steamLibrary, "steamapps", "common", "Star Expedition"), { recursive: true });
  mkdirSync(join(steamLibrary, "steamapps", "escape"), { recursive: true });
  mkdirSync(dirname(portableApp), { recursive: true });
  writeFileSync(portableApp, "fixture exe", "utf8");
  writeFileSync(join(userPrograms, "Games", "诡秘之主.lnk"), "", "utf8");
  writeFileSync(join(steamRoot, "steam.exe"), "", "utf8");
  const escapedSteamLibrary = steamLibrary.replace(/\\/gu, "\\\\").replace(/"/gu, "\\\"");
  writeFileSync(join(steamRoot, "steamapps", "libraryfolders.vdf"), `"libraryfolders" { "0" { "path" "${escapedSteamLibrary}" } }`, "utf8");
  writeFileSync(join(steamLibrary, "steamapps", "appmanifest_123456.acf"), '"AppState" { "appid" "123456" "name" "星际远征" "installdir" "Star Expedition" }', "utf8");
  writeFileSync(join(steamLibrary, "steamapps", "appmanifest_222222.acf"), '"AppState" { "appid" "222222" "name" "越界游戏" "installdir" "..\\\\escape" }', "utf8");
  writeFileSync(join(steamLibrary, "steamapps", "appmanifest_333333.acf"), '"AppState" { "appid" "444444" "name" "ID不匹配" "installdir" "Star Expedition" }', "utf8");
  const localAppLaunches = [];
  let windowsSnapshotCalls = 0;
  const localApps = {
    env: { APPDATA: appData, ProgramData: programData, SystemRoot: join(dataDirectory, "Windows") },
    getSteamRoot: async () => steamRoot,
    getWindowsAppSnapshot: async () => { windowsSnapshotCalls += 1; return { appsFolder: [], registered: [], driveRoots: [dataDirectory] }; },
    launchProcess: async (executable, args, _signal, workingDirectory) => {
      localAppLaunches.push({ executable, args, ...(workingDirectory ? { workingDirectory } : {}) });
    }
  };
  const registeredFixtureRoot = join(dataDirectory, "registered-fixture");
  const registeredFixtureAppData = join(registeredFixtureRoot, "profile");
  const registeredExecutable = join(registeredFixtureRoot, "Registered Utility.exe");
  mkdirSync(registeredFixtureRoot, { recursive: true });
  writeFileSync(registeredExecutable, "fixture exe", "utf8");
  let portableScanCount = 0;
  const registeredRuntime = createLocalAppsRuntime({
    platform: "win32",
    env: { APPDATA: registeredFixtureAppData, ProgramData: join(registeredFixtureRoot, "shared"), SystemRoot: join(dataDirectory, "Windows") },
    getSteamRoot: async () => null,
    getWindowsAppSnapshot: async () => ({ appsFolder: [], registered: [{ name: "Registered Utility", displayIcon: registeredExecutable, appPath: "" }], driveRoots: [registeredFixtureRoot] }),
    discoverPortableApps: async () => { portableScanCount += 1; return { entries: [], truncated: false, warnings: [] }; }
  });
  const registeredResult = await registeredRuntime.search("Registered Utility", "scanner-user", "scanner-run");
  assert.equal(registeredResult.matches[0].name, "Registered Utility");
  assert.equal(portableScanCount, 0, "a registered exact app match skips the portable executable scan");
  await registeredRuntime.dispose();
  const childProcessOptions = [];
  const fakeProcess = new (await import("node:events")).EventEmitter();
  fakeProcess.unref = () => { fakeProcess.wasUnreferenced = true; };
  const safeLauncher = createWindowsProcessLauncher((executable, args, options) => {
    childProcessOptions.push({ executable, args, options });
    queueMicrotask(() => fakeProcess.emit("spawn"));
    return fakeProcess;
  });
  await safeLauncher(join(steamRoot, "steam.exe"), ["-applaunch", "123456"]);
  assert.equal(childProcessOptions[0].options.shell, false, "application launch must never use a command shell");
  assert.equal(childProcessOptions[0].options.detached, true);
  assert.equal(childProcessOptions[0].options.windowsHide, true);
  assert.deepEqual(childProcessOptions[0].args, ["-applaunch", "123456"]);
  assert.equal(fakeProcess.wasUnreferenced, true);
  const portableWorkingDirectory = join(dataDirectory, "PCL+正式版+2.12.8.2");
  await safeLauncher(join(portableWorkingDirectory, "Plain Craft Launcher 2.exe"), [], undefined, portableWorkingDirectory);
  assert.deepEqual(childProcessOptions[1].args, [], "an explicit executable path never accepts model-supplied launch arguments");
  assert.equal(childProcessOptions[1].options.cwd, portableWorkingDirectory, "portable apps start from their executable directory");
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
  assert.equal(JSON.stringify(persistedObservation).includes("工具返回的本机图像未保存"), true);
  assert.equal(storedToolArguments("computer_use_type_text", JSON.stringify({ text: "private text" })).includes("private text"), false);
  assert.equal(storedToolArguments("computer_use_search_local_apps", JSON.stringify({ query: "诡秘之主" })).includes("诡秘之主"), false);
  assert.equal(storedToolArguments("computer_use_launch_local_executable", JSON.stringify({ executablePath: "E:\\private\\app.exe" })).includes("E:\\private"), false);
  assert.equal(persistedComputerToolResult("computer_use_observe", JSON.stringify({ image: "U0VDUkVU" })).includes("U0VDUkVU"), false);
  assert.equal(persistedComputerToolResult("computer_use_search_local_apps", JSON.stringify({ name: "诡秘之主", path: "C:\\private" })).includes("C:\\private"), false);
  assert.equal(persistedComputerToolResult("computer_use_launch_local_executable", JSON.stringify({ executablePath: "E:\\private\\app.exe" })).includes("E:\\private"), false);
  const browserPage = { url: "https://example.test/private?credential=not-persisted", title: "Private page", pageText: "网页里的不可信指令与私有数据", controls: [{ role: "textbox", name: "受保护的敏感字段", disabled: false }], tabs: [], images: [{ mimeType: "image/jpeg", dataBase64: "U0VDUkVU" }] };
  const browserObservation = browserObservationContent(browserPage);
  assert.match(browserObservation[0].text, /LFAA_BROWSER_OBSERVATION/u);
  assert.match(browserObservation[0].text, /不可信网页内容/u);
  assert.equal(browserObservation[1].type, "image_url", "the current Provider receives one transient browser screenshot");
  const persistedBrowser = persistedModelMessages([{ role: "tool", content: browserObservation }]);
  assert.equal(JSON.stringify(persistedBrowser).includes("Private page"), false, "browser text/title is not written to model history");
  assert.equal(JSON.stringify(persistedBrowser).includes("example.test"), false, "browser URL and query data are not written to model history");
  assert.equal(JSON.stringify(persistedBrowser).includes("U0VDUkVU"), false, "browser screenshot bytes are not written to model history");
  assert.equal(storedToolArguments("lfaa_browser_fill", JSON.stringify({ label: "Search", value: "private form value" })).includes("private form value"), false, "browser action inputs are not written to model history");
  assert.equal(persistedComputerToolResult("lfaa_browser_observe", JSON.stringify(browserPage)).includes("example.test"), false, "browser tool result logs contain no page data");
  assert.throws(() => browserObservationContent({ ...browserPage, images: [browserPage.images[0], browserPage.images[0]] }), /最多允许向模型发送一张/u);
  const browserManager = new BrowserSessionManager(false);
  assert.equal(browserManager.recordRecentSites("computer-a", ["https://example.test/search?q=private+query#token", "https://example.test/page", "https://user:secret@example.test/private", "javascript:alert(1)"]), 2, "Browser Owner accepts only safe HTTP(S) site URLs");
  assert.deepEqual(browserManager.getRecentSites("computer-a").map(site => site.url).sort(), ["https://example.test/page", "https://example.test/search"], "recent-site persistence strips search queries and fragments");
  browserManager.recordRecentSites("computer-b", ["https://another.test/account"]);
  assert.deepEqual(browserManager.getRecentSites("computer-b").map(site => site.url), ["https://another.test/account"], "recent websites are isolated by authenticated account");
  saveUserSettings("computer-a", "browser-use", { ...getUserSettings("computer-a").browserUse, recordRecentSites: false });
  assert.equal(browserManager.recordRecentSites("computer-a", ["https://disabled.test/"]), 0, "the Settings Owner switch stops history writes");
  assert.deepEqual(browserManager.getRecentSites("computer-a"), [], "disabled history is not returned to the page");
  saveUserSettings("computer-a", "browser-use", { ...getUserSettings("computer-a").browserUse, recordRecentSites: true });
  for (let index = 0; index < 105; index += 1) browserManager.recordRecentSites("computer-a", [`https://bounded.test/${index}`]);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM browser_recent_sites WHERE user_id = ?").get("computer-a").count, 100, "recent history is capped at 100 URLs per account");
  browserManager.clearRecentSites("computer-a");
  assert.deepEqual(browserManager.getRecentSites("computer-a"), [], "recent history can be cleared by its account owner");
  assert.deepEqual(browserManager.listProviders(), [], "remote host does not publish local browser providers");
  const browserTools = createBrowserTools(browserManager);
  assert.ok(browserTools.some(tool => tool.name === "lfaa_browser_list_tabs"), "Tabbit selection has an explicit tab inventory tool");
  assert.ok(browserTools.every(tool => tool.requiresBrowserUse), "browser tools reuse the Browser Use master setting");
  assert.ok(browserTools.filter(tool => tool.name === "lfaa_browser_list_tabs" || tool.name === "lfaa_browser_claim_tab").every(tool => tool.requiresComputerControl), "personal Tabbit tools additionally reuse the existing computerControl setting");
  assert.ok(browserTools.filter(tool => !["lfaa_browser_list_tabs", "lfaa_browser_claim_tab"].includes(tool.name)).every(tool => !tool.requiresComputerControl), "isolated browser tools are controlled by Browser Use rather than the desktop-control switch");
  assert.equal(browserTools.some(tool => tool.name === "lfaa_browser_set_provider_connection"), false, "built-in LFAA browsers do not expose a separate connect/disconnect tool");
  const browserToolCleanups = [];
  const browserToolOwner = { effect(callback) { const cleanup = callback(); if (typeof cleanup === "function") browserToolCleanups.push(cleanup); return cleanup; } };
  for (const tool of browserTools) registerAiBusinessTool(browserToolOwner, tool);
  assert.equal(listAiBusinessTools("workspace", "admin", null, "ask", false, false, true).some(tool => tool.id.startsWith("browser-use.")), false, "Agent tools stay hidden while Browser Use is disabled");
  assert.ok(listAiBusinessTools("workspace", "admin", null, "ask", false, false, false, true).some(tool => tool.id.startsWith("browser-use.")), "enabling Browser Use exposes the registered browser tools independently of computerControl");
  const listBrowserProviders = browserTools.find(tool => tool.name === "lfaa_browser_list_providers");
  assert.ok(listBrowserProviders);
  await assert.rejects(listBrowserProviders.execute({}, runContext("browser-disabled", "computer-a")), /设置中心关闭/u, "execution rechecks the account Browser Use toggle");
  saveUserSettings("computer-a", "browser-use", { enabled: true, enabledProviderIds: [], showFullUrl: false });
  assert.deepEqual(await listBrowserProviders.execute({}, runContext("browser-no-links", "computer-a")), { providers: [], personalBrowsersInspected: false }, "provider discovery reflects this remote Host's actual lack of local browsers");
  saveUserSettings("computer-a", "browser-use", { enabled: true, enabledProviderIds: ["lfaa-managed-edge"], showFullUrl: false });
  assert.deepEqual(await listBrowserProviders.execute({}, runContext("browser-unavailable", "computer-a")), { providers: [], personalBrowsersInspected: false }, "linked preferences still do not invent providers absent from the current Host");

  const builtinBrowserManager = {
    listProviders: () => [
      { id: "lfaa-managed-edge", name: "LFAA Edge", available: true, isolation: "new-profile" },
      { id: "tabbit-personal", name: "Tabbit", available: true, isolation: "user-profile" }
    ],
    createRunAdapter: binding => ({
      navigate: async (providerId, url) => ({ sessionId: binding.sourceSessionId, providerId, url, screenshot: null, tabs: [] })
    })
  };
  saveUserSettings("computer-a", "browser-use", { enabled: true, enabledProviderIds: [], showFullUrl: false });
  const builtinBrowserTools = createBrowserTools(builtinBrowserManager);
  const builtinProviderList = builtinBrowserTools.find(tool => tool.name === "lfaa_browser_list_providers");
  const builtinNavigate = builtinBrowserTools.find(tool => tool.name === "lfaa_browser_navigate");
  const availableProviders = await builtinProviderList.execute({}, runContext("builtin-browser-list", "computer-a"));
  assert.equal(availableProviders.providers.find(provider => provider.id === "lfaa-managed-edge").connected, true, "the built-in browser is automatically available without changing enabledProviderIds");
  assert.equal(availableProviders.providers.find(provider => provider.id === "tabbit-personal").connected, false, "personal Tabbit remains explicitly disconnected");
  const sharedAgentContext = { ...runContext("builtin-browser-run", "computer-a"), sessionId: "shared-ai-session" };
  const openedByAgent = await builtinNavigate.execute({ providerId: "lfaa-managed-edge", url: "https://example.test/" }, sharedAgentContext);
  assert.equal(openedByAgent.sessionId, "shared-ai-session", "Agent browser actions bind to the current LFAA AI session");
  assert.equal(getUserSettings("computer-a").browserUse.enabledProviderIds.length, 0, "using the built-in browser does not write a provider connection preference");
  await assert.rejects(builtinNavigate.execute({ providerId: "tabbit-personal", url: "https://example.test/" }, sharedAgentContext), /明确选择并接入/u, "personal browser use still requires a user-selected connection");
  saveUserSettings("computer-a", "browser-use", { enabled: false, enabledProviderIds: [], showFullUrl: false });
  await assert.rejects(builtinNavigate.execute({ providerId: "lfaa-managed-edge", url: "https://example.test/" }, sharedAgentContext), /设置中心关闭/u, "the Agent Browser Use master switch still gates built-in browser tools");
  for (const cleanup of browserToolCleanups.reverse()) await cleanup();
  await browserManager.closeAll();
  const forbiddenDriver = { isAvailable: () => true, shutdown() {}, getDesktopState() { throw new Error("不应读取桌面"); } };
  const web = makeHarness(fakeDriverModule(forbiddenDriver), () => true, "web");
  assert.equal(web.tools.size, 0, "web profile without local loopback mode must not register computer-use tools");
  assert.equal(web.cleanups.length, 0);
  const localWeb = makeHarness(fakeDriverModule(forbiddenDriver), () => true, "web", {}, { localWebMode: true });
  assert.equal(localWeb.tools.size, 9, "explicit local loopback web profile registers the real CUA adapter");
  await Promise.all(localWeb.cleanups.map(cleanup => cleanup()));
  const exposedWeb = makeHarness(fakeDriverModule(forbiddenDriver), () => true, "web", {}, { localWebMode: false });
  assert.equal(exposedWeb.tools.size, 0, "an externally bound web profile cannot register desktop control");

  const deniedCalls = { create: 0 };
  const disabled = makeHarness(fakeDriverModule({
    isAvailable: () => true,
    async getDesktopState() { throw new Error("disabled account must not observe"); },
    async shutdown() {}
  }), () => false, "desktop", localApps);
  assert.equal(disabled.tools.size, 9);
  assert.equal(listAiBusinessTools("workspace", "admin", null, "ask", false, false, false).some(tool => tool.id.startsWith("computer-use.")), false);
  assert.equal(listAiBusinessTools("workspace", "admin", null, "ask", false, false, true).filter(tool => tool.id.startsWith("computer-use.")).length, 9);
  await assert.rejects(disabled.tools.get("computer_use_observe").execute({}, runContext("disabled-run")), /设置中心启用/u);
  await assert.rejects(disabled.tools.get("computer_use_search_local_apps").execute({ query: "诡秘之主" }, runContext("disabled-search")), /设置中心启用/u);
  await assert.rejects(disabled.tools.get("computer_use_launch_local_app").execute({ id: "steam:123456" }, runContext("disabled-launch")), /设置中心启用/u);
  await assert.rejects(disabled.tools.get("computer_use_launch_local_executable").execute({ executablePath: portableApp }, runContext("disabled-path-launch")), /设置中心启用/u);
  for (const cleanup of [...disabled.cleanups].reverse()) if (typeof cleanup === "function") await cleanup();

  const calls = { create: 0, observations: 0, clicks: [], typed: [], hotkeys: [], scrolls: [], shutdown: 0, destroyed: 0 };
  let releaseClick;
  let clickGate = null;
  const driver = {
    async listWindows() { return { windows: [{ pid: 42, windowId: 1001n, appName: "Explorer", title: "fixture files", isOnScreen: true, bounds: { x: 0, y: 0, width: 800, height: 600 } }] }; },
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
  const real = makeHarness({ ...fakeDriverModule(driver), CuaDriver: { create: async () => { calls.create += 1; return driver; } } }, () => true, "desktop", localApps);
  assert.deepEqual([...real.tools.keys()].sort(), ["computer_use_click", "computer_use_hotkey", "computer_use_launch_local_app", "computer_use_launch_local_executable", "computer_use_observe", "computer_use_recommend_games", "computer_use_scroll", "computer_use_search_local_apps", "computer_use_type_text"]);
  assert.equal(calls.create, 0, "driver creation is lazy until a real tool call");
  assert.equal(real.tools.get("computer_use_observe").risk({}), "read");
  for (const name of ["computer_use_click", "computer_use_hotkey", "computer_use_scroll", "computer_use_type_text"]) {
    assert.equal(real.tools.get(name).risk({}), "dangerous");
  }
  assert.equal(real.tools.get("computer_use_search_local_apps").risk({}), "read");
  assert.equal(real.tools.get("computer_use_recommend_games").risk({}), "read");
  assert.equal(real.tools.get("computer_use_launch_local_app").risk({}), "dangerous");
  assert.equal(real.tools.get("computer_use_launch_local_executable").risk({}), "dangerous");
  assert.match(real.tools.get("computer_use_launch_local_app").description, /不要为同一目标重复搜索/u);
  assert.match(real.tools.get("computer_use_launch_local_executable").description, /不要.*递归搜索磁盘/u);

  const recommendations = await real.tools.get("computer_use_recommend_games").execute({}, runContext("games-first-run", "user-a"));
  assert.equal(recommendations.hasLaunchHistory, false, "first-use suggestions must not pretend there is prior play history");
  assert.deepEqual(recommendations.recommendations, []);
  assert.equal(recommendations.installedSteamGames[0].id, "steam:123456");
  const searchLocalApps = real.tools.get("computer_use_search_local_apps");
  const portableSearch = await searchLocalApps.execute(searchLocalApps.parse({ query: "我想启动 PCL 启动器" }), runContext("pcl-natural-run", "user-a"));
  assert.equal(portableSearch.matches.length, 1, "a natural-language app request finds a portable executable from its folder and initials");
  assert.equal(portableSearch.matches[0].name, "Plain Craft Launcher 2");
  assert.equal(portableSearch.matches[0].launcher, "Windows 应用文件查找");
  assert.ok(!JSON.stringify(portableSearch).includes(portableApp), "portable discovery results never expose executable paths");
  assert.ok(portableSearch.matches[0].searchAliases?.some(alias => alias.startsWith("PCL")), "folder labels help the model compare real search candidates");
  const launchLocalApp = real.tools.get("computer_use_launch_local_app");
  assert.throws(() => launchLocalApp.parse({}), /id|query/u, "launch requires either a candidate ID or an app name");
  assert.throws(() => launchLocalApp.parse({ id: portableSearch.matches[0].id, query: "PCL2" }), /id|query/u, "launch rejects mixed ID and query targets");
  const directParameters = launchLocalApp.parse({ query: "PCL2" });
  const directApproval = launchLocalApp.approval(directParameters, runContext("pcl-direct-run", "user-a"));
  assert.ok(directApproval.summary.includes("PCL2"), "name-based launch approvals identify the requested app name");
  assert.ok(!directApproval.summary.includes(portableApp), "name-based launch approvals never expose discovered paths");
  const snapshotsBeforeDirectLaunch = windowsSnapshotCalls;
  const directLaunch = await launchLocalApp.execute(directParameters, runContext("pcl-direct-run", "user-a"));
  assert.equal(windowsSnapshotCalls, snapshotsBeforeDirectLaunch + 1, "name-based launch uses a single discovery pass before dispatch");
  assert.equal(directLaunch.status, "launch_requested", "a unique high-confidence acronym can be resolved and launched in one tool call");
  assert.equal(directLaunch.app, "Plain Craft Launcher 2");
  assert.deepEqual(localAppLaunches.at(-1), { executable: portableApp, args: [], workingDirectory: dirname(portableApp) });
  const portableLaunch = await launchLocalApp.execute(launchLocalApp.parse({ id: portableSearch.matches[0].id }), runContext("pcl-natural-run", "user-a"));
  assert.equal(portableLaunch.status, "launch_requested", "a searched portable candidate can be launched through the same generic target tool");
  assert.deepEqual(localAppLaunches.at(-1), { executable: portableApp, args: [], workingDirectory: dirname(portableApp) });
  writeFileSync(join(userPrograms, "PCL2.lnk"), "", "utf8");
  writeFileSync(join(userPrograms, "PCL2 Launcher.lnk"), "", "utf8");
  const launchCountBeforeAmbiguous = localAppLaunches.length;
  const ambiguousLaunch = await launchLocalApp.execute(launchLocalApp.parse({ query: "PCL2" }), runContext("pcl-ambiguous-run", "user-a"));
  assert.equal(ambiguousLaunch.status, "ambiguous", "multiple equally plausible local app names must not be started");
  assert.equal(ambiguousLaunch.matches.length, 2);
  assert.ok(!JSON.stringify(ambiguousLaunch).includes(portableApp), "ambiguous results expose candidates without executable paths");
  assert.equal(localAppLaunches.length, launchCountBeforeAmbiguous, "ambiguous name-based launch does not start a process");
  await assert.rejects(
    real.tools.get("computer_use_launch_local_app").execute(real.tools.get("computer_use_launch_local_app").parse({ id: "steam:123456" }), runContext("games-guessed-run", "user-a")),
    /必须来自当前这轮对话/u,
    "an installed Steam ID guessed by the model must not be enough to start a game"
  );
  const discoveredShortcut = await searchLocalApps.execute(searchLocalApps.parse({ query: "诡秘之主" }), runContext("games-shortcut-run", "user-a"));
  assert.equal(discoveredShortcut.matches[0].name, "诡秘之主");
  assert.equal(discoveredShortcut.matches[0].launcher, "Windows 开始菜单");
  await launchLocalApp.execute(launchLocalApp.parse({ id: discoveredShortcut.matches[0].id }), runContext("games-shortcut-run", "user-a"));
  const afterShortcutLaunch = await real.tools.get("computer_use_recommend_games").execute({}, runContext("games-shortcut-run", "user-a"));
  assert.equal(afterShortcutLaunch.hasLaunchHistory, false, "starting an unclassified app shortcut must not be described as playing a game");
  const discoveredSteamGame = await searchLocalApps.execute(searchLocalApps.parse({ query: "星际远征" }), runContext("games-steam-run", "user-a"));
  const missingGame = await searchLocalApps.execute(searchLocalApps.parse({ query: "越界游戏" }), runContext("games-missing-steam-run", "user-a"));
  assert.deepEqual(missingGame.matches, [], "Steam manifests that escape the library install directory must not be discoverable");
  const mismatchedGame = await searchLocalApps.execute(searchLocalApps.parse({ query: "ID不匹配" }), runContext("games-mismatched-steam-run", "user-a"));
  assert.deepEqual(mismatchedGame.matches, [], "a manifest AppID that differs from its filename must be rejected");
  const emptySearch = await searchLocalApps.execute(searchLocalApps.parse({ query: "确实不存在的游戏" }), runContext("games-empty-game-run", "user-a"));
  assert.deepEqual(emptySearch.matches, []);
  assert.throws(() => real.tools.get("computer_use_launch_local_app").parse({ id: "C:\\Games\\evil.exe" }), /id/u, "model-provided paths must not parse as launch targets");
  const steamGameId = discoveredSteamGame.matches[0].id;
  assert.equal(launchLocalApp.approval({ id: steamGameId }, runContext("games-search-steam", "user-a")).summary.includes("星际远征"), true);
  const launchResult = await launchLocalApp.execute(launchLocalApp.parse({ id: steamGameId }), runContext("games-steam-run", "user-a"));
  assert.equal(launchResult.status, "launch_requested");
  assert.equal(launchResult.runningState, "unverified");
  assert.deepEqual(localAppLaunches, [
    { executable: portableApp, args: [], workingDirectory: dirname(portableApp) },
    { executable: portableApp, args: [], workingDirectory: dirname(portableApp) },
    { executable: join(dataDirectory, "Windows", "explorer.exe"), args: [join(userPrograms, "Games", "诡秘之主.lnk")] },
    { executable: join(steamRoot, "steam.exe"), args: ["-applaunch", "123456"] }
  ]);
  const afterLaunch = await real.tools.get("computer_use_recommend_games").execute({}, runContext("games-steam-run", "user-a"));
  assert.equal(afterLaunch.hasLaunchHistory, true);
  assert.equal(afterLaunch.recommendations[0].id, steamGameId);
  assert.equal(afterLaunch.recommendations[0].launchCount, 1);
  const otherAccountHistory = await real.tools.get("computer_use_recommend_games").execute({}, runContext("games-other-account", "user-b"));
  assert.equal(otherAccountHistory.hasLaunchHistory, false, "launch recommendations must be account-isolated");
  await assert.rejects(launchLocalApp.execute(launchLocalApp.parse({ id: "steam:999999" }), runContext("games-unknown", "user-a")), /必须来自当前这轮对话/u);
  const staleCandidate = await searchLocalApps.execute(searchLocalApps.parse({ query: "星际远征" }), runContext("games-stale-run", "user-a"));
  const installedGameDirectory = join(steamLibrary, "steamapps", "common", "Star Expedition");
  rmSync(installedGameDirectory, { recursive: true, force: true });
  await assert.rejects(launchLocalApp.execute(launchLocalApp.parse({ id: staleCandidate.matches[0].id }), runContext("games-stale-run", "user-a")), /未找到该目标/u);
  mkdirSync(installedGameDirectory, { recursive: true });
  const cleanupRunId = "games-cleanup-run";
  const cleanupRun = new Set();
  const cleanupCandidate = await searchLocalApps.execute(searchLocalApps.parse({ query: "星际远征" }), runContext(cleanupRunId, "user-a", cleanupRun));
  for (const cleanup of cleanupRun) cleanup();
  await assert.rejects(launchLocalApp.execute(launchLocalApp.parse({ id: cleanupCandidate.matches[0].id }), runContext(cleanupRunId, "user-a")), /必须来自当前这轮对话/u, "Agent Run cleanup must revoke unused launch candidates");
  assert.equal(localAppLaunches.length, 4, "unknown or uninstalled IDs must never launch a process");

  const launchExecutable = real.tools.get("computer_use_launch_local_executable");
  const exactPathParameters = launchExecutable.parse({ executablePath: portableApp });
  const exactPathApproval = launchExecutable.approval(exactPathParameters, runContext("pcl-path-run", "user-a"));
  assert.ok(exactPathApproval.summary.includes("Plain Craft Launcher 2.exe"), "approval identifies the exact executable target");
  assert.ok(!exactPathApproval.scopeKey.includes(portableApp), "approval scope hashes rather than exposes the full local path");
  assert.throws(() => launchExecutable.parse({ executablePath: portableApp, args: ["--anything"] }));
  const { authorizeAiTool } = await import("lfaa-permission-presets/src/permissions.js");
  const exactPathAuthorization = {
    userId: "computer-a",
    activeApplicationId: "minecraft",
    toolApplicationIds: ["minecraft"],
    toolId: launchExecutable.id,
    toolVersion: "1.0.0",
    risk: launchExecutable.risk(exactPathParameters),
    scopeKey: exactPathApproval.scopeKey,
    executable: true
  };
  saveUserSettings("computer-a", "permissions", { ...getUserSettings("computer-a").permissions, mode: "ask" });
  assert.equal(authorizeAiTool(exactPathAuthorization), "approval_required", "ask mode keeps the existing per-operation approval");
  saveUserSettings("computer-a", "permissions", { ...getUserSettings("computer-a").permissions, mode: "approve_remembered" });
  assert.equal(authorizeAiTool(exactPathAuthorization), "approval_required", "remembered mode asks until this exact target scope is approved");
  const { requestAiToolApproval, decideAiToolApproval, listAiToolPermissionGrants, revokeAiToolPermissionGrant } = await import("lfaa-permission-presets/src/permissions.js");
  const approvalSessionId = "computer-approval-memory-session";
  database.prepare("INSERT INTO ai_sessions (id, user_id, app_id, title) VALUES (?, 'computer-a', 'minecraft', '重复授权记忆测试')").run(approvalSessionId);
  const approvalInput = {
    userId: "computer-a",
    sessionId: approvalSessionId,
    appId: "minecraft",
    toolId: launchExecutable.id,
    toolVersion: "1.0.0",
    risk: "dangerous",
    scopeKey: exactPathApproval.scopeKey,
    scopeSummary: exactPathApproval.scopeSummary,
    summary: exactPathApproval.summary,
    parameters: exactPathParameters
  };
  const approveSameScope = () => {
    const pending = requestAiToolApproval(approvalInput);
    assert.equal(decideAiToolApproval("computer-a", pending.id, "approved", false)?.status, "approved");
  };
  assert.equal(listAiToolPermissionGrants("computer-a").length, 0, "one approval does not create a remembered grant");
  approveSameScope();
  assert.equal(listAiToolPermissionGrants("computer-a").length, 0, "the first identical approval still requires a second explicit approval");
  approveSameScope();
  assert.equal(listAiToolPermissionGrants("computer-a").length, 1, "the second identical approval remembers exactly this authorization scope");
  assert.equal(authorizeAiTool(exactPathAuthorization), "allow", "the remembered exact target no longer waits for item-by-item approval");
  assert.equal(revokeAiToolPermissionGrant("computer-a", listAiToolPermissionGrants("computer-a")[0].id), true, "the remembered authorization remains revocable");
  assert.equal(authorizeAiTool(exactPathAuthorization), "approval_required", "revocation removes the remembered permission");
  approveSameScope();
  assert.equal(listAiToolPermissionGrants("computer-a").length, 0, "revocation resets the approval-memory count for that exact scope");
  approveSameScope();
  assert.equal(listAiToolPermissionGrants("computer-a").length, 1, "two new approvals after revocation can remember the scope again");
  assert.equal(authorizeAiTool({ ...exactPathAuthorization, scopeKey: `${exactPathApproval.scopeKey}:different` }), "approval_required", "a different target remains gated");
  saveUserSettings("computer-a", "permissions", { ...getUserSettings("computer-a").permissions, mode: "ask" });
  assert.equal(authorizeAiTool(exactPathAuthorization), "approval_required", "ask mode still requests every risky operation even when a remembered grant exists");
  assert.equal(revokeAiToolPermissionGrant("computer-a", listAiToolPermissionGrants("computer-a")[0].id), true);
  const askModeApproval = requestAiToolApproval(approvalInput);
  assert.equal(decideAiToolApproval("computer-a", askModeApproval.id, "approved")?.status, "approved");
  saveUserSettings("computer-a", "permissions", { ...getUserSettings("computer-a").permissions, mode: "approve_remembered" });
  approveSameScope();
  assert.equal(listAiToolPermissionGrants("computer-a").length, 0, "an ask-mode approval does not count toward automatic memory");
  approveSameScope();
  assert.equal(listAiToolPermissionGrants("computer-a").length, 1, "two approvals made in remembered mode create the permission");
  saveUserSettings("computer-a", "permissions", { ...getUserSettings("computer-a").permissions, mode: "full_access" });
  assert.equal(authorizeAiTool(exactPathAuthorization), "allow", "full access dispatches without an extra approval");
  const exactPathResult = await launchExecutable.execute(exactPathParameters, runContext("pcl-path-run", "user-a"));
  assert.deepEqual(exactPathResult, { status: "launch_requested", app: "Plain Craft Launcher 2.exe", launcher: "用户指定路径", game: false, runningState: "unverified" });
  assert.deepEqual(localAppLaunches.at(-1), { executable: portableApp, args: [], workingDirectory: dirname(portableApp) });
  await assert.rejects(launchExecutable.execute(launchExecutable.parse({ executablePath: join(dataDirectory, "missing.exe") }), runContext("missing-path-run", "user-a")), /文件不存在/u);
  await assert.rejects(launchExecutable.execute(launchExecutable.parse({ executablePath: "relative\\app.exe" }), runContext("relative-path-run", "user-a")), /绝对路径/u);
  await assert.rejects(launchExecutable.execute(launchExecutable.parse({ executablePath: steamRoot }), runContext("directory-path-run", "user-a")), /绝对路径/u);
  assert.throws(() => launchExecutable.parse({ executablePath: `${portableApp}\n` }), /pattern|regex|valid/u);

  const cappedAppData = join(dataDirectory, "capped-profile");
  const cappedPrograms = join(cappedAppData, "Microsoft", "Windows", "Start Menu", "Programs");
  mkdirSync(cappedPrograms, { recursive: true });
  for (let index = 0; index < 1001; index += 1) writeFileSync(join(cappedPrograms, `app-${index}.lnk`), "", "utf8");
  const cappedRuntime = createLocalAppsRuntime({
    platform: "win32",
    env: { APPDATA: cappedAppData, SystemRoot: join(dataDirectory, "Windows") },
    getSteamRoot: async () => null
  });
  const cappedSearch = await cappedRuntime.search("not-present", "user-a");
  assert.equal(cappedSearch.truncated, true, "Start Menu discovery must report reaching its item cap");
  await cappedRuntime.dispose();

  const cleanupA = new Set();
  const runA = runContext("run-a", "user-a", cleanupA);
  const observed = await real.tools.get("computer_use_observe").execute({}, runA);
  assert.equal(observed.images[0].dataBase64, "AAAA");
  assert.equal(observed.windows[0].windowId, "1001");
  assert.match(JSON.stringify(computerObservationContent(observed)), /fixture files/u);
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
  const typedParams = typed.parse({ text: "non-sensitive mock text", pid: 42, windowId: "1001" });
  assert.equal(typed.approval(typedParams, runA).summary.includes("non-sensitive mock text"), false);
  assert.throws(() => typed.parse({ text: "fixture", windowId: "1001" }), /pid/u);
  await typed.execute(typedParams, runA);
  assert.deepEqual(calls.typed.at(-1).target, { pid: 42, windowId: 1001n }, "input keeps its observed target window when the approval UI takes foreground");
  await real.tools.get("computer_use_observe").execute({}, runA);
  await real.tools.get("computer_use_hotkey").execute(real.tools.get("computer_use_hotkey").parse({ keys: ["CTRL", "S"], pid: 42, windowId: "1001" }), runA);
  assert.deepEqual(calls.hotkeys.at(-1).target, { pid: 42, windowId: 1001n });
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
    (await import("lfaa-session-persistence-jsonl/src/repository.js")).sessionRecords.close();
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

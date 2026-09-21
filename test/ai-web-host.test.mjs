import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Web Secret adapter uses Rust broker binary protocol and never PowerShell/C#", async () => {
  const source = await read("packages/credentials/credentials-native/src/rust-secret-store.ts");
  const rust = await read("native/secret-store/src/lib.rs");
  assert.match(source, /lfaa-secret-broker/);
  assert.match(source, /child\.stdin\.end\(request\)/);
  assert.match(source, /REQUEST_MAGIC/);
  assert.doesNotMatch(source, /powershell|cmdkey|Add-Type|-Command/i);
  assert.match(rust, /CredWriteW/);
  assert.match(rust, /CredReadW/);
  assert.match(rust, /CredDeleteW/);
  assert.doesNotMatch(rust, /Add-Type|System\.Runtime\.InteropServices|PowerShell/i);
});

test("Rust Secret broker verifies Windows writes by reading them back", async () => {
  const rust = await read("native/secret-store/src/lib.rs");
  assert.match(rust, /CRED_PERSIST_LOCAL_MACHINE/);
  assert.match(rust, /write_raw\(target, secret\)/);
  assert.match(rust, /read\(target, Stage::VerifyRead\)/);
  assert.match(rust, /Stage::VerifyContent/);
  assert.match(rust, /Ok\(Some\(value\)\) if value == secret => Ok\(\(\)\)/);
});

test("Windows Secret Broker is prewarmed so first Provider save does not own the Cargo cold start", async () => {
  const source = await read("packages/credentials/credentials-native/src/rust-secret-store.ts");
  assert.match(source, /void buildBroker\(projectRoot\)\.catch/);
  assert.match(source, /return new RustCredentialStore\(projectRoot\)/);
});

test("Rust Secret broker keeps secret out of argv env logs and files", async () => {
  const source = await read("packages/credentials/credentials-native/src/rust-secret-store.ts");
  assert.match(source, /spawn\(executable, \[\]/);
  assert.match(source, /stdio: \["pipe", "pipe", "pipe"\]/);
  assert.doesNotMatch(source, /env:\s*\{[^}]*secret/is);
  assert.doesNotMatch(source, /writeFile|appendFile/);
  assert.doesNotMatch(source, /console\.(?:log|error).*secret/i);
});

test("account metadata repository rejects plaintext secret fields and migrates model/account state", async () => {
  const source = await read("packages/settings/config-host-node/src/account-state-repository.ts");
  assert.match(source, /assertNoPlaintextSecret/);
  assert.match(source, /ai-accounts\.json/);
  assert.match(source, /modelSettings: account\.modelSettings \?\? \{\}/);
  assert.match(source, /modelCatalog: Array\.isArray\(account\.modelCatalog\)/);
  assert.match(source, /version: 2/);
  assert.match(source, /activeModel/);
  assert.doesNotMatch(source, /credentialRef\s*:\s*secret/);
});

test("browser AI client never uses browser storage for credentials", async () => {
  const source = await read("packages/client/connection/src/ai-settings-client.ts");
  const codex = await read("packages/harness/codex-app-server/src/codex-app-server.ts");
  assert.doesNotMatch(source, /(?:window\.)?(?:localStorage|sessionStorage)\s*\./);
  assert.match(source, /\/__lfaa\/dev\/ai/);
  assert.match(source, /modelSettings/);
  assert.match(source, /activeModel/);
  assert.match(source, /activateModel/);
});

test("Vite bridge enforces local origin and redacts common key prefixes", async () => {
  const source = await read("packages/api/settings-controller/src/ai-config-bridge.ts");
  assert.match(source, /ensureSameOrigin/);
  assert.match(source, /\[REDACTED\]/);
  assert.match(source, /MAX_BODY/);
  assert.match(source, /createWebDevSecretStore\(projectRoot\)/);
});

test("UI renders official model capabilities without Provider network logic", async () => {
  const panel = await read("packages/client/ui/src/features/settings/ai/AiSettingsPanel.tsx");
  assert.match(panel, /type="password"/);
  assert.match(panel, /ModelCapabilityEditor/);
  assert.match(panel, /模型 ID 来源/);
  assert.match(panel, /requestPath/);
  assert.match(panel, /当前 Agent 模型/);
  assert.match(panel, /设为当前模型/);
  assert.match(panel, /account\.modelCatalog/);
  assert.doesNotMatch(panel, /fetch\s*\(/);
  assert.doesNotMatch(panel, /(?:window\.)?(?:localStorage|sessionStorage)\s*\./);
});

test("Provider HTTP adapter never forwards remote error body to UI", async () => {
  const source = await read("packages/settings/config-host-node/src/node-http-json.ts");
  assert.match(source, /Provider 返回 HTTP/);
  assert.doesNotMatch(source, /body\.error|body\.message|candidate/);
});

test("Web product entry delegates native host assembly to packages", async () => {
  const viteConfig = await read("apps/web/vite.config.ts");
  const bundle = await read("packages/bundle/web-app/src/vite.ts");
  const bridge = await read("packages/api/settings-controller/src/ai-config-bridge.ts");
  const tsconfig = JSON.parse(await read("apps/web/tsconfig.json"));
  assert.match(viteConfig, /@lfaa\/bundle-web-app\/vite/);
  assert.match(bundle, /@lfaa\/settings-controller/);
  assert.match(bridge, /@lfaa\/config-host-node/);
  assert.match(bridge, /@lfaa\/credentials-native/);
  assert.match(bridge, /@lfaa\/codex-app-server/);
  assert.equal(tsconfig.compilerOptions.allowImportingTsExtensions, true);
});

test("ChatGPT subscription uses an LFAA-managed OpenAI official App Server component instead of a user-installed CLI", async () => {
  const source = await read("packages/harness/codex-app-server/src/codex-app-server.ts");
  const runtime = await read("packages/harness/codex-app-server/src/openai-official-runtime.ts");
  assert.match(source, /ensureOfficialOpenAiRuntime\(\)/);
  assert.match(source, /spawn\(officialRuntime\.executable, \[\.\.\.officialRuntime\.launchArgs\]/);
  assert.match(source, /shell: false/);
  assert.match(source, /CODEX_HOME: officialRuntime\.codexHome/);
  assert.doesNotMatch(source, /spawn\("codex"/);
  assert.doesNotMatch(source, /请先安装 Codex CLI|codex 命令已加入 PATH/);
  assert.match(runtime, /resolveLfaaHome/);
  assert.match(runtime, /runtimes", "openai-chatgpt/);
  assert.match(runtime, /codex-app-server-x86_64-pc-windows-msvc\.exe/);
  assert.match(runtime, /sha256/);
  assert.match(runtime, /releases\.openai\.com\/codex\/releases/);
  assert.match(runtime, /OFFICIAL_RUNTIME_RELEASE = "0\.154\.0"/);
  assert.match(runtime, /component: "app-server"/);
  assert.doesNotMatch(runtime, /npm install -g|pnpm add -g|spawn\("codex"/);
  assert.match(source, /stdio: \["pipe", "pipe", "pipe"\]/);
  assert.match(source, /request\("initialize"/);
  assert.match(source, /notify\("initialized"/);
  assert.match(source, /request\("account\/login\/start"/);
  assert.match(source, /type: "chatgpt"/);
  assert.match(source, /account\/login\/completed/);
  assert.match(source, /request\("account\/login\/cancel"/);
  assert.match(source, /request\("account\/read", \{ refreshToken: false \}\)/);
  assert.match(source, /request\("model\/list"/);
  assert.doesNotMatch(source, /account\/logout/);
  assert.doesNotMatch(source, /from "node:fs/);
  assert.match(source, /process\.env/);
});

test("managed ChatGPT bridge keeps subscription auth shared with Codex text runtime and separate from API-key secrets", async () => {
  const source = await read("packages/api/settings-controller/src/ai-config-bridge.ts");
  const bundle = await read("packages/bundle/web-app/src/vite.ts");
  assert.match(source, /options: \{ managedAuth\?: AiManagedAuthPort \}/);
  assert.match(source, /new CodexAppServerHost\(\)/);
  assert.match(source, /const managedAuth = options\.managedAuth \?\?/);
  assert.match(source, /\/managed-login\/start/);
  assert.match(source, /service\.startManagedLogin/);
  assert.match(source, /service\.managedLoginStatus/);
  assert.match(source, /service\.cancelManagedLogin/);
  assert.match(source, /\/subscription\/accounts/);
  assert.match(source, /service\.save\(parseDraft\(body\.draft\), null\)/);
  assert.match(bundle, /const codexHost = new CodexAppServerHost\(\)/);
  assert.match(bundle, /managedAuth: codexHost\.managedAuth/);
  assert.match(bundle, /codexRuntime: codexHost\.textRuntime/);
  assert.match(bundle, /codexLifecyclePlugin\(codexHost\)/);
});

test("browser ChatGPT login opens synchronously, validates official HTTPS domains and never stores token state", async () => {
  const source = await read("packages/client/connection/src/ai-settings-client.ts");
  const codex = await read("packages/harness/codex-app-server/src/codex-app-server.ts");
  const popupIndex = source.indexOf('window.open("about:blank"');
  const startIndex = source.indexOf('request<{ login: AiManagedLoginStart }>("/managed-login/start"');
  assert.ok(popupIndex >= 0 && startIndex > popupIndex, "popup must be opened before the first managed-login await");
  assert.match(source, /url\.protocol !== "https:"/);
  assert.match(source, /url\.hostname === "chatgpt\.com"/);
  assert.match(source, /url\.hostname === "openai\.com"/);
  assert.match(source, /MANAGED_LOGIN_TIMEOUT_MS/);
  assert.match(source, /MANAGED_LOGIN_CLOSED_GRACE_MS/);
  assert.match(source, /正在准备 OpenAI 官方登录/);
  assert.match(source, /loginCompleted/);
  assert.match(source, /!loginCompleted\) await cancelManagedLogin/);
  assert.match(source, /官方认证结果必须先于浏览器窗口生命周期判断/);
  assert.doesNotMatch(source, /if \(popup\.closed\) throw new Error\("ChatGPT 登录窗口已关闭，登录已取消/);
  assert.match(source, /\/subscription\/accounts/);
  assert.match(codex, /message\.method === "account\/updated"/);
  assert.match(codex, /stringField\(params, "authMode"\) === "chatgpt"/);
  assert.match(codex, /this\.#client\.request\("account\/read", \{ refreshToken: false \}\)/);
  assert.match(codex, /markLoginSucceeded\(loginId\)/);
  assert.doesNotMatch(source, /(?:window\.)?(?:localStorage|sessionStorage)\s*\./);
  assert.doesNotMatch(source, /account\/logout/);
});


test("Provider Host inherits Node proxy/system CA safely and classifies network failures", async () => {
  const source = await read("packages/settings/config-host-node/src/node-http-json.ts");
  const setup = await read("scripts/windows/lfaa-setup.ps1");
  assert.match(source, /setGlobalProxyFromEnv/);
  assert.match(source, /getCACertificates\("system"\)/);
  assert.match(source, /setDefaultCACertificates/);
  assert.match(source, /UND_ERR_CONNECT_TIMEOUT/);
  assert.match(source, /Provider 认证失败（HTTP 401）/);
  assert.doesNotMatch(source, /NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized\s*:\s*false/);
  assert.match(setup, /NODE_USE_ENV_PROXY/);
  assert.match(setup, /NODE_USE_SYSTEM_CA/);
  assert.ok(setup.includes("Windows\\CurrentVersion\\Internet Settings"));
  assert.match(setup, /NO_PROXY/);
  assert.match(setup, /Pop-LfaaProviderNetworkEnvironment/);
});

test("official usage surfaces never fabricate Provider balance and expose real Host routes", async () => {
  const codex = await read("packages/harness/codex-app-server/src/codex-app-server.ts");
  const bridge = await read("packages/api/settings-controller/src/ai-config-bridge.ts");
  const deepseek = await read("packages/settings/config-system/src/settings/ai/providers/deepseek/plugin.ts");
  const qwen = await read("packages/settings/config-system/src/settings/ai/providers/qwen/plugin.ts");
  const openai = await read("packages/settings/config-system/src/settings/ai/providers/openai/plugin.ts");
  const panel = await read("packages/client/ui/src/features/settings/ai/AiSettingsPanel.tsx");
  assert.match(codex, /account\/rateLimits\/read/);
  assert.match(codex, /account\/usage\/read/);
  assert.match(codex, /scope: "codex-work"/);
  assert.match(bridge, /usage/);
  assert.match(deepseek, /\/user\/balance/);
  assert.match(qwen, /\/api\/v1\/quotas/);
  assert.match(qwen, /Workspace ID/);
  assert.match(openai, /标准 ChatGPT Chat 消息额度/);
  assert.match(openai, /official-unavailable/);
  assert.match(panel, /官方余额 \/ 额度/);
  assert.match(panel, /刷新额度/);
  assert.match(panel, /官方未提供/);
  assert.doesNotMatch(panel, /Math\.random|估算余额|虚拟额度/);
});


test("AI settings save reuses a recent verified probe and official usage has loading/error/timeout terminal states", async () => {
  const bridge = await read("packages/api/settings-controller/src/ai-config-bridge.ts");
  const controller = await read("packages/client/app-shell/src/workbench/settings/logic/useAiSettingsController.ts");
  const client = await read("packages/client/connection/src/ai-settings-client.ts");
  const panel = await read("packages/client/ui/src/features/settings/ai/AiSettingsPanel.tsx");
  assert.match(bridge, /VERIFIED_PROBE_TTL_MS/);
  assert.match(bridge, /probeFingerprint/);
  assert.match(bridge, /takeProbe\(draft, secret\)/);
  assert.match(controller, /state: "loading"/);
  assert.match(controller, /state: "error"/);
  assert.match(client, /USAGE_REQUEST_TIMEOUT_MS/);
  assert.match(client, /官方余额 \/ 额度读取超时/);
  assert.match(panel, /读取失败/);
  assert.match(panel, /尚未读取官方状态/);
  assert.match(panel, /保存本地配置/);
});

test("left mode switch popover can escape the resizable left pane clipping context", async () => {
  const workbenchCss = await read("packages/client/ui/src/workbench/workbench.css");
  const leftCss = await read("packages/client/app-shell/src/workbench/left/styles/LeftSidebar.module.css");
  assert.match(workbenchCss, /\.lfaa-workbench__pane--left[\s\S]*overflow: visible/);
  assert.match(workbenchCss, /\.lfaa-workbench__pane--left[\s\S]*z-index: 70/);
  assert.match(leftCss, /--lfaa-layer-popover/);
});

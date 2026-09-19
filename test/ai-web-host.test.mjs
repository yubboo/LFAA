import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Windows Secret adapter uses a stable Credential Manager helper and stdin only", async () => {
  const source = await read("apps/web/dev/bridges/ai/windows-credential-manager.ts");
  const helper = await read("apps/web/dev/bridges/ai/windows-credential-manager.ps1");
  assert.match(source, /"-File"/);
  assert.match(source, /windows-credential-manager\.ps1/);
  assert.match(source, /child\.stdin\.end\(JSON\.stringify\(payload\), "utf8"\)/);
  assert.doesNotMatch(source, /"-Command"/);
  assert.doesNotMatch(source, /cmdkey/i);
  assert.doesNotMatch(source, /writeFile\([^\n]*secret/i);
  assert.match(helper, /CredWriteW/);
  assert.match(helper, /CredReadW/);
  assert.match(helper, /CredDeleteW/);
});

test("Windows Credential helper verifies writes by reading them back", async () => {
  const helper = await read("apps/web/dev/bridges/ai/windows-credential-manager.ps1");
  assert.match(helper, /WriteLocalMachine/);
  assert.match(helper, /PersistLocalMachine = 2/);
  assert.match(helper, /verify-read/);
  assert.match(helper, /verify-content/);
  assert.match(helper, /\$verified -cne \$secret/);
  assert.match(helper, /valueBase64/);
});

test("Windows Credential helper reports stage and Win32 code without secret diagnostics", async () => {
  const source = await read("apps/web/dev/bridges/ai/windows-credential-manager.ts");
  const helper = await read("apps/web/dev/bridges/ai/windows-credential-manager.ps1");
  assert.match(source, /Win32 \${result\.code}/);
  assert.match(source, /STAGE_LABELS/);
  assert.match(helper, /Get-Win32Message/);
  assert.match(helper, /stage = 'write'; code = \$writeCode/);
  assert.doesNotMatch(helper, /Write-Host.*secret/i);
});

test("Windows Credential helper is UTF-8 BOM encoded for Windows PowerShell", async () => {
  const bytes = await readFile(new URL("../apps/web/dev/bridges/ai/windows-credential-manager.ps1", import.meta.url));
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
});

test("account metadata repository rejects plaintext secret field names", async () => {
  const source = await read("apps/web/dev/bridges/ai/account-state-repository.ts");
  assert.match(source, /assertNoPlaintextSecret/);
  assert.match(source, /ai-accounts\.json/);
  assert.doesNotMatch(source, /credentialRef\s*:\s*secret/);
});

test("browser AI client never uses localStorage or sessionStorage for credentials", async () => {
  const source = await read("apps/web/src/host/ai-settings-client.ts");
  assert.doesNotMatch(source, /(?:window\.)?(?:localStorage|sessionStorage)\s*\./);
  assert.match(source, /\/__lfaa\/dev\/ai/);
});

test("Vite bridge enforces local origin and redacts common key prefixes", async () => {
  const source = await read("apps/web/dev/bridges/ai/ai-config-bridge.ts");
  assert.match(source, /ensureSameOrigin/);
  assert.match(source, /\[REDACTED\]/);
  assert.match(source, /MAX_BODY/);
});

test("UI renders password input and leaves Provider network calls to host", async () => {
  const panel = await read("packages/ui/src/features/settings/ai/AiSettingsPanel.tsx");
  assert.match(panel, /type="password"/);
  assert.doesNotMatch(panel, /fetch\s*\(/);
  assert.doesNotMatch(panel, /(?:window\.)?(?:localStorage|sessionStorage)\s*\./);
  assert.match(panel, /模型 ID（可选）/);
  assert.match(panel, /onSelectAccountModel/);
});


test("Provider HTTP adapter never forwards remote error body to UI", async () => {
  const source = await read("apps/web/dev/bridges/ai/node-http-json.ts");
  assert.match(source, /Provider 返回 HTTP/);
  assert.doesNotMatch(source, /body\.error|body\.message|candidate/);
});


test("Vite native config chain uses explicit TypeScript extensions", async () => {
  const viteConfig = await read("apps/web/vite.config.ts");
  const bridge = await read("apps/web/dev/bridges/ai/ai-config-bridge.ts");
  const tsconfig = JSON.parse(await read("apps/web/tsconfig.json"));
  assert.match(viteConfig, /from "\.\/dev\/bridges\/ai\/ai-config-bridge\.ts"/);
  assert.match(bridge, /from "\.\/account-state-repository\.ts"/);
  assert.match(bridge, /from "\.\/node-http-json\.ts"/);
  assert.match(bridge, /from "\.\/windows-credential-manager\.ts"/);
  assert.match(bridge, /createWebDevSecretStore\(projectRoot\)/);
  assert.equal(tsconfig.compilerOptions.allowImportingTsExtensions, true);
});

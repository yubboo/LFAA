import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Web Secret adapter uses Rust broker binary protocol and never PowerShell/C#", async () => {
  const source = await read("apps/web/dev/bridges/ai/rust-secret-store.ts");
  const rust = await read("crates/secret-store/src/lib.rs");
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
  const rust = await read("crates/secret-store/src/lib.rs");
  assert.match(rust, /CRED_PERSIST_LOCAL_MACHINE/);
  assert.match(rust, /write_raw\(target, secret\)/);
  assert.match(rust, /read\(target, Stage::VerifyRead\)/);
  assert.match(rust, /Stage::VerifyContent/);
  assert.match(rust, /Ok\(Some\(value\)\) if value == secret => Ok\(\(\)\)/);
});

test("Rust Secret broker keeps secret out of argv env logs and files", async () => {
  const source = await read("apps/web/dev/bridges/ai/rust-secret-store.ts");
  assert.match(source, /spawn\(executable, \[\]/);
  assert.match(source, /stdio: \["pipe", "pipe", "pipe"\]/);
  assert.doesNotMatch(source, /env:\s*\{[^}]*secret/is);
  assert.doesNotMatch(source, /writeFile|appendFile/);
  assert.doesNotMatch(source, /console\.(?:log|error).*secret/i);
});

test("account metadata repository rejects plaintext secret field names and migrates modelSettings", async () => {
  const source = await read("apps/web/dev/bridges/ai/account-state-repository.ts");
  assert.match(source, /assertNoPlaintextSecret/);
  assert.match(source, /ai-accounts\.json/);
  assert.match(source, /modelSettings: account\.modelSettings \?\? \{\}/);
  assert.doesNotMatch(source, /credentialRef\s*:\s*secret/);
});

test("browser AI client never uses browser storage for credentials", async () => {
  const source = await read("apps/web/src/host/ai-settings-client.ts");
  assert.doesNotMatch(source, /(?:window\.)?(?:localStorage|sessionStorage)\s*\./);
  assert.match(source, /\/__lfaa\/dev\/ai/);
  assert.match(source, /modelSettings/);
});

test("Vite bridge enforces local origin and redacts common key prefixes", async () => {
  const source = await read("apps/web/dev/bridges/ai/ai-config-bridge.ts");
  assert.match(source, /ensureSameOrigin/);
  assert.match(source, /\[REDACTED\]/);
  assert.match(source, /MAX_BODY/);
  assert.match(source, /createWebDevSecretStore\(projectRoot\)/);
});

test("UI renders official model capabilities without Provider network logic", async () => {
  const panel = await read("packages/ui/src/features/settings/ai/AiSettingsPanel.tsx");
  assert.match(panel, /type="password"/);
  assert.match(panel, /ModelCapabilityEditor/);
  assert.match(panel, /模型 ID 来源/);
  assert.match(panel, /requestPath/);
  assert.doesNotMatch(panel, /模型 ID（可选）/);
  assert.doesNotMatch(panel, /fetch\s*\(/);
  assert.doesNotMatch(panel, /(?:window\.)?(?:localStorage|sessionStorage)\s*\./);
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
  assert.match(bridge, /from "\.\/rust-secret-store\.ts"/);
  assert.equal(tsconfig.compilerOptions.allowImportingTsExtensions, true);
});

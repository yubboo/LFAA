import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Windows Secret adapter uses Credential Manager and stdin, not plain files", async () => {
  const source = await read("apps/web/dev/bridges/ai/windows-credential-manager.ts");
  assert.match(source, /CredWriteW/);
  assert.match(source, /CredReadW/);
  assert.match(source, /child\.stdin\.end\(JSON\.stringify\(payload\)\)/);
  assert.doesNotMatch(source, /writeFile\([^\n]*secret/i);
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

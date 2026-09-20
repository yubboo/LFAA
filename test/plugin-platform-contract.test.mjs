import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(file, "utf8");

test("plugin sdk owns canonical capability and app-pack contracts", () => {
  const source = read("packages/plugin/plugin-sdk/src/contracts.ts");
  assert.match(source, /type LfaaCapabilityKind/);
  assert.match(source, /"app-pack"/);
  assert.match(source, /LFAA_PLUGIN_API_VERSION = 2/);
  assert.match(source, /interface LfaaPluginManifest/);
  assert.match(source, /extensions\?: LfaaExtensionBag/);
  assert.match(source, /interface LfaaExternalAdapter/);
});

test("plugin runtime owns generation registry instead of execution", () => {
  const source = read("packages/plugin/plugin-runtime/src/registry.ts");
  assert.match(source, /class PluginRegistry/);
  assert.match(source, /generation/);
  assert.match(source, /register\(manifest/);
  assert.match(source, /Unsupported plugin API/);
  assert.match(source, /unregister\(pluginId/);
  assert.doesNotMatch(source, /child_process|spawn\(|exec\(|fetch\(/);
});

test("agent runtime reuses plugin capability vocabulary", () => {
  const source = read("packages/core/agent-runtime/src/core/contracts.ts");
  assert.match(source, /@lfaa\/plugin-sdk/);
  assert.match(source, /AgentCapabilityDescriptor = LfaaCapabilityDescriptor/);
  assert.doesNotMatch(source, /export interface AgentCapabilityDescriptor/);
});

test("language ownership gate protects TS product plane and Rust kernel", () => {
  const source = read("scripts/language-ownership-check.mjs");
  assert.match(source, /\["apps", "packages"\]/);
  assert.match(source, /walk\("native"/);
  assert.match(source, /Frozen Rust Native Kernel/);
  assert.match(source, /openai\|chatgpt\|deepseek\|codex\|minecraft\|workbench/);
  assert.match(source, /runtimes\/python/);
});

test("plugin manifests declare credential needs without carrying secret values", () => {
  const contract = read("packages/plugin/plugin-sdk/src/contracts.ts");
  const registry = read("packages/plugin/plugin-runtime/src/registry.ts");
  const credentials = read("packages/credentials/credentials/src/index.ts");
  assert.match(contract, /interface LfaaCredentialRequirement/);
  assert.match(contract, /"host-mediated" \| "isolated-process"/);
  assert.match(registry, /assertNoSecretMaterial/);
  assert.match(registry, /use credentialRef binding instead/);
  assert.match(credentials, /interface CredentialStorePort/);
  assert.doesNotMatch(credentials, /localStorage|sessionStorage/);
});

test("plugin package manager is isolated from browser/runtime contracts", () => {
  const lifecycle = read("packages/plugin/plugin-runtime/src/lifecycle.ts");
  const host = read("packages/plugin/plugin-host-node/src/index.ts");
  assert.match(lifecycle, /interface PluginPackageHostPort/);
  assert.doesNotMatch(lifecycle, /from ["']node:(?:child_process|fs)["']|import\s+.*(?:pnpm|child_process|node:fs)/);
  assert.match(host, /resolveLfaaHomePaths/);
  assert.match(host, /home\.plugins/);
  assert.doesNotMatch(host, /projectRoot.*\.lfaa.*plugin-profile/s);
  assert.match(host, /strictDepBuilds: true/);
  assert.match(host, /rolling-back|rollback/);
  assert.match(host, /approvedBuilds/);
  assert.match(host, /redactCredentialText/);
  assert.match(host, /安装与启用分两步/);
});

test("plugin install source is inspected before transactional install", () => {
  const parser = read("packages/plugin/plugin-runtime/src/install-spec.ts");
  const lifecycle = read("packages/plugin/plugin-runtime/src/lifecycle.ts");
  assert.match(parser, /"registry"/);
  assert.match(parser, /"path"/);
  assert.match(parser, /"git"/);
  assert.match(parser, /"tarball"/);
  assert.match(parser, /不能携带用户名、密码或 query Secret/);
  assert.match(lifecycle, /phase: "inspecting"/);
  assert.match(lifecycle, /this\.inspect\(rawSpec\)/);
});

test("plugin transaction pins registry version and revalidates inspected capability identity", () => {
  const lifecycle = read("packages/plugin/plugin-runtime/src/lifecycle.ts");
  const host = read("packages/plugin/plugin-host-node/src/index.ts");
  assert.match(lifecycle, /inspectionFingerprint/);
  assert.match(host, /createHash\("sha256"\)/);
  assert.match(host, /inspection\.sourceKind === "registry"/);
  assert.match(host, /`\$\{inspection\.packageName\}@\$\{inspection\.packageVersion\}`/);
  assert.match(host, /committedFingerprint !== inspection\.inspectionFingerprint/);
});

test("plugin build policy stays strict and rejects broad or YAML-indirect approvals", () => {
  const host = read("packages/plugin/plugin-host-node/src/index.ts");
  assert.match(host, /assertSafePluginWorkspacePolicy/);
  assert.match(host, /strictDepBuilds: true/);
  assert.match(host, /dangerouslyAllowAllBuilds/);
  assert.match(host, /YAML anchor\/alias/);
  assert.match(host, /build approval 包名无效/);
});

test("offline acceptance fixture is a manifest-only package with no install scripts", () => {
  const fixture = JSON.parse(read("test/fixtures/lfaa-plugin-basic/package.json"));
  assert.equal(fixture.name, "@lfaa-test/basic-plugin");
  assert.equal(fixture.lfaa.plugin.pluginApiVersion, 2);
  assert.equal(fixture.lfaa.plugin.pluginId, "test/basic-plugin");
  assert.equal(fixture.scripts, undefined);
  assert.equal(fixture.dependencies, undefined);
});

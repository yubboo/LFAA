/**
 * 文件：workspace-sync-idempotency.test.mjs
 * 作用：锁定版本包同步时“依赖声明未变化就保留稳定工作区 lockfile”的幂等契约。
 * 负责：声明指纹、pnpm-lock 保护、真实依赖变化时解除保护。
 * 不负责：在 Linux 容器真正执行 Windows PowerShell 或 pnpm install。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sync = fs.readFileSync("scripts/windows/lfaa-sync.ps1", "utf8");

function functionBody(name) {
  const startToken = `function ${name} {`;
  const start = sync.indexOf(startToken);
  assert.notEqual(start, -1, `missing PowerShell function ${name}`);
  const next = sync.indexOf("\nfunction ", start + startToken.length);
  return sync.slice(start, next === -1 ? sync.length : next);
}

test("sync fingerprints dependency declarations instead of product version", () => {
  const fingerprint = functionBody("Get-DependencyDeclarationFingerprint");
  for (const token of ["pnpm-workspace.yaml", "package.json", "dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    assert.ok(fingerprint.includes(token), `missing dependency declaration input: ${token}`);
  }
  assert.doesNotMatch(fingerprint, /lfaa\.release\.json|displayVersion|releaseSequence/i);
});

test("unchanged declarations preserve a stable workspace lockfile", () => {
  const preserve = functionBody("Should-PreserveTargetPnpmLock");
  assert.match(preserve, /Get-DependencyDeclarationFingerprint \$SourceRoot/);
  assert.match(preserve, /Get-DependencyDeclarationFingerprint \$DestinationRoot/);
  assert.match(preserve, /if \(\$sourceFingerprint -ne \$targetFingerprint\) \{ return \$false \}/);
  assert.match(preserve, /return \(\$targetLength -ge \$sourceLength\)/);
  assert.match(sync, /\$script:PreserveTargetPnpmLock = Should-PreserveTargetPnpmLock/);
  assert.match(sync, /依赖声明未变化，保留稳定工作区现有 pnpm-lock\.yaml/);
});

test("protected-path logic skips pnpm-lock only when preservation was proven", () => {
  const protectedPath = functionBody("Test-ProtectedPath");
  assert.match(protectedPath, /\$script:PreserveTargetPnpmLock -and \$rel -ieq "pnpm-lock\.yaml"/);
  assert.doesNotMatch(protectedPath, /if \(\$rel -ieq "pnpm-lock\.yaml"\) \{\s*return \$true/s);
});

test("real dependency declaration changes deliberately disable lock preservation", () => {
  const preserve = functionBody("Should-PreserveTargetPnpmLock");
  const mismatch = preserve.indexOf("if ($sourceFingerprint -ne $targetFingerprint) { return $false }");
  const lengthDecision = preserve.indexOf("return ($targetLength -ge $sourceLength)");
  assert.ok(mismatch >= 0 && lengthDecision > mismatch, "dependency mismatch must win before lock size heuristic");
});

test("source package preflight runs before diff planning and any destructive sync", () => {
  const sourcePreflight = sync.indexOf("Assert-SourcePackageIntegrity $ProjectRoot");
  const plan = sync.indexOf("$plan = Get-SyncPlan $ProjectRoot $TargetRoot");
  const apply = sync.indexOf('Write-Label "【同步】" "【进行中】" "开始应用文件变化..."');
  assert.ok(sourcePreflight >= 0, "source package preflight call is missing");
  assert.ok(plan > sourcePreflight, "source package must pass preflight before diff planning");
  assert.ok(apply > plan, "destructive sync must stay after validated plan");

  const integrity = functionBody("Assert-SourcePackageIntegrity");
  assert.match(integrity, /scripts\\workspace-preflight\.mjs/);
  assert.match(integrity, /稳定工作区尚未被修改/);
  assert.match(integrity, /源版本包预检失败/);
});

test("source path encoding check requires canonical Unicode paths before claiming success", () => {
  const encoding = functionBody("Assert-SourcePathEncoding");
  assert.match(sync, /\$RequiredUnicodeSourcePaths = @\(/);
  assert.match(sync, /docs\/项目结构与代码地图\.md/);
  assert.match(encoding, /\$missingCanonical/);
  assert.match(encoding, /ZIP 文件名 UTF-8 标记缺失/);
  assert.match(encoding, /源版本包 Unicode 路径不完整/);
  assert.ok(encoding.indexOf("$missingCanonical.Count -gt 0") < encoding.indexOf("源版本包文件名编码正常"));
});

test("local .lfaa runtime state remains protected from mirror deletion", () => {
  const protectedPath = functionBody("Test-ProtectedPath");
  const expected = String.raw`if ($rel -imatch "^\.lfaa/(cache|state|tmp|logs)(/|$)") { return $true }`;
  assert.ok(protectedPath.includes(expected), ".lfaa local runtime directories must use a literal-dot regex");
  assert.ok(!protectedPath.includes(String.raw`"^\\.lfaa/(cache|state|tmp|logs)(/|$)"`), "double-backslash regex would match a backslash, not the .lfaa directory");
});

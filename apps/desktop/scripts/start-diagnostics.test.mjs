// 桌面端启动失败诊断回归测试：覆盖低完整性标记识别、ACL 识别与 --no-sandbox 回退边界。
// 关联：apps/desktop/scripts/start-diagnostics.mjs；运行环境：Node.js（node:test）。
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  ALL_APP_PACKAGES_GRANT,
  MEDIUM_INTEGRITY_LEVEL,
  classifyLaunchFailure,
  findStaleArtifacts,
  formatAclGrantCommand,
  formatIntegrityRepairCommand,
  hasAllApplicationPackagesAcl,
  hasLowIntegrityLabel,
  isBreakpointExit,
} from "./start-diagnostics.mjs";

const SAMPLE_ACL_WITHOUT_APP_PACKAGES = [
  "E:\\lfaa\\node_modules\\.pnpm\\electron\\dist Everyone:(I)(CI)(DENY)(DC)",
  "  S-1-4-869845669-769329722:(I)(OI)(CI)(W,D,DC)",
  "  BUILTIN\\Administrators:(I)(F)",
  "  Mandatory Label\\Low Mandatory Level:(I)(NW)",
].join("\n");

const SAMPLE_ACL_WITH_APP_PACKAGES = [
  "E:\\lfaa\\node_modules\\.pnpm\\electron\\dist BUILTIN\\Administrators:(I)(F)",
  "  APPLICATION PACKAGE AUTHORITY\\ALL APPLICATION PACKAGES:(OI)(CI)(RX)",
].join("\n");

describe("start-diagnostics", () => {
  it("recognizes unsigned and signed STATUS_BREAKPOINT exit codes", () => {
    assert.equal(isBreakpointExit(0x80000003), true);
    assert.equal(isBreakpointExit(-2147483645), true);
    assert.equal(isBreakpointExit(1), false);
    assert.equal(isBreakpointExit(0), false);
  });

  it("detects ALL APPLICATION PACKAGES presence in icacls output", () => {
    assert.equal(hasAllApplicationPackagesAcl(SAMPLE_ACL_WITHOUT_APP_PACKAGES), false);
    assert.equal(hasAllApplicationPackagesAcl(SAMPLE_ACL_WITH_APP_PACKAGES), true);
    assert.equal(hasAllApplicationPackagesAcl("S-1-15-2-1:(OI)(CI)(RX)"), true);
  });

  it("detects Low Mandatory Level integrity label in icacls output", () => {
    assert.equal(hasLowIntegrityLabel(SAMPLE_ACL_WITHOUT_APP_PACKAGES), true);
    assert.equal(hasLowIntegrityLabel(SAMPLE_ACL_WITH_APP_PACKAGES), false);
    assert.equal(hasLowIntegrityLabel("S-1-16-4096:(NW)"), true);
  });

  it("formats standard icacls grant and integrity repair commands", () => {
    const dir = "E:\\lfaa\\node_modules\\electron\\dist";
    assert.equal(formatAclGrantCommand(dir), `icacls "${dir}" /grant ${ALL_APP_PACKAGES_GRANT}`);
    assert.equal(
      formatIntegrityRepairCommand(dir),
      `icacls "${dir}" /setintegritylevel "${MEDIUM_INTEGRITY_LEVEL}" /T`,
    );
  });

  it("prefers ACL auto-repair over --no-sandbox when ALL APPLICATION PACKAGES is missing", () => {
    const targetDir = "E:\\lfaa\\node_modules\\electron\\dist";
    const first = classifyLaunchFailure({
      code: 0x80000003,
      noSandbox: false,
      aclRepairAttempted: false,
      missingAppPackagesAcl: true,
      platform: "win32",
      targetDir,
    });
    assert.deepEqual(first, {
      kind: "repair-acl",
      targetDir,
      grantCommand: `icacls "${targetDir}" /grant ${ALL_APP_PACKAGES_GRANT}`,
    });

    const second = classifyLaunchFailure({
      code: 0x80000003,
      noSandbox: false,
      aclRepairAttempted: true,
      missingAppPackagesAcl: true,
      platform: "win32",
      targetDir,
    });
    assert.equal(second.kind, "acl-failed");
  });

  it("retries with --no-sandbox when ACL is healthy and 0x80000003 occurs", () => {
    const decision = classifyLaunchFailure({
      code: 0x80000003,
      noSandbox: false,
      aclRepairAttempted: false,
      missingAppPackagesAcl: false,
      platform: "win32",
      targetDir: "E:\\lfaa\\node_modules\\electron\\dist",
    });
    assert.deepEqual(decision, { kind: "retry-no-sandbox" });
  });

  it("exits directly for non-breakpoint exit codes or after --no-sandbox retry", () => {
    assert.deepEqual(
      classifyLaunchFailure({
        code: 1,
        noSandbox: false,
        aclRepairAttempted: false,
        missingAppPackagesAcl: true,
        platform: "win32",
      }),
      { kind: "exit" },
    );
    assert.deepEqual(
      classifyLaunchFailure({
        code: 0x80000003,
        noSandbox: true,
        aclRepairAttempted: false,
        missingAppPackagesAcl: false,
        platform: "win32",
      }),
      { kind: "exit" },
    );
  });

  it("detects missing and stale build artifacts against source directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-stale-check-"));
    try {
      const srcDir = join(root, "src");
      const outFile = join(root, "lib", "index.js");
      await mkdir(srcDir, { recursive: true });
      await writeFile(join(srcDir, "index.ts"), "export const v = 1;", "utf8");

      // 产物不存在时标记为 missing
      const missing = findStaleArtifacts([
        { name: "pkg", outputPath: outFile, sourceDirs: [srcDir], rebuildKind: "workspace" },
      ]);
      assert.equal(missing.length, 1);
      assert.equal(missing[0]?.reason, "missing");

      // 产物比源码新时为空
      await mkdir(join(root, "lib"), { recursive: true });
      await writeFile(outFile, "export const v = 1;", "utf8");
      const past = new Date(Date.now() - 10_000);
      await utimes(join(srcDir, "index.ts"), past, past);
      assert.deepEqual(
        findStaleArtifacts([{ name: "pkg", outputPath: outFile, sourceDirs: [srcDir], rebuildKind: "workspace" }]),
        [],
      );

      // 源码更新后标记为 stale
      const future = new Date(Date.now() + 10_000);
      await utimes(join(srcDir, "index.ts"), future, future);
      const stale = findStaleArtifacts([
        { name: "pkg", outputPath: outFile, sourceDirs: [srcDir], rebuildKind: "workspace" },
      ]);
      assert.equal(stale.length, 1);
      assert.equal(stale[0]?.reason, "stale");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

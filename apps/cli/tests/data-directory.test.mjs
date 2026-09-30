/**
 * 功能：验证 LFAA 默认数据目录在 Windows 固定盘和可移动盘上的归属规则。
 * 作用：确保固定盘采用当前用户目录、可移动盘数据跟随项目，并保留显式覆盖行为。
 * 关联文件：scripts/resolve-data-directory.mjs、packages/util/launch-environment/src/config.ts、packages/host/daemon/src/daemon.mjs。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolveDataDirectory } from "lfaa-home-paths/src/resolve-data-directory.mjs";

const projectRoot = "C:\\Portable\\LFAA";
const userProfile = "C:\\Users\\tester";

test("fixed Windows drive stores default data under this user's profile", () => {
  assert.equal(
    resolveDataDirectory(projectRoot, "data", { platform: "win32", driveType: "Fixed", userProfile }),
    "C:\\Users\\tester\\.LFAA\\data"
  );
});

test("removable Windows drive keeps default data beside the project", () => {
  assert.equal(
    resolveDataDirectory(projectRoot, "data", { platform: "win32", driveType: "Removable", userProfile }),
    "C:\\Portable\\LFAA\\data"
  );
});

test("the normalized default relative path also follows the removable project", () => {
  assert.equal(
    resolveDataDirectory(projectRoot, ".\\data", { platform: "win32", driveType: "Removable", userProfile }),
    "C:\\Portable\\LFAA\\data"
  );
});

test("explicit absolute and custom relative data directories keep their meaning", () => {
  assert.equal(
    resolveDataDirectory(projectRoot, "D:\\LFAA-Data", { platform: "win32" }),
    "D:\\LFAA-Data"
  );
  assert.equal(
    resolveDataDirectory(projectRoot, "shared-data", { platform: "win32" }),
    "C:\\Portable\\LFAA\\shared-data"
  );
});

test("unknown drive state and missing fixed-drive user profile fail closed", () => {
  assert.throws(
    () => resolveDataDirectory(projectRoot, "data", { platform: "win32", driveType: "Unknown", userProfile }),
    /请设置 LFAA_DATA_DIR/u
  );
  assert.throws(
    () => resolveDataDirectory(projectRoot, "data", { platform: "win32", driveType: "Fixed", userProfile: "" }),
    /USERPROFILE/u
  );
});

test("non-Windows default remains relative to the repository", () => {
  assert.equal(
    resolveDataDirectory("/workspace/LFAA", "data", { platform: "linux" }),
    "/workspace/LFAA/data"
  );
});

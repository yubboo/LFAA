/** 功能：校验凭据目录的真实 OS 权限。作用：覆盖 Windows ACL/POSIX 模式与符号链接拒绝。关联文件：util/home-paths/private-directory.mjs。 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, statSync, symlinkSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { protectPrivateDirectory } from "../../packages/util/home-paths/src/private-directory.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
test("凭据目录收紧既有文件继承权限，拒绝重定向目录", () => {
  const parent = resolve(root, "dist/.tmp"); mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-private-directory-"));
  try {
    const directory = join(data, "credentials"); mkdirSync(directory); writeFileSync(join(directory, "fixture.key"), "fixture only");
    protectPrivateDirectory(directory);
    if (process.platform === "win32") {
      const script = "$d=$env:LFAA_PRIVATE_DIRECTORY;$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$a=[System.IO.Directory]::GetAccessControl($d);$f=[System.IO.File]::GetAccessControl([System.IO.Path]::Combine($d,'fixture.key'));@{owner=$sid;protected=$a.AreAccessRulesProtected;directory=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])|ForEach-Object{$_.IdentityReference.Value});file=@($f.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])|ForEach-Object{$_.IdentityReference.Value})}|ConvertTo-Json -Compress";
      const acl = JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true, env: { ...process.env, LFAA_PRIVATE_DIRECTORY: directory }, encoding: "utf8", timeout: 15_000 }));
      assert.equal(acl.protected, true);
      const allowed = new Set([acl.owner, "S-1-5-18", "S-1-5-32-544"]);
      assert.deepEqual(new Set(acl.directory), allowed); assert.deepEqual(new Set(acl.file), allowed);
    } else assert.equal(statSync(directory).mode & 0o777, 0o700);
    const link = join(data, "redirect"); symlinkSync(directory, link, process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => protectPrivateDirectory(link), /符号链接/);
  } finally { assert.equal(dirname(data), parent); rmSync(data, { recursive: true, force: true }); }
});

/**
 * 功能：保护本机凭据目录的操作系统访问权限。
 * 作用：POSIX 使用 0700；Windows 设置仅当前 OS 账户、SYSTEM 和管理员可访问的继承 ACL。
 * 关联文件：launch-environment/src/config.ts、settings/settings/src/service.ts、host/daemon/src/daemon.mjs。
 */
import { chmodSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const protectedDirectories = new Set();
export function protectPrivateDirectory(path) {
  const directory = resolve(path);
  if (protectedDirectories.has(directory)) return;
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const actual = realpathSync(directory);
  const samePath = process.platform === "win32" ? actual.toLocaleLowerCase("en-US") === directory.toLocaleLowerCase("en-US") : actual === directory;
  if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink() || !samePath) {
    throw new Error("凭据目录必须是实际目录，不能通过符号链接重定向。");
  }
  if (process.platform === "win32") {
    // 路径只经环境变量传入固定脚本，不拼接 Shell；不依赖本地化账户名或 0600 的 Windows 映射。
    const script = `
      $ErrorActionPreference = 'Stop'
      $target = $env:LFAA_PRIVATE_DIRECTORY
      $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
      $acl = [System.Security.AccessControl.DirectorySecurity]::new()
      $acl.SetAccessRuleProtection($true, $false)
      $acl.SetOwner($identity)
      foreach ($sid in @($identity, [System.Security.Principal.SecurityIdentifier]::new('S-1-5-18'), [System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) {
        $rule = [System.Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
      }
      [System.IO.Directory]::SetAccessControl($target, $acl)
    `;
    try {
      execFileSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
        windowsHide: true, timeout: 15_000, stdio: "pipe", env: { ...process.env, LFAA_PRIVATE_DIRECTORY: directory }
      });
    } catch { throw new Error("无法设置凭据目录的 Windows 访问权限，已拒绝继续读取或创建密钥。"); }
  } else chmodSync(directory, 0o700);
  protectedDirectories.add(directory);
}

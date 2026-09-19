/**
 * 文件：windows-credential-manager.ts
 * 作用：Web 开发宿主在 Windows 上使用 Credential Manager 保存 AI Secret。
 * 负责：Generic Credential 的写入、读取、删除；非 Windows 提供明确的内存 fallback。
 * 不负责：账户元数据、Provider 网络请求、浏览器 UI。
 * 状态归属：Windows Credential Manager 或当前 Vite 进程内存。
 * 对外接口：createWebDevSecretStore。
 * 关联文件：ai-config-bridge.ts、@lfaa/config-system AiSecretStorePort。
 * 修改注意事项：Secret 只能通过 stdin 进入 PowerShell，禁止放进命令行参数、日志或普通文件。
 */
import { spawn } from "node:child_process";
import type { AiSecretStorePort } from "@lfaa/config-system";

const POWERSHELL = String.raw`
$ErrorActionPreference = 'Stop'
$source = @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;

public static class LfaaCredentialManager {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public UInt32 Flags;
    public UInt32 Type;
    [MarshalAs(UnmanagedType.LPWStr)] public string TargetName;
    [MarshalAs(UnmanagedType.LPWStr)] public string Comment;
    public FILETIME LastWritten;
    public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob;
    public UInt32 Persist;
    public UInt32 AttributeCount;
    public IntPtr Attributes;
    [MarshalAs(UnmanagedType.LPWStr)] public string TargetAlias;
    [MarshalAs(UnmanagedType.LPWStr)] public string UserName;
  }

  [DllImport("advapi32.dll", EntryPoint="CredWriteW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool CredWrite(ref CREDENTIAL credential, UInt32 flags);
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credentialPtr);
  [DllImport("advapi32.dll", EntryPoint="CredDeleteW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool CredDelete(string target, UInt32 type, UInt32 flags);
  [DllImport("advapi32.dll", EntryPoint="CredFree", SetLastError=true)]
  static extern void CredFree(IntPtr buffer);

  const UInt32 Generic = 1;
  const UInt32 PersistLocalMachine = 2;

  public static void Write(string target, string secret) {
    byte[] bytes = Encoding.Unicode.GetBytes(secret);
    IntPtr blob = Marshal.AllocHGlobal(bytes.Length);
    try {
      Marshal.Copy(bytes, 0, blob, bytes.Length);
      var credential = new CREDENTIAL {
        Type = Generic,
        TargetName = target,
        Comment = "LFAA AI Provider credential",
        CredentialBlobSize = (UInt32)bytes.Length,
        CredentialBlob = blob,
        Persist = PersistLocalMachine,
        UserName = "LFAA"
      };
      if (!CredWrite(ref credential, 0)) throw new Win32Exception(Marshal.GetLastWin32Error());
    } finally { Marshal.FreeHGlobal(blob); }
  }

  public static string Read(string target) {
    IntPtr ptr;
    if (!CredRead(target, Generic, 0, out ptr)) {
      int code = Marshal.GetLastWin32Error();
      if (code == 1168) return null;
      throw new Win32Exception(code);
    }
    try {
      var credential = Marshal.PtrToStructure<CREDENTIAL>(ptr);
      byte[] bytes = new byte[credential.CredentialBlobSize];
      if (bytes.Length > 0) Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
      return Encoding.Unicode.GetString(bytes);
    } finally { CredFree(ptr); }
  }

  public static void Delete(string target) {
    if (!CredDelete(target, Generic, 0)) {
      int code = Marshal.GetLastWin32Error();
      if (code != 1168) throw new Win32Exception(code);
    }
  }
}
'@
Add-Type -TypeDefinition $source
$payloadText = [Console]::In.ReadToEnd()
$payload = $payloadText | ConvertFrom-Json
try {
  if ($payload.action -eq 'put') { [LfaaCredentialManager]::Write([string]$payload.target, [string]$payload.secret); @{ ok = $true } | ConvertTo-Json -Compress; exit 0 }
  if ($payload.action -eq 'get') { $value = [LfaaCredentialManager]::Read([string]$payload.target); @{ ok = $true; value = $value } | ConvertTo-Json -Compress; exit 0 }
  if ($payload.action -eq 'delete') { [LfaaCredentialManager]::Delete([string]$payload.target); @{ ok = $true } | ConvertTo-Json -Compress; exit 0 }
  throw 'Unknown credential action.'
} catch {
  @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
  exit 1
}
`;

interface CredentialResult { ok: boolean; value?: string | null; error?: string; }

function invokeCredentialManager(payload: Record<string, string>): Promise<CredentialResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", POWERSHELL], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { if (stdout.length < 64_000) stdout += chunk; });
    child.stderr.on("data", (chunk) => { if (stderr.length < 8_000) stderr += chunk; });
    child.on("error", reject);
    child.on("close", () => {
      try {
        const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
        const result = JSON.parse(lines.at(-1) ?? "{}") as CredentialResult;
        if (!result.ok) return reject(new Error(result.error || "Windows Credential Manager 操作失败。"));
        resolve(result);
      } catch {
        reject(new Error(stderr.trim() || "Windows Credential Manager 返回无效结果。"));
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

class WindowsCredentialStore implements AiSecretStorePort {
  readonly persistence = "os-credential-store" as const;
  async put(credentialRef: string, secret: string) { await invokeCredentialManager({ action: "put", target: credentialRef, secret }); }
  async get(credentialRef: string) { return (await invokeCredentialManager({ action: "get", target: credentialRef })).value ?? null; }
  async delete(credentialRef: string) { await invokeCredentialManager({ action: "delete", target: credentialRef }); }
}

class MemoryCredentialStore implements AiSecretStorePort {
  readonly persistence = "memory" as const;
  readonly #values = new Map<string, string>();
  async put(credentialRef: string, secret: string) { this.#values.set(credentialRef, secret); }
  async get(credentialRef: string) { return this.#values.get(credentialRef) ?? null; }
  async delete(credentialRef: string) { this.#values.delete(credentialRef); }
}

export function createWebDevSecretStore(): AiSecretStorePort {
  return process.platform === "win32" ? new WindowsCredentialStore() : new MemoryCredentialStore();
}

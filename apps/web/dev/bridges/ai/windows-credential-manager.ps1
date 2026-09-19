# 文件：windows-credential-manager.ps1
# 作用：Web 开发宿主的 Windows Credential Manager 原生 helper。
# 负责：通过 CredWriteW / CredReadW / CredDeleteW 管理 Generic Credential，并在写入后立即回读校验。
# 不负责：Provider 网络、账户元数据、UI、普通文件 Secret 存储。
# 状态归属：当前 Windows 用户 Credential Manager。
# 输入输出：stdin 接收 JSON；stdout 仅返回压缩 JSON 结果，禁止日志 Secret。
# 修改注意事项：Secret 不得进入命令行、环境变量、stderr 或普通文件；失败必须返回 stage + Win32 code。

$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$source = @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;

public static class LfaaCredentialManagerNative {
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

  [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool CredWrite(ref CREDENTIAL credential, UInt32 flags);

  [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credentialPtr);

  [DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool CredDelete(string target, UInt32 type, UInt32 flags);

  [DllImport("advapi32.dll", EntryPoint = "CredFree", SetLastError = false)]
  static extern void CredFree(IntPtr buffer);

  const UInt32 Generic = 1;
  const UInt32 PersistLocalMachine = 2;
  const int ErrorNotFound = 1168;
  const int MaxCredentialBlobBytes = 5 * 512;

  public static int WriteLocalMachine(string target, string secret) {
    byte[] bytes = Encoding.UTF8.GetBytes(secret ?? String.Empty);
    if (bytes.Length == 0 || bytes.Length > MaxCredentialBlobBytes) return 87;
    IntPtr blob = Marshal.AllocHGlobal(bytes.Length);
    try {
      Marshal.Copy(bytes, 0, blob, bytes.Length);
      var credential = new CREDENTIAL {
        Flags = 0,
        Type = Generic,
        TargetName = target,
        Comment = "LFAA AI Provider credential",
        CredentialBlobSize = (UInt32)bytes.Length,
        CredentialBlob = blob,
        Persist = PersistLocalMachine,
        AttributeCount = 0,
        Attributes = IntPtr.Zero,
        TargetAlias = null,
        UserName = null
      };
      return CredWrite(ref credential, 0) ? 0 : Marshal.GetLastWin32Error();
    } finally {
      Marshal.FreeHGlobal(blob);
    }
  }

  public static int Read(string target, out string secret) {
    secret = null;
    IntPtr ptr;
    if (!CredRead(target, Generic, 0, out ptr)) return Marshal.GetLastWin32Error();
    try {
      var credential = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));
      byte[] bytes = new byte[credential.CredentialBlobSize];
      if (bytes.Length > 0) Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
      secret = Encoding.UTF8.GetString(bytes);
      return 0;
    } finally {
      CredFree(ptr);
    }
  }

  public static int Delete(string target) {
    if (CredDelete(target, Generic, 0)) return 0;
    int code = Marshal.GetLastWin32Error();
    return code == ErrorNotFound ? 0 : code;
  }
}
'@

Add-Type -TypeDefinition $source -Language CSharp

function Write-Result([hashtable]$result, [int]$exitCode = 0) {
  $result | ConvertTo-Json -Compress -Depth 5
  exit $exitCode
}

function Get-Win32Message([int]$code) {
  if ($code -eq 0) { return '' }
  return ([System.ComponentModel.Win32Exception]::new($code)).Message
}

try {
  $payloadText = [Console]::In.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($payloadText)) {
    Write-Result @{ ok = $false; stage = 'input'; code = 0; error = 'Credential helper 未收到输入。' } 1
  }
  $payload = $payloadText | ConvertFrom-Json
  $action = [string]$payload.action
  $target = [string]$payload.target
  if ([string]::IsNullOrWhiteSpace($target)) {
    Write-Result @{ ok = $false; stage = 'input'; code = 87; error = 'Credential target 无效。' } 1
  }

  if ($action -eq 'put') {
    $secret = [string]$payload.secret
    $writeCode = [LfaaCredentialManagerNative]::WriteLocalMachine($target, $secret)
    if ($writeCode -ne 0) {
      Write-Result @{ ok = $false; stage = 'write'; code = $writeCode; error = (Get-Win32Message $writeCode) } 1
    }

    [string]$verified = $null
    $readCode = [LfaaCredentialManagerNative]::Read($target, [ref]$verified)
    if ($readCode -ne 0) {
      [void][LfaaCredentialManagerNative]::Delete($target)
      Write-Result @{ ok = $false; stage = 'verify-read'; code = $readCode; error = (Get-Win32Message $readCode) } 1
    }
    if ($verified -cne $secret) {
      [void][LfaaCredentialManagerNative]::Delete($target)
      Write-Result @{ ok = $false; stage = 'verify-content'; code = 0; error = 'Credential 回读内容不一致。' } 1
    }
    Write-Result @{ ok = $true; persistence = 'local-machine' }
  }

  if ($action -eq 'get') {
    [string]$value = $null
    $readCode = [LfaaCredentialManagerNative]::Read($target, [ref]$value)
    if ($readCode -eq 1168) { Write-Result @{ ok = $true; found = $false; valueBase64 = $null } }
    if ($readCode -ne 0) {
      Write-Result @{ ok = $false; stage = 'read'; code = $readCode; error = (Get-Win32Message $readCode) } 1
    }
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($value))
    Write-Result @{ ok = $true; found = $true; valueBase64 = $encoded }
  }

  if ($action -eq 'delete') {
    $deleteCode = [LfaaCredentialManagerNative]::Delete($target)
    if ($deleteCode -ne 0) {
      Write-Result @{ ok = $false; stage = 'delete'; code = $deleteCode; error = (Get-Win32Message $deleteCode) } 1
    }
    Write-Result @{ ok = $true }
  }

  Write-Result @{ ok = $false; stage = 'input'; code = 87; error = 'Unknown credential action.' } 1
} catch {
  $message = $_.Exception.Message
  if ($_.Exception.InnerException -and $_.Exception.InnerException.Message) { $message = $_.Exception.InnerException.Message }
  Write-Result @{ ok = $false; stage = 'helper'; code = 0; error = $message } 1
}

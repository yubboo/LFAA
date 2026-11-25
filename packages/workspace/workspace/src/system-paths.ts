// 负责动态解析本机文档目录（含 Windows 重定向路径）、安全目录名及原生文件夹选择器；严禁导入 React 或 DOM。
import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import type { FolderPickResult } from "./types";

const execFileAsync = promisify(execFile);

// 在 Windows 上读取用户实际配置的“文档”文件夹（如 D:\系统\文档），而非写死默认盘符。
export async function resolveUserDocumentsDir(overrideDir?: string): Promise<string> {
  if (overrideDir) return resolve(overrideDir);

  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Environment]::GetFolderPath('MyDocuments')",
        ],
        { timeout: 6000, windowsHide: true },
      );
      const detected = stdout.trim();
      if (detected) return resolve(detected);
    } catch {
      // 若系统调用异常则回退到用户主目录下的 Documents。
    }
  }

  const xdgDocuments = process.env.XDG_DOCUMENTS_DIR?.trim();
  if (xdgDocuments) return resolve(xdgDocuments);
  return join(homedir(), "Documents");
}

// 默认文件夹与项目同名，非法目录名应由用户调整或显式选择源文件夹。
export function resolveNamedSubfolder(baseDir: string, name: string): string {
  const reserved = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu;
  if (!name || name.length > 80 || /[<>:"/\\|?*\u0000-\u001F]/u.test(name) || name.endsWith(".") || reserved.test(name)) {
    throw new Error("项目名称不能作为本地文件夹名。请调整名称，或选择一个源文件夹。");
  }
  return join(baseDir, name);
}

const FOLDER_PICKER_CSHARP = `
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class LfaaNativeFolderPicker {
  private const uint FOS_PICKFOLDERS = 0x00000020u;
  private const uint FOS_FORCEFILESYSTEM = 0x00000040u;
  private const uint FOS_PATHMUSTEXIST = 0x00000800u;
  private const uint SIGDN_FILESYSPATH = 0x80058000u;
  private const uint ERROR_CANCELLED = 0x800704C7u;

  [DllImport("user32.dll")]
  private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

  [DllImport("user32.dll")]
  private static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  private static extern bool SetProcessDpiAwarenessContext(IntPtr value);

  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  private static extern int SHCreateItemFromParsingName(string pszPath, IntPtr pbc, ref Guid riid, out IShellItem ppv);

  public static void EnableHiDpi() {
    try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch {}
  }

  [DllImport("user32.dll")]
  private static extern IntPtr GetThreadDesktop(uint threadId);

  [DllImport("kernel32.dll")]
  private static extern uint GetCurrentThreadId();

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern bool GetUserObjectInformation(IntPtr hObj, int nIndex, StringBuilder pvInfo, int nLength, out int lpnLengthNeeded);

  [ComImport]
  [Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")]
  private class FileOpenDialogRCW {}

  [ComImport]
  [Guid("42f85136-db7e-439c-85f1-e4075d135fc8")]
  [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IFileDialog {
    [PreserveSig] uint Show(IntPtr parent);
    void SetFileTypes(uint cFileTypes, IntPtr rgFilterSpec);
    void SetFileTypeIndex(uint iFileType);
    void GetFileTypeIndex(out uint piFileType);
    void Advise(IntPtr pfde, out uint pdwCookie);
    void Unadvise(uint dwCookie);
    void SetOptions(uint fos);
    void GetOptions(out uint pfos);
    void SetDefaultFolder(IShellItem psi);
    void SetFolder(IShellItem psi);
    void GetFolder(out IShellItem ppsi);
    void GetCurrentSelection(out IShellItem ppsi);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string pszName);
    void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
    void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string pszText);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
    void GetResult(out IShellItem ppsi);
  }

  [ComImport]
  [Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe")]
  [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IShellItem {
    void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
    void GetParent(out IShellItem ppsi);
    void GetDisplayName(uint sigdnName, out IntPtr ppszName);
    void GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
    void Compare(IShellItem psi, uint hint, out int piOrder);
  }

  public static string GetCurrentDesktopName() {
    var name = new StringBuilder(128);
    int needed = 0;
    if (!GetUserObjectInformation(GetThreadDesktop(GetCurrentThreadId()), 2, name, name.Capacity, out needed)) {
      return string.Empty;
    }
    return name.ToString();
  }

  public static void PrepareOwner(IntPtr hwnd) {
    if (hwnd == IntPtr.Zero) return;
    ShowWindow(hwnd, 5);
    SetForegroundWindow(hwnd);
  }

  public static string PickFolder(IntPtr ownerHwnd, string title, string initialDir, bool dryRunOnly) {
    EnableHiDpi();
    if (!dryRunOnly) {
      string desktop = GetCurrentDesktopName();
      if (!string.IsNullOrEmpty(desktop) && !string.Equals(desktop, "Default", StringComparison.OrdinalIgnoreCase)) {
        return "LFAA_ISOLATED_DESKTOP:" + desktop;
      }
    }

    var dialog = (IFileDialog)new FileOpenDialogRCW();
    try {
      uint options;
      dialog.GetOptions(out options);
      dialog.SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
      dialog.SetTitle(title);
      dialog.SetOkButtonLabel("选择文件夹");
      if (!string.IsNullOrWhiteSpace(initialDir)) {
        Guid shellItemGuid = new Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe");
        IShellItem folderItem;
        if (SHCreateItemFromParsingName(initialDir, IntPtr.Zero, ref shellItemGuid, out folderItem) == 0 && folderItem != null) {
          try { dialog.SetFolder(folderItem); } finally { Marshal.ReleaseComObject(folderItem); }
        }
      }
      if (dryRunOnly) return "COM_READY";

      uint hr = dialog.Show(ownerHwnd);
      if (hr == ERROR_CANCELLED) return string.Empty;
      if (hr != 0u) Marshal.ThrowExceptionForHR(unchecked((int)hr));

      IShellItem item;
      dialog.GetResult(out item);
      if (item == null) return string.Empty;
      try {
        IntPtr pszPath;
        item.GetDisplayName(SIGDN_FILESYSPATH, out pszPath);
        try {
          return Marshal.PtrToStringUni(pszPath) ?? string.Empty;
        } finally {
          if (pszPath != IntPtr.Zero) Marshal.FreeCoTaskMem(pszPath);
        }
      } finally {
        Marshal.ReleaseComObject(item);
      }
    } finally {
      Marshal.ReleaseComObject(dialog);
    }
  }
}
`;

/** 生成 Host 调用 Windows 原生目录选择器的 PowerShell 脚本；首次编译后缓存 DLL 到 ~/.lfaa/cache，大幅消除后续打开延迟。 */
export function buildFolderPickerPowerShell(description: string, dryRunOnly = false, initialDir = ""): string {
  const escapedDescription = description.replaceAll("'", "''");
  const escapedInitialDir = initialDir.replaceAll("'", "''");
  const cacheDir = join(homedir(), ".lfaa", "cache").replaceAll("'", "''");
  const dllPath = join(homedir(), ".lfaa", "cache", "lfaa-folder-picker-v2.dll").replaceAll("'", "''");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    "[System.Windows.Forms.Application]::EnableVisualStyles()",
    `$dllPath = '${dllPath}'`,
    `if (Test-Path -LiteralPath $dllPath) { Add-Type -Path $dllPath } else {`,
    `  New-Item -ItemType Directory -Force -Path '${cacheDir}' | Out-Null`,
    "  $src = @'",
    FOLDER_PICKER_CSHARP.trim(),
    "'@",
    "  try { Add-Type -TypeDefinition $src -OutputAssembly $dllPath -OutputType Library; Add-Type -Path $dllPath } catch { Add-Type -TypeDefinition $src }",
    "}",
    "[LfaaNativeFolderPicker]::EnableHiDpi()",
    "$owner = New-Object System.Windows.Forms.Form",
    "$owner.Text = ''",
    "$owner.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None",
    "$owner.ShowInTaskbar = $false",
    "$owner.TopMost = $true",
    "$owner.Opacity = 0",
    "$owner.Size = New-Object System.Drawing.Size(1, 1)",
    "$owner.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen",
    "try {",
    "  $owner.Show()",
    "  [LfaaNativeFolderPicker]::PrepareOwner($owner.Handle)",
    `  $selected = [LfaaNativeFolderPicker]::PickFolder($owner.Handle, '${escapedDescription}', '${escapedInitialDir}', $${dryRunOnly ? "true" : "false"})`,
    "  if ($selected) { Write-Output $selected }",
    "} finally {",
    "  $owner.Close()",
    "  $owner.Dispose()",
    "}",
  ].join("\r\n");
  return Buffer.from(script, "utf16le").toString("base64");
}

// 在 Windows 桌面会话下呼出系统现代资源管理器文件夹选择对话框（IFileOpenDialog + FOS_PICKFOLDERS）。
export async function openNativeFolderPicker(description = "选择项目文件夹", initialDir?: string): Promise<FolderPickResult> {
  if (process.platform !== "win32") {
    return { cancelled: true, error: "当前仅支持在 Windows 本地环境呼出资源管理器。" };
  }

  try {
    const encodedCommand = buildFolderPickerPowerShell(description, false, initialDir?.trim() ?? "");
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-STA", "-EncodedCommand", encodedCommand],
      { timeout: 180000, windowsHide: true },
    );
    const selected = stdout.trim();
    if (!selected) return { cancelled: true };
    if (selected.startsWith("LFAA_ISOLATED_DESKTOP:")) {
      return {
        cancelled: true,
        error: "当前开发服务运行在沙箱隔离桌面，无法向主屏幕弹出系统资源管理器；请直接输入文件夹路径（如 G:\\app），或在本地终端执行 pnpm lfaa web。",
      };
    }
    return {
      cancelled: false,
      path: resolve(selected),
      name: basename(resolve(selected)) || selected,
    };
  } catch (error) {
    return {
      cancelled: true,
      error: error instanceof Error ? `打开系统文件夹选择器失败：${error.message}` : String(error),
    };
  }
}

async function detectWindowsDesktopName(): Promise<string> {
  const script = [
    "$def = '[DllImport(\"user32.dll\")] public static extern IntPtr GetThreadDesktop(uint t); [DllImport(\"kernel32.dll\")] public static extern uint GetCurrentThreadId(); [DllImport(\"user32.dll\", CharSet=CharSet.Unicode)] public static extern bool GetUserObjectInformation(IntPtr h, int i, System.Text.StringBuilder s, int l, out int n);'",
    "$t = Add-Type -MemberDefinition $def -Name 'DeskNameProbe' -Namespace 'LfaaDesk' -PassThru",
    "$sb = New-Object System.Text.StringBuilder 128; $n = 0",
    "if ($t::GetUserObjectInformation($t::GetThreadDesktop($t::GetCurrentThreadId()), 2, $sb, $sb.Capacity, [ref]$n)) { Write-Output $sb.ToString() }",
  ].join("; ");
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-EncodedCommand", encoded],
    { timeout: 6000, windowsHide: true },
  );
  return stdout.trim();
}

// 在 Windows 资源管理器中打开指定项目目录；隔离桌面会及时给出提示。
export async function openFolderInExplorer(folderPath: string): Promise<{ opened: boolean; error?: string }> {
  const target = resolve(folderPath);
  if (!existsSync(target)) {
    return { opened: false, error: `找不到项目文件夹：${target}` };
  }
  if (process.platform !== "win32") {
    return { opened: false, error: "当前仅支持在 Windows 本地环境打开资源管理器。" };
  }

  try {
    const desktopName = await detectWindowsDesktopName();
    if (desktopName && desktopName.toLowerCase() !== "default") {
      return {
        opened: false,
        error: "当前开发服务运行在沙箱隔离桌面，无法向主屏幕弹出资源管理器窗口；请在本地终端运行 pnpm lfaa web。",
      };
    }
    const child = spawn("explorer.exe", [target], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.once("error", () => {});
    child.unref();
    return { opened: true };
  } catch (error) {
    return {
      opened: false,
      error: error instanceof Error ? `打开资源管理器失败：${error.message}` : String(error),
    };
  }
}

// 在 Windows 文件资源管理器中选中并高亮目标文件。
export async function revealFileInExplorer(filePath: string): Promise<{ opened: boolean; error?: string }> {
  const target = resolve(filePath);
  if (!existsSync(target)) {
    return { opened: false, error: `找不到目标文件：${target}` };
  }
  if (process.platform !== "win32") {
    return { opened: false, error: "当前仅支持在 Windows 本地环境在文件资源管理器中显示。" };
  }
  try {
    const desktopName = await detectWindowsDesktopName();
    if (desktopName && desktopName.toLowerCase() !== "default") {
      return {
        opened: false,
        error: "当前开发服务运行在沙箱隔离桌面，无法向主屏幕弹出资源管理器窗口；请在本地终端运行 pnpm lfaa web。",
      };
    }
    const child = spawn("explorer.exe", [`/select,${target}`], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.once("error", () => {});
    child.unref();
    return { opened: true };
  } catch (error) {
    return {
      opened: false,
      error: error instanceof Error ? `在资源管理器中显示失败：${error.message}` : String(error),
    };
  }
}

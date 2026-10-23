# Windows PowerShell 5.1 按系统代码页读取无 BOM 脚本；此文件含中文文案，必须保存为 UTF-8 BOM。
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Add", "Remove")]
  [string] $Action
)

$ErrorActionPreference = "Stop"
$statePath = "Software\LFAA\DesktopInstaller"
$environmentPath = "Environment"
$state = $null
$environment = $null

try {
  $state = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($statePath, $true)
  if ($null -eq $state) { throw "LFAA 安装选项状态不存在。" }

  $entry = [string] $state.GetValue("CliPathEntry", "", [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
  if ([string]::IsNullOrWhiteSpace($entry)) { throw "LFAA CLI 安装路径为空。" }
  if ($entry.Contains(";")) { throw "LFAA CLI 安装路径包含 PATH 分隔符，无法安全登记。" }

  $environment = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($environmentPath, $true)
  if ($null -eq $environment) {
    $environment = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($environmentPath)
  }

  $hasPathValue = $environment.GetValueNames() -contains "Path"
  if ($hasPathValue) {
    $pathKind = $environment.GetValueKind("Path")
    if ($pathKind -notin @([Microsoft.Win32.RegistryValueKind]::String, [Microsoft.Win32.RegistryValueKind]::ExpandString)) {
      throw "当前用户 PATH 的注册表类型不受支持；未修改 PATH。"
    }
    $currentPath = [string] $environment.GetValue("Path", "", [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
  } else {
    $pathKind = [Microsoft.Win32.RegistryValueKind]::ExpandString
    $currentPath = ""
  }

  $pathParts = $currentPath.Split([char[]] @(";"), [StringSplitOptions]::None)
  $entryExists = $false
  foreach ($part in $pathParts) {
    if ([string]::Equals($part, $entry, [StringComparison]::OrdinalIgnoreCase)) {
      $entryExists = $true
      break
    }
  }

  if ($Action -eq "Add") {
    $previousEntry = [string] $state.GetValue("CliPathEntry", "", [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    $previouslyOwned = [int] $state.GetValue("CliPathAdded", 0) -eq 1

    if (-not $entryExists) {
      $state.SetValue("CliPathOriginalValueExisted", [int] $hasPathValue, [Microsoft.Win32.RegistryValueKind]::DWord)
      $state.SetValue("CliPathOriginalValueKind", [string] $pathKind, [Microsoft.Win32.RegistryValueKind]::String)
      if ($currentPath.Length -eq 0 -or $currentPath.EndsWith(";", [StringComparison]::Ordinal)) {
        $nextPath = $currentPath + $entry
      } else {
        $nextPath = $currentPath + ";" + $entry
      }
      $environment.SetValue("Path", $nextPath, $pathKind)
      $previouslyOwned = $true
    } elseif (-not [string]::Equals($previousEntry, $entry, [StringComparison]::OrdinalIgnoreCase)) {
      $previouslyOwned = $false
    }

    $state.SetValue("CliPathEntry", $entry, [Microsoft.Win32.RegistryValueKind]::String)
    $state.SetValue("CliPathAdded", [int] $previouslyOwned, [Microsoft.Win32.RegistryValueKind]::DWord)
    [Console]::Out.WriteLine("LFAA CLI PATH 已检查。")
    exit 0
  }

  $wasAdded = [int] $state.GetValue("CliPathAdded", 0) -eq 1
  if ($wasAdded -and $entryExists) {
    $removed = $false
    $remaining = New-Object System.Collections.Generic.List[string]
    foreach ($part in $pathParts) {
      if (-not $removed -and [string]::Equals($part, $entry, [StringComparison]::OrdinalIgnoreCase)) {
        $removed = $true
      } else {
        $remaining.Add($part)
      }
    }

    $nextPath = [string]::Join(";", $remaining)
    if ($removed) {
      if ($remaining.Count -eq 0 -and [int] $state.GetValue("CliPathOriginalValueExisted", 0) -eq 0) {
        $environment.DeleteValue("Path", $false)
      } else {
        $originalKindName = [string] $state.GetValue("CliPathOriginalValueKind", [string] $pathKind)
        if ($originalKindName -eq [string] [Microsoft.Win32.RegistryValueKind]::ExpandString) {
          $pathKind = [Microsoft.Win32.RegistryValueKind]::ExpandString
        } else {
          $pathKind = [Microsoft.Win32.RegistryValueKind]::String
        }
        $environment.SetValue("Path", $nextPath, $pathKind)
      }
    }
  }

  foreach ($valueName in @("CliPathEntry", "CliPathAdded", "CliPathOriginalValueExisted", "CliPathOriginalValueKind")) {
    $state.DeleteValue($valueName, $false)
  }
  [Console]::Out.WriteLine("LFAA CLI PATH 清理完成。")
  exit 0
} catch {
  [Console]::Out.WriteLine($_.Exception.Message)
  exit 1
} finally {
  if ($null -ne $environment) { $environment.Dispose() }
  if ($null -ne $state) { $state.Dispose() }
}

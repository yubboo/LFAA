# 文件：lfaa-setup.ps1
# 作用：提供 LFAA 项目按需依赖、项目级资源和分层开发质量检查菜单。
# 负责：Node/pnpm/PNPM_HOME/Store/Rust/Cargo 实时环境检测与按需准备、项目依赖、Web 启动、分层质量检查。
# 不负责：Git 推送、版本包同步、业务运行时权限决策。
# 状态归属：工具链与 pnpm Store 事实每次来自当前电脑实时探测，项目依赖事实来自当前项目目录；本机缓存不得覆盖环境事实。
# 对外接口：由根目录 LFAA-Setup.bat 调用。
# 关联文件：LFAA-Setup.bat、package.json、rust-toolchain.toml、scripts/check-node-pty.mjs、scripts/node-dependency-health-check.mjs。
# 修改注意事项：只允许 pnpm；Rustup 使用官方来源与校验；菜单编号只是 Windows 入口，不得作为未来 CLI/GUI 协议。


$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
try { & chcp.com 65001 | Out-Null } catch {}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $ScriptDir "..\.."))

function Write-Label {
    param([string]$Left,[string]$Right,[string]$Text,[ConsoleColor]$Color=[ConsoleColor]::Gray)
    Write-Host ("{0}{1} " -f $Left,$Right) -ForegroundColor $Color -NoNewline
    Write-Host $Text
}

function Wait-LfaaMenu {
    param(
        [string]$Message = "按任意键返回主菜单。"
    )

    Write-Host ""
    Write-Label "【提示】" "【返回菜单】" $Message DarkGray
    try { [void][System.Console]::ReadKey($true) } catch {}
}

function Stop-Lfaa {
    param([string]$Message)
    Write-Host ""
    Write-Label "【错误】" "【失败】" $Message Red
    Write-Label "【提示】" "【退出】" "项目根无效，无法进入主菜单。" Yellow
    try { [void][System.Console]::ReadKey($true) } catch {}
    exit 1
}

function Test-CommandAvailable {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-CommandVersion {
    param([string]$Name)
    if (-not (Test-CommandAvailable $Name)) { return "未安装" }
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $o = @(& $Name --version 2>&1 | ForEach-Object { [string]$_ })
        if ($LASTEXITCODE -ne 0 -or $o.Count -eq 0) { return "已发现，但无法读取版本" }
        return ($o -join " ").Trim()
    } finally {
        $ErrorActionPreference = $old
    }
}

function Get-RequiredToolchainInfo {
    $packageFile = Join-Path $ProjectRoot "package.json"
    $data = Get-Content -LiteralPath $packageFile -Raw | ConvertFrom-Json

    $pnpmVersion = ""
    if ($data.packageManager -and ([string]$data.packageManager -match "^pnpm@(.+)$")) {
        $pnpmVersion = $Matches[1]
    }

    return [PSCustomObject]@{
        NodeMajor = 24
        PnpmVersion = $pnpmVersion
    }
}

function Get-CommandSource {
    param([string]$Name)
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $command) { return "未安装" }
    if ($command.Source) { return [string]$command.Source }
    return [string]$command.Path
}

function Get-NodeVersionValue {
    if (-not (Test-CommandAvailable "node")) { return "" }
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = @(& node -p "process.versions.node" 2>&1 | ForEach-Object { [string]$_ })
        if ($LASTEXITCODE -ne 0 -or $output.Count -eq 0) { return "" }
        return ($output -join "").Trim()
    }
    finally {
        $ErrorActionPreference = $old
    }
}

function Get-DirectPnpmVersion {
    if (-not (Test-CommandAvailable "pnpm")) { return "" }
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = @(& pnpm --version 2>&1 | ForEach-Object { [string]$_ })
        if ($LASTEXITCODE -ne 0 -or $output.Count -eq 0) { return "" }
        return ($output -join "").Trim()
    }
    finally {
        $ErrorActionPreference = $old
    }
}

function Get-PnpmRunner {
    $required = Get-RequiredToolchainInfo
    $directVersion = Get-DirectPnpmVersion

    if (-not [string]::IsNullOrWhiteSpace($directVersion)) {
        if ([string]::IsNullOrWhiteSpace($required.PnpmVersion) -or $directVersion -eq $required.PnpmVersion) {
            return [PSCustomObject]@{
                FilePath = "pnpm"
                Prefix = @()
                Version = $directVersion
                Source = (Get-CommandSource "pnpm")
            }
        }
    }

    if (Test-CommandAvailable "corepack") {
        $old = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $output = @(& corepack pnpm --version 2>&1 | ForEach-Object { [string]$_ })
            $code = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $old
        }

        if ($code -eq 0 -and $output.Count -gt 0) {
            return [PSCustomObject]@{
                FilePath = "corepack"
                Prefix = @("pnpm")
                Version = (($output -join "").Trim())
                Source = (Get-CommandSource "corepack")
            }
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($directVersion)) {
        throw ("检测到 pnpm {0}，但项目要求 pnpm {1}，并且无法通过 corepack 启动项目版本。" -f $directVersion,$required.PnpmVersion)
    }

    throw "未检测到可用的 pnpm 或 corepack。"
}

function Invoke-PnpmCapture {
    param([string[]]$Arguments)

    try {
        $runner = Get-PnpmRunner
        $allArguments = @($runner.Prefix) + @($Arguments)
        $old = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        Push-Location $ProjectRoot
        try {
            $output = @(& $runner.FilePath @allArguments 2>&1 | ForEach-Object { [string]$_ })
            $code = $LASTEXITCODE
        }
        finally {
            Pop-Location
            $ErrorActionPreference = $old
        }

        return [PSCustomObject]@{
            Success = ($code -eq 0)
            Output = @($output)
            Runner = $runner
        }
    }
    catch {
        return [PSCustomObject]@{
            Success = $false
            Output = @([string]$_.Exception.Message)
            Runner = $null
        }
    }
}

function Get-PnpmConfigValue {
    param(
        [string]$Key,
        [ValidateSet("global","project")][string]$Location = "global"
    )

    $result = Invoke-PnpmCapture @("config","get",("--location={0}" -f $Location),$Key)
    if (-not $result.Success) { return $null }

    $value = @($result.Output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Last 1)
    if ($value.Count -eq 0) { return $null }

    $text = $value[0].Trim()
    if ([string]::IsNullOrWhiteSpace($text) -or $text -in @("null","undefined","false")) { return $null }
    return $text
}

function Get-ExplicitStoreDirFromYaml {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $match = [regex]::Match($line, '^\s*storeDir\s*:\s*["'']?([^"''#]+)["'']?\s*(?:#.*)?$')
        if ($match.Success) {
            $value = $match.Groups[1].Value.Trim()
            if (-not [string]::IsNullOrWhiteSpace($value)) { return $value }
        }
    }
    return $null
}

function Get-GlobalPnpmStoreDir {
    param([string]$GlobalConfigPath)
    return (Get-ExplicitStoreDirFromYaml $GlobalConfigPath)
}

function Get-ProjectPnpmStoreDir {
    return (Get-ExplicitStoreDirFromYaml (Join-Path $ProjectRoot "pnpm-workspace.yaml"))
}

function Get-PnpmStoreEnvironmentOverride {
    # pnpm 支持环境变量配置。这里只用于解释来源；最终 active Store 永远以 `pnpm store path` 为准。
    $candidates = @(
        "NPM_CONFIG_STORE_DIR",
        "npm_config_store_dir",
        "PNPM_STORE_DIR"
    )
    foreach ($name in $candidates) {
        $item = Get-Item ("Env:{0}" -f $name) -ErrorAction SilentlyContinue
        if ($null -ne $item -and -not [string]::IsNullOrWhiteSpace([string]$item.Value)) {
            return [PSCustomObject]@{ Name = $name; Value = [string]$item.Value }
        }
    }
    return $null
}

function Test-PnpmHomeInPath {
    param([string]$PnpmHome)
    if ([string]::IsNullOrWhiteSpace($PnpmHome)) { return $false }

    # PowerShell 变量名大小写不敏感；禁止使用 `$home`，否则会与只读自动变量 `$HOME` 冲突。
    $normalizedPnpmHome = $PnpmHome.TrimEnd('\','/')
    $pnpmHomeBin = Join-Path $normalizedPnpmHome "bin"
    foreach ($entry in @(([string]$env:PATH) -split ';')) {
        if ([string]::IsNullOrWhiteSpace($entry)) { continue }
        $expanded = [Environment]::ExpandEnvironmentVariables($entry.Trim().Trim('"')).TrimEnd('\','/')
        if ($expanded.Equals($normalizedPnpmHome,[System.StringComparison]::OrdinalIgnoreCase) -or
            $expanded.Equals($pnpmHomeBin,[System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    return $false
}

function Get-PnpmEnvironmentFacts {
    $runner = $null
    try { $runner = Get-PnpmRunner } catch {}

    $storeResult = Invoke-PnpmCapture @("store","path")
    $storePath = "无法读取"
    if ($storeResult.Success) {
        $value = @($storeResult.Output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Last 1)
        if ($value.Count -gt 0) { $storePath = $value[0].Trim() }
    }

    $globalConfig = Get-PnpmConfigValue "globalconfig" "global"
    $globalStoreDir = Get-GlobalPnpmStoreDir $globalConfig
    $projectStoreDir = Get-ProjectPnpmStoreDir
    $envStore = Get-PnpmStoreEnvironmentOverride

    $source = "pnpm 默认（未发现显式 storeDir）"
    if ($null -ne $envStore) {
        $source = ("环境变量 {0}" -f $envStore.Name)
    }
    elseif (-not [string]::IsNullOrWhiteSpace($projectStoreDir)) {
        $source = "项目配置"
    }
    elseif (-not [string]::IsNullOrWhiteSpace($globalStoreDir)) {
        $source = "用户全局配置"
    }
    elseif ($storePath -eq "无法读取") {
        $source = "无法判定"
    }

    $pnpmHome = [string]$env:PNPM_HOME
    $pnpmPathReady = Test-PnpmHomeInPath $pnpmHome

    return [PSCustomObject]@{
        PnpmVersion = if ($null -ne $runner) { [string]$runner.Version } else { "未安装" }
        PnpmSource = if ($null -ne $runner) { [string]$runner.Source } else { "未安装" }
        PnpmHome = if ([string]::IsNullOrWhiteSpace($pnpmHome)) { "未设置" } else { $pnpmHome }
        PnpmHomeInPath = $pnpmPathReady
        StorePath = $storePath
        StoreSource = $source
        GlobalConfig = if ([string]::IsNullOrWhiteSpace($globalConfig)) { "无法读取" } else { $globalConfig }
        GlobalStoreDir = $globalStoreDir
        ProjectStoreDir = $projectStoreDir
        EnvironmentStore = $envStore
    }
}

function Get-PnpmStorePath {
    # 每次都向当前 pnpm 实时查询；禁止从 .lfaa/state 或上一次输出复用旧路径。
    return (Get-PnpmEnvironmentFacts).StorePath
}

function Invoke-PnpmStoreLockfileFetch {
    param(
        [string]$StorePath,
        [switch]$Offline
    )

    $lockFile = Join-Path $ProjectRoot "pnpm-lock.yaml"
    if (-not (Test-Path -LiteralPath $lockFile)) {
        return [PSCustomObject]@{ Success = $false; Output = @("缺少 pnpm-lock.yaml") }
    }

    $probeRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("lfaa-pnpm-store-probe-" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $probeRoot -Force | Out-Null
    try {
        Copy-Item -LiteralPath $lockFile -Destination (Join-Path $probeRoot "pnpm-lock.yaml") -Force
        # fetch 本身以 lockfile 为事实源；复制 package.json 只为了让 Corepack 在临时目录继续识别项目锁定 pnpm 版本。
        Copy-Item -LiteralPath (Join-Path $ProjectRoot "package.json") -Destination (Join-Path $probeRoot "package.json") -Force
        $patches = Join-Path $ProjectRoot "patches"
        if (Test-Path -LiteralPath $patches -PathType Container) {
            Copy-Item -LiteralPath $patches -Destination (Join-Path $probeRoot "patches") -Recurse -Force
        }

        $storeBase = $StorePath
        $leaf = Split-Path -Leaf $StorePath
        if ($leaf -match '^v\d+$') { $storeBase = Split-Path -Parent $StorePath }

        $runner = Get-PnpmRunner
        $arguments = @($runner.Prefix) + @("--store-dir",$storeBase,"fetch","--frozen-lockfile","--ignore-scripts")
        if ($Offline) { $arguments += "--offline" }

        $old = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        Push-Location $probeRoot
        try {
            $output = @(& $runner.FilePath @arguments 2>&1 | ForEach-Object { [string]$_ })
            $code = $LASTEXITCODE
        }
        finally {
            Pop-Location
            $ErrorActionPreference = $old
        }

        return [PSCustomObject]@{
            Success = ($code -eq 0)
            Output = @($output)
        }
    }
    finally {
        Remove-Item -LiteralPath $probeRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Get-PnpmStoreHealth {
    param([object[]]$Inventory = @())

    $externalCount = @($Inventory | Where-Object {
        $_.Section -in @("dependencies","devDependencies","optionalDependencies") -and
        -not ([string]$_.Version).StartsWith("workspace:")
    }).Count

    $pnpmFacts = Get-PnpmEnvironmentFacts
    $storePath = $pnpmFacts.StorePath
    if ($externalCount -eq 0) {
        return [PSCustomObject]@{
            Healthy = $true
            Path = $storePath
            Source = $pnpmFacts.StoreSource
            Reason = "当前项目无外部 Node 依赖，无需 pnpm Store 内容。"
            Probe = "not-required"
        }
    }

    if ([string]::IsNullOrWhiteSpace($storePath) -or $storePath -eq "无法读取") {
        return [PSCustomObject]@{
            Healthy = $false
            Path = $storePath
            Source = $pnpmFacts.StoreSource
            Reason = "无法读取 pnpm Store 路径。"
            Probe = "path-unavailable"
        }
    }

    if (-not (Test-Path -LiteralPath $storePath -PathType Container)) {
        return [PSCustomObject]@{
            Healthy = $false
            Path = $storePath
            Source = $pnpmFacts.StoreSource
            Reason = "pnpm Store 目录不存在。"
            Probe = "missing"
        }
    }

    $firstEntry = Get-ChildItem -LiteralPath $storePath -Force -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $firstEntry) {
        return [PSCustomObject]@{
            Healthy = $false
            Path = $storePath
            Source = $pnpmFacts.StoreSource
            Reason = "pnpm Store 目录为空。"
            Probe = "empty"
        }
    }

    # 临时目录内执行离线 fetch：不访问 registry、不触碰项目 node_modules，真实验证当前 lockfile 所需缓存。
    $probe = Invoke-PnpmStoreLockfileFetch -StorePath $storePath -Offline
    if (-not $probe.Success) {
        $detail = @($probe.Output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Last 3) -join " | "
        if ([string]::IsNullOrWhiteSpace($detail)) { $detail = "离线 lockfile 探针失败" }
        return [PSCustomObject]@{
            Healthy = $false
            Path = $storePath
            Source = $pnpmFacts.StoreSource
            Reason = ("pnpm Store 缺少当前 lockfile 所需内容或状态异常：{0}" -f $detail)
            Probe = "offline-fetch-failed"
        }
    }

    return [PSCustomObject]@{
        Healthy = $true
        Path = $storePath
        Source = $pnpmFacts.StoreSource
        Reason = "pnpm Store 已覆盖当前 lockfile 所需内容。"
        Probe = "offline-fetch-pass"
    }
}

function Join-LfaaLocation {
    param([string]$Base,[string]$Child)
    if ([string]::IsNullOrWhiteSpace($Base) -or $Base -eq "未确定" -or $Base -eq "无法读取") {
        return $Base
    }
    return (Join-Path $Base $Child)
}

function Show-DependencyLocations {
    $cargoHome = Get-CargoHomePath
    $rustupHome = Get-RustupHomePath
    $cargoLock = Join-Path $ProjectRoot "Cargo.lock"
    $cargoLockText = if (Test-Path -LiteralPath $cargoLock) { $cargoLock } else { "未创建（当前无外部 crate 时正常）" }
    $pnpmFacts = Get-PnpmEnvironmentFacts
    $pnpmHomeStatus = if ($pnpmFacts.PnpmHome -eq "未设置") {
        "未设置（当前 pnpm 可用时不强制修改）"
    }
    elseif ($pnpmFacts.PnpmHomeInPath) {
        ("{0} | PATH 已生效" -f $pnpmFacts.PnpmHome)
    }
    else {
        ("{0} | 当前 PATH 未发现 PNPM_HOME/PNPM_HOME\bin" -f $pnpmFacts.PnpmHome)
    }

    Write-Host ""
    Write-Label "【位置】" "【Node 依赖】" (Join-Path $ProjectRoot "node_modules") DarkCyan
    Write-Label "【位置】" "【pnpm 虚拟仓库】" (Join-Path $ProjectRoot "node_modules\.pnpm") DarkCyan
    Write-Label "【位置】" "【pnpm 可执行】" $pnpmFacts.PnpmSource DarkCyan
    Write-Label "【环境】" "【PNPM_HOME】" $pnpmHomeStatus DarkCyan
    Write-Label "【位置】" "【pnpm 全局配置】" $pnpmFacts.GlobalConfig DarkCyan
    Write-Label "【位置】" "【pnpm Store】" $pnpmFacts.StorePath DarkCyan
    Write-Label "【来源】" "【pnpm Store】" $pnpmFacts.StoreSource DarkCyan
    Write-Label "【位置】" "【Node 锁文件】" (Join-Path $ProjectRoot "pnpm-lock.yaml") DarkCyan
    Write-Label "【位置】" "【依赖状态缓存】" (Get-DependencyStatePath) DarkCyan
    Write-Label "【位置】" "【Cargo 缓存】" (Join-LfaaLocation $cargoHome "registry") DarkCyan
    Write-Label "【位置】" "【Cargo Git 缓存】" (Join-LfaaLocation $cargoHome "git") DarkCyan
    Write-Label "【位置】" "【Rust 工具链】" (Join-LfaaLocation $rustupHome "toolchains") DarkCyan
    Write-Label "【位置】" "【Rust 锁文件】" $cargoLockText DarkCyan
}

function Assert-NodeVersion {
    $required = Get-RequiredToolchainInfo
    $nodeVersion = Get-NodeVersionValue

    if ([string]::IsNullOrWhiteSpace($nodeVersion)) {
        throw "未检测到可用的 Node.js。请先安装项目要求的 Node.js 24.x。"
    }

    $majorText = ($nodeVersion -split "\.")[0]
    $major = 0
    if (-not [int]::TryParse($majorText, [ref]$major)) {
        throw ("无法解析 Node.js 版本：{0}" -f $nodeVersion)
    }

    if ($major -ne $required.NodeMajor) {
        throw ("当前 Node.js 为 {0}，项目要求 Node.js 24.x。" -f $nodeVersion)
    }

    return [PSCustomObject]@{
        NodeVersion = $nodeVersion
        NodeSource = (Get-CommandSource "node")
    }
}

function Ensure-ProjectPnpm {
    $required = Get-RequiredToolchainInfo
    [void](Assert-NodeVersion)

    try {
        $runner = Get-PnpmRunner
        if ([string]::IsNullOrWhiteSpace($required.PnpmVersion) -or $runner.Version -eq $required.PnpmVersion) {
            return $runner
        }
    }
    catch {
        # 缺失或版本不匹配时，下面统一尝试 Corepack 准备项目锁定版本。
    }

    if ([string]::IsNullOrWhiteSpace($required.PnpmVersion)) {
        throw "package.json 未锁定 packageManager: pnpm@<version>，无法准备 pnpm。"
    }
    if (-not (Test-CommandAvailable "corepack")) {
        throw ("未检测到 Corepack，无法自动准备 pnpm {0}。请先修复 Node.js 24.x 安装后重试。" -f $required.PnpmVersion)
    }

    Write-Label "【补齐】" "【pnpm】" ("通过 Corepack 准备项目锁定版本 pnpm@{0}。" -f $required.PnpmVersion) Yellow
    Invoke-ProjectCommand "corepack" @("prepare",("pnpm@{0}" -f $required.PnpmVersion),"--activate") "准备项目锁定 pnpm"

    $runner = Get-PnpmRunner
    if ($runner.Version -ne $required.PnpmVersion) {
        throw ("Corepack 准备后 pnpm 仍为 {0}，项目要求 {1}。" -f $runner.Version,$required.PnpmVersion)
    }
    return $runner
}

function Assert-NodeToolchain {
    $required = Get-RequiredToolchainInfo
    $node = Assert-NodeVersion
    $runner = Get-PnpmRunner

    if (-not [string]::IsNullOrWhiteSpace($required.PnpmVersion) -and
        $runner.Version -ne $required.PnpmVersion) {
        throw ("当前可用 pnpm 为 {0}，项目要求 {1}。" -f $runner.Version,$required.PnpmVersion)
    }

    return [PSCustomObject]@{
        NodeVersion = $node.NodeVersion
        NodeSource = $node.NodeSource
        PnpmVersion = $runner.Version
        PnpmSource = $runner.Source
    }
}

function Get-WorkspacePackageFiles {
    $files = New-Object System.Collections.Generic.List[string]
    $seen = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)

    $rootPackage = Join-Path $ProjectRoot "package.json"
    if (Test-Path -LiteralPath $rootPackage) {
        $full = [System.IO.Path]::GetFullPath($rootPackage)
        if ($seen.Add($full)) { $files.Add($full) }
    }

    $workspaceFile = Join-Path $ProjectRoot "pnpm-workspace.yaml"
    if (-not (Test-Path -LiteralPath $workspaceFile)) {
        return $files
    }

    foreach ($line in Get-Content -LiteralPath $workspaceFile) {
        $match = [regex]::Match($line, '^\s*-\s*["'']?([^"'']+)["'']?\s*$')
        if (-not $match.Success) { continue }

        $pattern = $match.Groups[1].Value.Trim().TrimEnd("/")
        if ([string]::IsNullOrWhiteSpace($pattern)) { continue }

        $packagePattern = Join-Path $ProjectRoot ($pattern + "/package.json")
        Get-ChildItem -Path $packagePattern -File -ErrorAction SilentlyContinue | ForEach-Object {
            $full = [System.IO.Path]::GetFullPath($_.FullName)
            if ($seen.Add($full)) { $files.Add($full) }
        }
    }

    return $files
}

function Get-NodeDependencySummary {
    $packageFiles = Get-WorkspacePackageFiles
    $external = New-Object System.Collections.Generic.HashSet[string]
    $declarations = 0

    foreach ($file in $packageFiles) {
        try {
            $data = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json

            foreach ($section in @("dependencies","devDependencies","optionalDependencies")) {
                $block = $data.$section
                if ($null -eq $block) { continue }

                foreach ($prop in $block.PSObject.Properties) {
                    $declarations += 1
                    $version = [string]$prop.Value

                    if (-not $version.StartsWith("workspace:")) {
                        [void]$external.Add([string]$prop.Name)
                    }
                }
            }
        }
        catch {
            throw ("无法读取 package.json：{0}" -f $file)
        }
    }

    return [PSCustomObject]@{
        WorkspaceProjects = $packageFiles.Count
        DependencyDeclarations = $declarations
        ExternalDependencies = $external.Count
    }
}

function Get-DependencyStatePath {
    return (Join-Path $ProjectRoot ".lfaa\state\dependency-state.json")
}

function Get-Sha256Text {
    param([string]$Text)

    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
        return (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join "")
    }
    finally {
        $sha.Dispose()
    }
}

function Get-FileSha256Value {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return "missing" }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-ProjectRelativePath {
    param([string]$Path)
    $full = [System.IO.Path]::GetFullPath($Path)
    if ($full.StartsWith($ProjectRoot,[System.StringComparison]::OrdinalIgnoreCase)) {
        $relative = $full.Substring($ProjectRoot.Length) -replace '^[\\/]+',''
        return ($relative -replace '\\','/')
    }
    return ($full -replace '\\','/')
}

function Get-NodeDependencyInventory {
    $items = New-Object System.Collections.Generic.List[object]

    foreach ($file in (Get-WorkspacePackageFiles | Sort-Object)) {
        $data = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
        $packagePath = Get-ProjectRelativePath $file

        foreach ($section in @("dependencies","devDependencies","optionalDependencies","peerDependencies")) {
            $block = $data.$section
            if ($null -eq $block) { continue }

            foreach ($prop in @($block.PSObject.Properties | Sort-Object Name)) {
                $items.Add([PSCustomObject]@{
                    PackagePath = $packagePath
                    Section = $section
                    Name = [string]$prop.Name
                    Version = [string]$prop.Value
                })
            }
        }
    }

    return @($items | Sort-Object PackagePath,Section,Name)
}

function Get-NodeDependencySnapshot {
    $rootPackageFile = Join-Path $ProjectRoot "package.json"
    $rootPackage = Get-Content -LiteralPath $rootPackageFile -Raw | ConvertFrom-Json
    $lockFile = Join-Path $ProjectRoot "pnpm-lock.yaml"
    $workspaceFile = Join-Path $ProjectRoot "pnpm-workspace.yaml"
    $inventory = @(Get-NodeDependencyInventory)

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("packageManager=" + [string]$rootPackage.packageManager)
    $lockHash = Get-FileSha256Value $lockFile
    $workspaceHash = Get-FileSha256Value $workspaceFile
    $lines.Add("lock=" + $lockHash)
    $lines.Add("workspace=" + $workspaceHash)

    if ($null -ne $rootPackage.pnpm) {
        $lines.Add("pnpmConfig=" + ($rootPackage.pnpm | ConvertTo-Json -Depth 16 -Compress))
    }

    foreach ($item in $inventory) {
        $lines.Add(("dep={0}|{1}|{2}|{3}" -f $item.PackagePath,$item.Section,$item.Name,$item.Version))
    }

    return [PSCustomObject]@{
        Fingerprint = Get-Sha256Text ($lines -join "`n")
        PackageManager = [string]$rootPackage.packageManager
        LockHash = $lockHash
        WorkspaceHash = $workspaceHash
        Inventory = $inventory
    }
}

function Read-DependencyState {
    $path = Get-DependencyStatePath
    if (-not (Test-Path -LiteralPath $path)) { return $null }

    try {
        $state = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        if ($null -eq $state -or [int]$state.schemaVersion -ne 1) {
            Write-Label "【状态】" "【依赖缓存】" "本机依赖状态版本无法识别，将重新检测。" Yellow
            return $null
        }
        return $state
    }
    catch {
        Write-Label "【状态】" "【依赖缓存】" "本机依赖状态文件损坏，将忽略并重新检测。" Yellow
        return $null
    }
}

function Write-DependencyState {
    param(
        [object]$NodeState = $null,
        [object]$RustState = $null,
        [switch]$PreserveNode,
        [switch]$PreserveRust
    )

    $old = Read-DependencyState
    if ($PreserveNode -and $null -ne $old) { $NodeState = $old.node }
    if ($PreserveRust -and $null -ne $old) { $RustState = $old.rust }

    $path = Get-DependencyStatePath
    $dir = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $payload = [PSCustomObject]@{
        schemaVersion = 1
        node = $NodeState
        rust = $RustState
    }
    [System.IO.File]::WriteAllText($path,($payload | ConvertTo-Json -Depth 16),$Utf8NoBom)
}

function Get-DependencyPackageJsonPath {
    param([string]$PackagePath,[string]$DependencyName)

    $manifestPath = Join-Path $ProjectRoot ($PackagePath -replace '/','\')
    $packageDir = Split-Path -Parent $manifestPath
    if ([string]::IsNullOrWhiteSpace($packageDir)) { $packageDir = $ProjectRoot }

    $dependencyDir = Join-Path $packageDir "node_modules"
    foreach ($part in ($DependencyName -split '/')) {
        if ([string]::IsNullOrWhiteSpace($part)) { continue }
        $dependencyDir = Join-Path $dependencyDir $part
    }
    return (Join-Path $dependencyDir "package.json")
}

function Test-NodeDependencyInstallState {
    param([object[]]$Inventory)

    $issues = New-Object System.Collections.Generic.List[string]
    $modulesFile = Join-Path $ProjectRoot "node_modules\.modules.yaml"
    if (-not (Test-Path -LiteralPath $modulesFile)) {
        $issues.Add("根 node_modules/.modules.yaml 缺失")
    }

    foreach ($item in $Inventory) {
        if ($item.Section -notin @("dependencies","devDependencies")) { continue }

        $dependencyManifest = Get-DependencyPackageJsonPath $item.PackagePath $item.Name
        if (-not (Test-Path -LiteralPath $dependencyManifest)) {
            $issues.Add(("{0}: 缺少 {1}" -f $item.PackagePath,$item.Name))
            continue
        }

        $expected = [string]$item.Version
        if ($expected.StartsWith("workspace:")) { continue }
        if ($expected -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$') { continue }

        try {
            $installed = Get-Content -LiteralPath $dependencyManifest -Raw | ConvertFrom-Json
            if ([string]$installed.version -ne $expected) {
                $issues.Add(("{0}: {1} 需要 {2}，当前 {3}" -f $item.PackagePath,$item.Name,$expected,[string]$installed.version))
            }
        }
        catch {
            $issues.Add(("{0}: 无法读取 {1} 已安装版本" -f $item.PackagePath,$item.Name))
        }
    }

    return [PSCustomObject]@{
        Complete = ($issues.Count -eq 0)
        Issues = @($issues)
    }
}

function Test-NodeDependencyRuntimeHealth {
    $script = Join-Path $ProjectRoot "scripts\node-dependency-health-check.mjs"
    if (-not (Test-Path -LiteralPath $script)) {
        return [PSCustomObject]@{
            Complete = $false
            Issues = @("缺少 scripts/node-dependency-health-check.mjs")
            Checked = 0
            Resolved = 0
        }
    }

    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    Push-Location $ProjectRoot
    try {
        $output = @(& node $script --project-root $ProjectRoot --json 2>&1 | ForEach-Object { [string]$_ })
        $code = $LASTEXITCODE
    }
    finally {
        Pop-Location
        $ErrorActionPreference = $old
    }

    $jsonLine = @($output | Where-Object { $_.TrimStart().StartsWith("{") } | Select-Object -Last 1)
    if ($jsonLine.Count -eq 0) {
        return [PSCustomObject]@{
            Complete = $false
            Issues = @("真实依赖检查器未返回可解析结果：" + (($output | Select-Object -Last 3) -join " | "))
            Checked = 0
            Resolved = 0
        }
    }

    try {
        $result = $jsonLine[0] | ConvertFrom-Json
        return [PSCustomObject]@{
            Complete = ([bool]$result.complete -and $code -eq 0)
            Issues = @($result.issues)
            Checked = [int]$result.checked
            Resolved = [int]$result.resolved
        }
    }
    catch {
        return [PSCustomObject]@{
            Complete = $false
            Issues = @("真实依赖检查结果 JSON 无法解析")
            Checked = 0
            Resolved = 0
        }
    }
}

function Test-PnpmLockCoverage {
    param([object[]]$Inventory)

    $lockFile = Join-Path $ProjectRoot "pnpm-lock.yaml"
    if (-not (Test-Path -LiteralPath $lockFile)) {
        return [PSCustomObject]@{ Complete = $false; Missing = @("pnpm-lock.yaml") }
    }

    $text = Get-Content -LiteralPath $lockFile -Raw
    $missing = New-Object System.Collections.Generic.List[string]
    $seen = New-Object System.Collections.Generic.HashSet[string]

    foreach ($item in $Inventory) {
        if ($item.Section -notin @("dependencies","devDependencies","optionalDependencies")) { continue }
        if ([string]$item.Version -like "workspace:*") { continue }
        if (-not $seen.Add([string]$item.Name)) { continue }

        $name = [string]$item.Name
        if (-not $text.Contains($name)) { $missing.Add($name) }
    }

    return [PSCustomObject]@{
        Complete = ($missing.Count -eq 0)
        Missing = @($missing)
    }
}

function Compare-NodeDependencyInventory {
    param([object[]]$OldInventory,[object[]]$NewInventory)

    $oldMap = @{}
    $newMap = @{}
    foreach ($item in @($OldInventory)) {
        $oldMap[("{0}|{1}|{2}" -f $item.PackagePath,$item.Section,$item.Name)] = [string]$item.Version
    }
    foreach ($item in @($NewInventory)) {
        $newMap[("{0}|{1}|{2}" -f $item.PackagePath,$item.Section,$item.Name)] = [string]$item.Version
    }

    $added = New-Object System.Collections.Generic.List[string]
    $removed = New-Object System.Collections.Generic.List[string]
    $changed = New-Object System.Collections.Generic.List[string]

    foreach ($key in @($newMap.Keys | Sort-Object)) {
        if (-not $oldMap.ContainsKey($key)) {
            $added.Add(("{0} -> {1}" -f $key,$newMap[$key]))
        }
        elseif ($oldMap[$key] -ne $newMap[$key]) {
            $changed.Add(("{0}: {1} -> {2}" -f $key,$oldMap[$key],$newMap[$key]))
        }
    }
    foreach ($key in @($oldMap.Keys | Sort-Object)) {
        if (-not $newMap.ContainsKey($key)) {
            $removed.Add(("{0} <- {1}" -f $key,$oldMap[$key]))
        }
    }

    return [PSCustomObject]@{
        Added = @($added)
        Removed = @($removed)
        Changed = @($changed)
    }
}

function Get-NodeDependencyPlan {
    $snapshot = Get-NodeDependencySnapshot
    $installState = Test-NodeDependencyInstallState $snapshot.Inventory
    $runtimeHealth = Test-NodeDependencyRuntimeHealth
    $lockCoverage = Test-PnpmLockCoverage $snapshot.Inventory
    $storeHealth = Get-PnpmStoreHealth $snapshot.Inventory
    $state = Read-DependencyState
    $nodeState = if ($null -ne $state) { $state.node } else { $null }
    $reasons = New-Object System.Collections.Generic.List[string]
    $diff = Compare-NodeDependencyInventory @() $snapshot.Inventory

    if ($null -eq $nodeState) {
        if (-not $installState.Complete) { $reasons.Add("本地直接依赖尚未完整安装") }
        if (-not $runtimeHealth.Complete) { $reasons.Add("项目依赖真实解析/加载失败") }
        if (-not $lockCoverage.Complete) { $reasons.Add("pnpm-lock.yaml 尚未覆盖当前外部依赖") }
    }
    else {
        $diff = Compare-NodeDependencyInventory @($nodeState.inventory) $snapshot.Inventory
        if ([string]$nodeState.fingerprint -ne $snapshot.Fingerprint) {
            $reasons.Add("依赖声明或锁文件发生变化")
        }
        if (-not $installState.Complete) { $reasons.Add("本地直接依赖缺失或版本不匹配") }
        if (-not $runtimeHealth.Complete) { $reasons.Add("项目依赖真实解析/加载失败") }
        if (-not $lockCoverage.Complete) { $reasons.Add("pnpm-lock.yaml 与当前依赖声明不完整") }
    }

    $canAdopt = ($null -eq $nodeState -and $installState.Complete -and $runtimeHealth.Complete -and $lockCoverage.Complete)
    $needsInstall = (-not $canAdopt) -and ($reasons.Count -gt 0)
    $needsStoreRepair = -not $storeHealth.Healthy

    return [PSCustomObject]@{
        NeedsInstall = $needsInstall
        NeedsStoreRepair = $needsStoreRepair
        CanAdopt = $canAdopt
        Snapshot = $snapshot
        InstallState = $installState
        RuntimeHealth = $runtimeHealth
        StoreHealth = $storeHealth
        LockCoverage = $lockCoverage
        PreviousState = $nodeState
        Diff = $diff
        Reasons = @($reasons)
    }
}

function Show-NodeDependencyPlan {
    param([object]$Plan)

    if (-not $Plan.NeedsInstall) {
        if ($Plan.CanAdopt) {
            Write-Label "【检测】" "【项目依赖】" ("真实解析通过 {0}/{1} 项；首次建立增量基线，无需 pnpm install。" -f $Plan.RuntimeHealth.Resolved,$Plan.RuntimeHealth.Checked) Green
        }
        else {
            Write-Label "【检测】" "【项目依赖】" ("声明未变化，真实解析通过 {0}/{1} 项；无需 pnpm install。" -f $Plan.RuntimeHealth.Resolved,$Plan.RuntimeHealth.Checked) Green
        }
    }
    else {
        foreach ($reason in $Plan.Reasons) {
            Write-Label "【变化】" "【Node 依赖】" $reason Yellow
        }

        $diff = $Plan.Diff
        Write-Label "【差异】" "【依赖声明】" ("新增 {0} | 删除 {1} | 版本变化 {2}" -f $diff.Added.Count,$diff.Removed.Count,$diff.Changed.Count) Cyan
        foreach ($line in @($diff.Added | Select-Object -First 5)) { Write-Label "【新增】" "【依赖】" $line Green }
        foreach ($line in @($diff.Changed | Select-Object -First 5)) { Write-Label "【变更】" "【依赖】" $line Yellow }
        foreach ($line in @($diff.Removed | Select-Object -First 5)) { Write-Label "【删除】" "【依赖】" $line DarkYellow }

        if ($Plan.InstallState.Issues.Count -gt 0) {
            Write-Label "【缺失】" "【本地依赖】" ((@($Plan.InstallState.Issues | Select-Object -First 5)) -join "；") Yellow
        }
        if ($Plan.RuntimeHealth.Issues.Count -gt 0) {
            Write-Label "【失败】" "【真实解析】" ((@($Plan.RuntimeHealth.Issues | Select-Object -First 5)) -join "；") Yellow
        }
        if ($Plan.LockCoverage.Missing.Count -gt 0) {
            Write-Label "【锁文件】" "【待同步】" ((@($Plan.LockCoverage.Missing | Select-Object -First 8)) -join "、") Yellow
        }
    }

    if ($Plan.StoreHealth.Healthy) {
        Write-Label "【检测】" "【pnpm Store】" ("{0} | 来源：{1}" -f $Plan.StoreHealth.Reason,$Plan.StoreHealth.Source) Green
    }
    else {
        Write-Label "【警告】" "【pnpm Store】" ("{0} | {1} | 来源：{2}" -f $Plan.StoreHealth.Reason,$Plan.StoreHealth.Path,$Plan.StoreHealth.Source) Yellow
        if (-not $Plan.NeedsInstall -and $Plan.RuntimeHealth.Complete) {
            Write-Label "【说明】" "【项目状态】" "当前 node_modules 真实解析仍可用，但 pnpm Store 缓存缺失/不完整；后续离线修复或新安装可能需要重新下载。" DarkYellow
        }
    }
}

function Save-NodeDependencyState {
    $snapshot = Get-NodeDependencySnapshot
    $nodeState = [PSCustomObject]@{
        fingerprint = $snapshot.Fingerprint
        packageManager = $snapshot.PackageManager
        lockHash = $snapshot.LockHash
        workspaceHash = $snapshot.WorkspaceHash
        inventory = @($snapshot.Inventory)
        syncedAt = [DateTime]::UtcNow.ToString("o")
    }
    Write-DependencyState -NodeState $nodeState -PreserveRust
}


function Invoke-ProjectCommand {
    param([string]$FilePath,[string[]]$Arguments,[string]$Description)
    Write-Host ""
    Write-Label "【执行】" "【命令】" $Description Cyan
    Push-Location $ProjectRoot
    try {
        & $FilePath @Arguments
        $code = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($code -ne 0) { throw ("{0}失败，退出码：{1}" -f $Description,$code) }
}

function Invoke-Pnpm {
    param([string[]]$Arguments,[string]$Description)
    $runner = Get-PnpmRunner
    Invoke-ProjectCommand $runner.FilePath (@($runner.Prefix)+$Arguments) $Description
}

function Confirm-WriteOperation {
    param([string]$Description)
    Write-Host ""
    Write-Label "【写操作】" "【说明】" $Description Yellow
    return (Read-Host "【确认】【继续】输入 Y 确认，其他键取消") -match "^(?i:y|yes)$"
}

function Show-Environment {
    Write-Host ""
    Write-Label "【项目】" "【根目录】" $ProjectRoot Cyan

    $nodeVersion = Get-NodeVersionValue
    if ([string]::IsNullOrWhiteSpace($nodeVersion)) {
        Write-Label "【环境】" "【Node】" "未安装" Yellow
    }
    else {
        Write-Label "【环境】" "【Node】" ("{0} | {1}" -f $nodeVersion,(Get-CommandSource "node")) Gray
    }

    try {
        $runner = Get-PnpmRunner
        Write-Label "【环境】" "【pnpm】" ("{0} | {1}" -f $runner.Version,$runner.Source) Gray
    }
    catch {
        Write-Label "【环境】" "【pnpm】" ([string]$_.Exception.Message) Yellow
    }

    Write-Label "【环境】" "【corepack】" (Get-CommandVersion "corepack") Gray
    Write-Label "【环境】" "【cargo】" (Get-CommandVersion "cargo") Gray
    Write-Label "【环境】" "【rustc】" (Get-CommandVersion "rustc") Gray
    Write-Label "【项目】" "【Rust 版本】" (Get-ProjectRustChannel) Cyan

    $summary = Get-NodeDependencySummary
    Write-Label "【项目】" "【workspace】" ("{0} 个 Node workspace 项目" -f $summary.WorkspaceProjects) Cyan
    Write-Label "【项目】" "【Node 依赖】" ("声明 {0} 项；其中外部依赖 {1} 个" -f $summary.DependencyDeclarations,$summary.ExternalDependencies) Cyan

    if ($summary.ExternalDependencies -eq 0) {
        Write-Label "【说明】" "【node_modules】" "当前项目尚未声明第三方 Node 包；目录很小是正常现象。" DarkCyan
    }

    Show-DependencyLocations
    Write-Label "【规则】" "【包管理器】" "Node.js workspace 只允许 pnpm。" Green
}

function Test-NodePtyRuntime {
    $checkScript = Join-Path $ProjectRoot "scripts\check-node-pty.mjs"
    if (-not (Test-Path -LiteralPath $checkScript)) {
        Write-Label "【校验】" "【node-pty】" "缺少 scripts/check-node-pty.mjs。" Yellow
        return $false
    }

    $code = 1
    Push-Location $ProjectRoot
    try {
        & node $checkScript
        $code = $LASTEXITCODE
    }
    catch {
        $code = 1
    }
    finally {
        Pop-Location
    }

    return ($code -eq 0)
}

function Repair-PnpmStore {
    param([object]$Plan)

    if (-not $Plan.NeedsStoreRepair) {
        return [PSCustomObject]@{ Changed = $false; Cancelled = $false; Healthy = $true }
    }

    if (-not (Confirm-WriteOperation "pnpm Store 缓存缺失或不完整。是否按当前 pnpm-lock.yaml 补齐缺失缓存？不会更新依赖版本。")) {
        Write-Label "【跳过】" "【pnpm Store】" "用户选择不恢复 Store；当前项目若仍能解析可以继续使用，但后续安装/离线修复可能需要联网。" Yellow
        return [PSCustomObject]@{ Changed = $false; Cancelled = $true; Healthy = $false }
    }

    $storePath = Get-PnpmStorePath
    if ([string]::IsNullOrWhiteSpace($storePath) -or $storePath -eq "无法读取") {
        throw "无法读取 pnpm Store 路径，不能执行缓存修复。"
    }

    # 在线 fetch 也只在临时目录工作：按 lockfile 补 Store，不修改项目 node_modules。
    $repair = Invoke-PnpmStoreLockfileFetch -StorePath $storePath
    if (-not $repair.Success) {
        $detail = @($repair.Output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Last 5) -join " | "
        throw ("pnpm Store 缓存恢复失败：{0}" -f $detail)
    }

    $after = Get-PnpmStoreHealth $Plan.Snapshot.Inventory
    if (-not $after.Healthy) {
        throw ("pnpm Store 修复后仍未通过真实检查：{0}" -f $after.Reason)
    }
    Write-Label "【完成】" "【pnpm Store】" "当前 lockfile 所需缓存已恢复；项目 node_modules 未被重建。" Green
    return [PSCustomObject]@{ Changed = $true; Cancelled = $false; Healthy = $true }
}

function Install-NodeDependencies {
    [void](Ensure-ProjectPnpm)
    [void](Assert-NodeToolchain)
    $plan = Get-NodeDependencyPlan

    Show-NodeDependencyPlan $plan

    $changed = $false
    $cancelled = $false

    if ($plan.NeedsInstall) {
        Write-Label "【说明】" "【增量同步】" "pnpm 会复用已有 node_modules 与内容寻址 Store；本脚本不会清空后重装，也不会自动升级已锁定依赖版本。" DarkCyan
        if (-not (Confirm-WriteOperation "检测到项目依赖声明变化、真实解析失败或本地缺失。是否同步当前项目锁定依赖？选择 No 将保持现状，但当前项目版本可能无法正常运行。")) {
            Write-Label "【跳过】" "【Node 依赖】" "用户选择不修改项目依赖；本次未执行 pnpm install。" Yellow
            return [PSCustomObject]@{ Changed = $false; Cancelled = $true; ProjectHealthy = $plan.RuntimeHealth.Complete; StoreHealthy = $plan.StoreHealth.Healthy }
        }

        $installArguments = @("install","--reporter=append-only")
        $installDescription = "按当前 lockfile 修复/同步本地 pnpm 依赖"
        if (-not $plan.LockCoverage.Complete) {
            # 开发期依赖声明已经领先于 lockfile 时，必须允许 pnpm 更新 lockfile；
            # 正式发布仍由 release:full 使用 --frozen-lockfile，不能把两种语义混在一起。
            $installArguments += "--no-frozen-lockfile"
            $installDescription = "同步当前 workspace 依赖并更新 pnpm-lock.yaml"
            Write-Label "【模式】" "【pnpm】" "开发期同步：lockfile 落后，允许按当前声明更新 pnpm-lock.yaml；不会执行依赖升级命令。" DarkCyan
        }
        else {
            $installArguments += "--frozen-lockfile"
            Write-Label "【模式】" "【pnpm】" "精确修复：lockfile 已完整，保持锁文件不变。" DarkCyan
        }
        Write-Label "【执行】" "【pnpm】" ((@("pnpm") + $installArguments) -join " ") Gray
        Invoke-Pnpm $installArguments $installDescription
        $changed = $true

        $afterSnapshot = Get-NodeDependencySnapshot
        $afterInstallState = Test-NodeDependencyInstallState $afterSnapshot.Inventory
        $afterRuntimeHealth = Test-NodeDependencyRuntimeHealth
        $afterLockCoverage = Test-PnpmLockCoverage $afterSnapshot.Inventory
        if (-not $afterInstallState.Complete) {
            throw ("pnpm install 完成后本地依赖仍不完整：{0}" -f ($afterInstallState.Issues -join "；"))
        }
        if (-not $afterRuntimeHealth.Complete) {
            throw ("pnpm install 完成后真实依赖解析/加载仍失败：{0}" -f ($afterRuntimeHealth.Issues -join "；"))
        }
        if (-not $afterLockCoverage.Complete) {
            throw ("pnpm install 完成后 lockfile 仍未覆盖当前依赖：{0}" -f ($afterLockCoverage.Missing -join "、"))
        }

        Save-NodeDependencyState
        Write-Label "【完成】" "【Node 依赖】" "项目依赖已同步并通过真实解析检查。" Green

        $plan = Get-NodeDependencyPlan
    }
    elseif ($plan.CanAdopt -or $null -eq $plan.PreviousState) {
        Save-NodeDependencyState
        Write-Label "【状态】" "【依赖基线】" "已记录当前真实健康状态；状态缓存不会替代下次真实检查。" DarkCyan
    }

    $storeResult = Repair-PnpmStore $plan
    if ($storeResult.Changed) { $changed = $true }
    if ($storeResult.Cancelled) { $cancelled = $true }

    $finalRuntime = Test-NodeDependencyRuntimeHealth
    $finalStore = Get-PnpmStoreHealth $plan.Snapshot.Inventory
    if (-not $finalRuntime.Complete) {
        throw ("最终真实依赖检查失败：{0}" -f ($finalRuntime.Issues -join "；"))
    }

    return [PSCustomObject]@{
        Changed = $changed
        Cancelled = $cancelled
        ProjectHealthy = $finalRuntime.Complete
        StoreHealthy = $finalStore.Healthy
    }
}


function Get-ProjectRustChannel {
    $toolchainFile = Join-Path $ProjectRoot "rust-toolchain.toml"
    if (-not (Test-Path -LiteralPath $toolchainFile)) {
        throw "缺少 rust-toolchain.toml；项目必须显式锁定 Rust 工具链版本。"
    }

    $text = Get-Content -LiteralPath $toolchainFile -Raw
    $match = [regex]::Match($text, '(?m)^\s*channel\s*=\s*"([^"]+)"\s*$')
    if (-not $match.Success) {
        throw "rust-toolchain.toml 缺少有效 channel。"
    }

    return $match.Groups[1].Value.Trim()
}

function Get-CargoHomePath {
    if (-not [string]::IsNullOrWhiteSpace([string]$env:CARGO_HOME)) {
        return [System.IO.Path]::GetFullPath($env:CARGO_HOME)
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$env:USERPROFILE)) {
        return (Join-Path $env:USERPROFILE ".cargo")
    }
    return "未确定"
}

function Get-RustupHomePath {
    if (-not [string]::IsNullOrWhiteSpace([string]$env:RUSTUP_HOME)) {
        return [System.IO.Path]::GetFullPath($env:RUSTUP_HOME)
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$env:USERPROFILE)) {
        return (Join-Path $env:USERPROFILE ".rustup")
    }
    return "未确定"
}

function Get-CargoBinCandidates {
    $candidates = New-Object System.Collections.Generic.List[string]

    if (-not [string]::IsNullOrWhiteSpace([string]$env:CARGO_HOME)) {
        $candidates.Add((Join-Path $env:CARGO_HOME "bin"))
    }

    if (-not [string]::IsNullOrWhiteSpace([string]$env:USERPROFILE)) {
        $candidates.Add((Join-Path $env:USERPROFILE ".cargo\bin"))
    }

    return @($candidates | Select-Object -Unique)
}

function Get-CargoCommandPath {
    $command = Get-Command "cargo" -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }

    foreach ($bin in Get-CargoBinCandidates) {
        $candidate = Join-Path $bin "cargo.exe"
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    return $null
}

function Get-RustupCommandPath {
    $command = Get-Command "rustup" -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }

    foreach ($bin in Get-CargoBinCandidates) {
        $candidate = Join-Path $bin "rustup.exe"
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    return $null
}

function Add-CargoBinToCurrentPath {
    foreach ($cargoBin in Get-CargoBinCandidates) {
        if ((Test-Path -LiteralPath $cargoBin) -and
            (($env:PATH -split ";") -notcontains $cargoBin)) {
            $env:PATH = $cargoBin + ";" + $env:PATH
        }
    }
}


function Get-WindowsRustupTarget {
    # Windows PowerShell 5 可能以 32 位进程运行在 64 位系统上。
    # PROCESSOR_ARCHITEW6432 在这种情况下提供原生系统架构；否则使用当前进程架构。
    $architecture = [string]$env:PROCESSOR_ARCHITEW6432
    if ([string]::IsNullOrWhiteSpace($architecture)) {
        $architecture = [string]$env:PROCESSOR_ARCHITECTURE
    }

    $architecture = $architecture.Trim().ToUpperInvariant()

    switch ($architecture) {
        "AMD64" {
            return "x86_64-pc-windows-msvc"
        }
        "ARM64" {
            return "aarch64-pc-windows-msvc"
        }
        "X86" {
            if ([Environment]::Is64BitOperatingSystem) {
                return "x86_64-pc-windows-msvc"
            }
            return "i686-pc-windows-msvc"
        }
        default {
            throw ("无法识别当前 Windows CPU 架构：{0}。为避免下载错误的 Rust 官方安装器，Setup 已停止 Rust 自动安装。" -f $architecture)
        }
    }
}

function Invoke-OfficialRustupInstaller {
    $target = Get-WindowsRustupTarget
    $baseUrl = "https://static.rust-lang.org/rustup/dist/{0}/rustup-init.exe" -f $target
    $hashUrl = $baseUrl + ".sha256"

    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "lfaa-rustup"
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

    $installer = Join-Path $tempRoot "rustup-init.exe"
    $hashFile = Join-Path $tempRoot "rustup-init.exe.sha256"

    Write-Label "【检测】" "【Rust 平台】" $target DarkCyan
    Write-Label "【官方安装】" "【Rust/Cargo】" "当前未检测到 Rust，将使用 Rust 官方安装器自动补齐。" Cyan
    Write-Label "【校验】" "【SHA-256】" "执行前会下载 Rust 官方 SHA-256 并进行一致性校验。" DarkCyan
    Write-Label "【说明】" "【官方输出】" "后续 info: 英文为 Rust 官方 rustup 原始日志，保留原文便于排错。" DarkCyan

    try {
        Invoke-WebRequest -UseBasicParsing -Uri $baseUrl -OutFile $installer
        Invoke-WebRequest -UseBasicParsing -Uri $hashUrl -OutFile $hashFile

        $expectedText = (Get-Content -LiteralPath $hashFile -Raw).Trim()
        $match = [regex]::Match($expectedText, "(?i)\b[0-9a-f]{64}\b")
        if (-not $match.Success) { throw "Rust 官方 SHA-256 文件格式无法识别。" }

        $expected = $match.Value.ToLowerInvariant()
        $actual = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $expected) { throw ("Rustup SHA-256 校验失败。expected={0} actual={1}" -f $expected,$actual) }

        Write-Label "【校验】" "【通过】" "rustup-init.exe SHA-256 与 Rust 官方值一致。" Green

        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & $installer -y --profile minimal --default-toolchain none
            $installCode = $LASTEXITCODE
        }
        finally { $ErrorActionPreference = $oldPreference }

        if ($installCode -ne 0) {
            Write-Label "【提示】" "【Rustup】" ("官方 rustup-init 退出码：{0}" -f $installCode) Yellow
            return $false
        }

        Add-CargoBinToCurrentPath
        return (-not [string]::IsNullOrWhiteSpace((Get-RustupCommandPath)))
    }
    catch {
        Write-Label "【提示】" "【Rust 官方安装】" ([string]$_.Exception.Message) Yellow
        return $false
    }
    finally {
        Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $hashFile -Force -ErrorAction SilentlyContinue
    }
}

function Get-RustToolchainReadiness {
    Add-CargoBinToCurrentPath
    $channel = Get-ProjectRustChannel
    $rustupPath = Get-RustupCommandPath
    $cargoPath = Get-CargoCommandPath

    if ([string]::IsNullOrWhiteSpace($rustupPath)) {
        return [PSCustomObject]@{
            Ready = $false
            Channel = $channel
            RustupPath = $null
            CargoPath = $cargoPath
            Reason = "rustup 未安装"
        }
    }

    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $toolchains = @(& $rustupPath toolchain list 2>&1 | ForEach-Object { [string]$_ })
        $toolchainCode = $LASTEXITCODE
    }
    finally { $ErrorActionPreference = $old }

    if ($toolchainCode -ne 0) {
        return [PSCustomObject]@{
            Ready = $false
            Channel = $channel
            RustupPath = $rustupPath
            CargoPath = $cargoPath
            Reason = "无法读取 rustup toolchain list"
        }
    }

    $channelPattern = "^" + [regex]::Escape($channel) + "(?:-|\s|$)"
    $channelReady = $false
    foreach ($line in $toolchains) {
        if ($line -match $channelPattern) { $channelReady = $true; break }
    }
    if (-not $channelReady) {
        return [PSCustomObject]@{
            Ready = $false
            Channel = $channel
            RustupPath = $rustupPath
            CargoPath = $cargoPath
            Reason = ("项目 Rust {0} 尚未安装" -f $channel)
        }
    }

    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $components = @(& $rustupPath component list --toolchain $channel --installed 2>&1 | ForEach-Object { [string]$_ })
        $componentCode = $LASTEXITCODE
    }
    finally { $ErrorActionPreference = $old }

    if ($componentCode -ne 0) {
        return [PSCustomObject]@{
            Ready = $false
            Channel = $channel
            RustupPath = $rustupPath
            CargoPath = $cargoPath
            Reason = "无法读取已安装 Rust 组件"
        }
    }

    $hasRustfmt = $false
    $hasClippy = $false
    foreach ($line in $components) {
        if ($line -match '^rustfmt(?:-|$)') { $hasRustfmt = $true }
        if ($line -match '^clippy(?:-|$)') { $hasClippy = $true }
    }

    if (-not $hasRustfmt -or -not $hasClippy) {
        $missing = @()
        if (-not $hasRustfmt) { $missing += "rustfmt" }
        if (-not $hasClippy) { $missing += "clippy" }
        return [PSCustomObject]@{
            Ready = $false
            Channel = $channel
            RustupPath = $rustupPath
            CargoPath = $cargoPath
            Reason = ("缺少 Rust 组件：{0}" -f ($missing -join "、"))
        }
    }

    if ([string]::IsNullOrWhiteSpace($cargoPath)) {
        return [PSCustomObject]@{
            Ready = $false
            Channel = $channel
            RustupPath = $rustupPath
            CargoPath = $cargoPath
            Reason = "项目 Rust 工具链存在，但当前会话未找到 Cargo"
        }
    }

    return [PSCustomObject]@{
        Ready = $true
        Channel = $channel
        RustupPath = $rustupPath
        CargoPath = $cargoPath
        Reason = "已就绪"
    }
}

function Ensure-ProjectRustToolchain {
    $readiness = Get-RustToolchainReadiness
    if ($readiness.Ready) {
        Write-Label "【检测】" "【Rust】" ("{0} + rustfmt + clippy 已就绪；跳过 rustup toolchain install。" -f $readiness.Channel) Green
        return $true
    }

    $rustupPath = Get-RustupCommandPath
    if ([string]::IsNullOrWhiteSpace($rustupPath)) { return $false }

    $channel = Get-ProjectRustChannel
    Add-CargoBinToCurrentPath

    Write-Label "【Rust】" "【需要同步】" $readiness.Reason Yellow
    Write-Label "【Rust】" "【版本】" ("项目要求 Rust {0}，开始补齐缺失工具链/组件。" -f $channel) Cyan
    Write-Label "【说明】" "【官方输出】" "后续 info: 英文为 Rust 官方 rustup 原始日志，保留原文便于排错。" DarkCyan

    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $rustupPath toolchain install $channel --profile minimal --component rustfmt --component clippy
        $toolchainCode = $LASTEXITCODE
    }
    finally { $ErrorActionPreference = $oldPreference }

    if ($toolchainCode -ne 0) {
        Write-Label "【未完成】" "【Rust 项目版本】" ("无法准备项目要求的 Rust {0}。" -f $channel) Yellow
        return $false
    }

    Add-CargoBinToCurrentPath
    $after = Get-RustToolchainReadiness
    if (-not $after.Ready) {
        Write-Label "【未完成】" "【Rust 项目版本】" $after.Reason Yellow
        return $false
    }

    Push-Location $ProjectRoot
    try {
        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & cargo --version | Out-Host
            $cargoCode = $LASTEXITCODE
            & rustc --version | Out-Host
            $rustcCode = $LASTEXITCODE
        }
        finally { $ErrorActionPreference = $oldPreference }
    }
    finally { Pop-Location }

    return ($cargoCode -eq 0 -and $rustcCode -eq 0)
}

function Install-RustToolchainIfMissing {
    Add-CargoBinToCurrentPath

    $channel = Get-ProjectRustChannel
    $rustupPath = Get-RustupCommandPath
    $cargoPath = Get-CargoCommandPath

    if (-not [string]::IsNullOrWhiteSpace($rustupPath)) {
        Write-Label "【检测】" "【Rust】" ("已安装 | {0}" -f $rustupPath) Green

        if (Ensure-ProjectRustToolchain) {
            $cargoPath = Get-CargoCommandPath
            Write-Label "【完成】" "【Cargo】" ("{0} | {1}" -f (Get-CommandVersion "cargo"),$cargoPath) Green
            Write-Label "【完成】" "【rustc】" (Get-CommandVersion "rustc") Green
            return $true
        }

        return $false
    }

    if (-not [string]::IsNullOrWhiteSpace($cargoPath)) {
        Write-Label "【检测】" "【Cargo】" ("已发现 | {0}" -f $cargoPath) Green
        Write-Label "【补齐】" "【Rust】" "缺少 rustup，将使用 Rust 官方安装器补齐版本管理能力。" Yellow
    }
    else {
        Write-Host ""
        Write-Label "【缺失】" "【Rust/Cargo】" "当前未安装 Rust，将自动使用 Rust 官方安装器。" Yellow
    }

    if (-not (Invoke-OfficialRustupInstaller)) {
        Write-Label "【未完成】" "【Rust/Cargo】" "Rust 官方安装器执行后仍未得到可用 rustup。" Yellow
        return $false
    }

    Add-CargoBinToCurrentPath

    if (-not (Ensure-ProjectRustToolchain)) {
        return $false
    }

    $cargoPath = Get-CargoCommandPath
    if ([string]::IsNullOrWhiteSpace($cargoPath)) {
        Write-Label "【未完成】" "【Rust/Cargo】" "Rust 已尝试安装，但最终仍未找到 Cargo。" Yellow
        return $false
    }

    Write-Label "【完成】" "【Cargo】" ("{0} | {1}" -f (Get-CommandVersion "cargo"),$cargoPath) Green
    Write-Label "【完成】" "【rustc】" (Get-CommandVersion "rustc") Green
    return $true
}

function Test-RustDependencyDeclarations {
    $cargoFiles = Get-ChildItem -LiteralPath (Join-Path $ProjectRoot "crates") `
        -Filter "Cargo.toml" -File -Recurse -ErrorAction SilentlyContinue

    foreach ($file in $cargoFiles) {
        $text = Get-Content -LiteralPath $file.FullName -Raw

        if ($text -match '(?m)^\[(?:dev-|build-)?dependencies(?:\.[^\]]+)?\]\s*$' -or
            $text -match '(?m)^\[target\.[^\]]+\.dependencies\]\s*$') {
            return $true
        }
    }

    return $false
}

function Install-RustDependencies {
    $cargoPath = Get-CargoCommandPath
    if ([string]::IsNullOrWhiteSpace($cargoPath)) {
        throw "未检测到 Cargo。需要 Rust 功能时可运行菜单 1【按需依赖】，或自行准备项目要求的 Rust 工具链。"
    }

    $lockFile = Join-Path $ProjectRoot "Cargo.lock"
    if (-not (Test-Path -LiteralPath $lockFile)) {
        if (Test-RustDependencyDeclarations) {
            throw "检测到 Rust 外部依赖，但仓库缺少 Cargo.lock。为避免本机生成未受控锁文件，已停止；请先由开发版本提交 Cargo.lock。"
        }

        Write-Label "【Rust】" "【依赖】" "当前 Cargo workspace 尚未声明外部 crate；无需执行 cargo fetch。" Green
        return [PSCustomObject]@{ Changed = $false; Cancelled = $false }
    }

    $lockHash = Get-FileSha256Value $lockFile
    $state = Read-DependencyState
    $rustState = if ($null -ne $state) { $state.rust } else { $null }

    if ($null -ne $rustState -and [string]$rustState.lockHash -eq $lockHash) {
        Write-Label "【检测】" "【Rust 依赖】" "Cargo.lock 未变化；跳过 cargo fetch。" Green
        return [PSCustomObject]@{ Changed = $false; Cancelled = $false }
    }

    if (-not (Confirm-WriteOperation "检测到 Cargo.lock 首次同步或发生变化。是否获取当前项目锁定的 Rust 依赖？")) {
        Write-Label "【跳过】" "【Rust 依赖】" "用户选择不修改 Rust 依赖缓存；本次未执行 cargo fetch。" Yellow
        return [PSCustomObject]@{ Changed = $false; Cancelled = $true }
    }

    Invoke-ProjectCommand $cargoPath @("fetch","--locked") "按 Cargo.lock 获取缺失/变化的 Rust 依赖"
    $rustState = [PSCustomObject]@{
        lockHash = $lockHash
        channel = Get-ProjectRustChannel
        syncedAt = [DateTime]::UtcNow.ToString("o")
    }
    Write-DependencyState -RustState $rustState -PreserveNode
    Write-Label "【完成】" "【Rust 依赖】" "Cargo 依赖已同步；Cargo.lock 不变时后续会跳过 fetch。" Green
    return [PSCustomObject]@{ Changed = $true; Cancelled = $false }
}

function Initialize-ProjectResources {
    $root = Join-Path $ProjectRoot ".lfaa"
    foreach ($d in @("skills","experts","plugins","extensions","mcp","cache","state","tmp","logs")) {
        $p = Join-Path $root $d
        if (-not (Test-Path $p)) {
            New-Item -ItemType Directory -Path $p -Force | Out-Null
            Write-Label "【创建】" "【项目】" (".lfaa/{0}" -f $d) Green
        }
    }
}

function Invoke-GovernanceChecks {
    Invoke-ProjectCommand "node" @("scripts/governance-check.mjs") "运行项目治理检查"
    Invoke-ProjectCommand "node" @("scripts/import-path-check.mjs") "运行导入边界检查"
}

function Invoke-PnpmScript {
    param([string]$Name)
    Invoke-Pnpm @("run",$Name) ("运行 {0}" -f $Name)
}


function Get-WorkspacePackageData {
    param([string]$RelativePackageFile)

    $file = Join-Path $ProjectRoot $RelativePackageFile
    if (-not (Test-Path -LiteralPath $file)) {
        throw ("缺少 workspace package.json：{0}" -f $RelativePackageFile)
    }

    try {
        return Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
    }
    catch {
        throw ("无法读取 workspace package.json：{0}" -f $RelativePackageFile)
    }
}

function Assert-WorkspaceScript {
    param(
        [string]$RelativePackageFile,
        [string]$ScriptName,
        [string]$DisplayName
    )

    $data = Get-WorkspacePackageData $RelativePackageFile
    $script = $data.scripts.$ScriptName

    if ([string]::IsNullOrWhiteSpace([string]$script)) {
        throw ("{0} 尚未配置 {1} 脚本；当前功能未实现，不会伪装成功。" -f $DisplayName,$ScriptName)
    }
}

function Get-DesktopReleaseScript {
    $data = Get-WorkspacePackageData "apps\desktop\package.json"

    foreach ($candidate in @("make","package","release")) {
        $value = $data.scripts.$candidate
        if (-not [string]::IsNullOrWhiteSpace([string]$value)) {
            return $candidate
        }
    }

    return $null
}

function Invoke-PnpmForeground {
    param(
        [string[]]$Arguments,
        [string]$Description
    )

    $runner = Get-PnpmRunner
    $code = 0

    Write-Host ""
    Write-Label "【启动】" "【命令】" $Description Cyan

    Push-Location $ProjectRoot
    try {
        try {
            & $runner.FilePath @($runner.Prefix) @Arguments
            $code = $LASTEXITCODE
        }
        catch [System.Management.Automation.PipelineStoppedException] {
            $code = 130
        }
    }
    finally {
        Pop-Location
    }

    if ($code -notin @(0,130,-1073741510)) {
        throw ("{0}失败，退出码：{1}" -f $Description,$code)
    }

    Write-Label "【停止】" "【完成】" ("{0} 已停止。" -f $Description) Green
}


function Get-ActiveLocalTcpPorts {
    try {
        return @(
            [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().
                GetActiveTcpListeners() |
                ForEach-Object { [int]$_.Port } |
                Sort-Object -Unique
        )
    }
    catch {
        return @()
    }
}

function Test-LfaaWebDevServer {
    param([int]$Port)

    $request = $null
    $response = $null
    $reader = $null

    try {
        $request = [System.Net.HttpWebRequest]::Create(
            ("http://127.0.0.1:{0}/__lfaa/dev/resources" -f $Port)
        )
        $request.Method = "GET"
        $request.Timeout = 350
        $request.ReadWriteTimeout = 350
        $request.KeepAlive = $false
        $request.Proxy = $null

        $response = $request.GetResponse()

        if ([int]$response.StatusCode -ne 200) {
            return $false
        }

        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
        $content = $reader.ReadToEnd()
        $payload = $content | ConvertFrom-Json

        return $null -ne $payload.resources
    }
    catch {
        return $false
    }
    finally {
        if ($null -ne $reader) { $reader.Dispose() }
        if ($null -ne $response) { $response.Dispose() }
    }
}

function Resolve-LfaaWebDevPort {
    param(
        [int]$StartPort = 5173,
        [int]$EndPort = 5199
    )

    $activePorts = @(Get-ActiveLocalTcpPorts | Where-Object {
        $_ -ge $StartPort -and $_ -le $EndPort
    })

    # 只探测真正已经监听的端口。
    # 旧实现会对 5173-5199 每个端口做 1 秒 HTTP 超时，
    # 在没有任何 Web 服务时也可能白等二十多秒。
    foreach ($port in $activePorts) {
        if (Test-LfaaWebDevServer $port) {
            return [PSCustomObject]@{
                Mode = "reuse"
                Port = [int]$port
            }
        }
    }

    for ($port = $StartPort; $port -le $EndPort; $port++) {
        if ($activePorts -notcontains $port) {
            return [PSCustomObject]@{
                Mode = "start"
                Port = [int]$port
            }
        }
    }

    return $null
}

function Assert-WebDevelopmentDependencies {
    $required = @(
        "apps\web\node_modules\vite\package.json",
        "apps\web\node_modules\@xterm\xterm\package.json",
        "apps\web\node_modules\@xterm\addon-fit\package.json",
        "apps\web\node_modules\node-pty\package.json"
    )

    $missing = @()
    foreach ($relative in $required) {
        if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $relative))) {
            $missing += $relative
        }
    }

    if ($missing.Count -gt 0) {
        throw "Web 开发依赖未完整安装。可运行菜单 1【按需依赖】准备依赖，或直接使用项目 pnpm 命令完成安装后重试。"
    }
}

function Get-WebViteCommandPath {
    $candidates = @(
        (Join-Path $ProjectRoot "apps\web\node_modules\.bin\vite.cmd"),
        (Join-Path $ProjectRoot "node_modules\.bin\vite.cmd")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    throw "未找到本地 Vite。可运行菜单 1【按需依赖】准备项目依赖，或自行使用项目 pnpm 安装后重试。"
}

function Invoke-WebViteForeground {
    param(
        [string]$ViteCommand,
        [string]$WorkingDirectory,
        [int]$Port
    )

    $code = 0
    $oldPort = $env:LFAA_WEB_PORT
    $env:LFAA_WEB_PORT = [string]$Port

    Push-Location $WorkingDirectory
    try {
        try {
            & $ViteCommand
            $code = $LASTEXITCODE
        }
        catch [System.Management.Automation.PipelineStoppedException] {
            $code = 130
        }
    }
    finally {
        Pop-Location

        if ($null -eq $oldPort) {
            Remove-Item Env:LFAA_WEB_PORT -ErrorAction SilentlyContinue
        }
        else {
            $env:LFAA_WEB_PORT = $oldPort
        }
    }

    if ($code -notin @(0,130,-1073741510)) {
        throw ("Web / Vite 开发服务器失败，退出码：{0}" -f $code)
    }

    Write-Host ""
    Write-Label "【停止】" "【Web】" "Vite 开发服务器已停止。" Green
}

function Start-WebDevelopment {
    Assert-WorkspaceScript "apps\web\package.json" "dev" "Web 端"
    Assert-WebDevelopmentDependencies

    Write-Host ""
    Write-Label "【检测】" "【Web】" "正在快速检查本地 Vite 端口..." DarkGray

    $resolved = Resolve-LfaaWebDevPort
    if ($null -eq $resolved) {
        throw "5173-5199 均被占用，无法为 LFAA Web 分配本地开发端口。"
    }

    $url = "http://127.0.0.1:{0}" -f $resolved.Port

    if ($resolved.Mode -eq "reuse") {
        Write-Label "【已运行】" "【Web】" ("已检测到 LFAA Vite：{0}" -f $url) Green
        Write-Label "【处理】" "【复用】" "直接复用现有服务，不重复启动。" Cyan
        try { Start-Process $url | Out-Null } catch {}
        return
    }

    if ($resolved.Port -ne 5173) {
        Write-Label "【端口】" "【5173 已占用】" ("自动改用 {0}；不会结束未知进程。" -f $resolved.Port) Yellow
    }

    $viteCommand = Get-WebViteCommandPath
    $webRoot = Join-Path $ProjectRoot "apps\web"

    Write-Label "【启动】" "【Web】" ("Vite：{0}" -f $url) Green
    Write-Label "【热插拔】" "【监听】" ".lfaa/skills、experts、plugins、extensions、mcp" Cyan
    Write-Label "【提示】" "【停止】" "按 Ctrl+C 停止 Web；停止后会返回主菜单。" DarkGray

    Invoke-WebViteForeground $viteCommand $webRoot $resolved.Port
}

function Start-DesktopDevelopment {
    Assert-WorkspaceScript "apps\desktop\package.json" "dev" "桌面端"
    Write-Host ""
    Write-Label "【启动】" "【Desktop】" "启动 Electron Desktop 开发模式。" Green
    Write-Label "【提示】" "【停止】" "桌面开发进程运行期间保持窗口开启；按 Ctrl+C 停止。" DarkGray
    Invoke-PnpmForeground @("--filter","@lfaa/desktop","dev") "Electron Desktop 开发模式"
}

function Build-Web {
    Assert-WorkspaceScript "apps\web\package.json" "build" "Web 端"
    Invoke-Pnpm @("--filter","@lfaa/web","build") "构建 Web production"
    Write-Label "【产物】" "【Web】" "apps/web/dist" Green
}

function Build-Desktop {
    Assert-WorkspaceScript "apps\desktop\package.json" "build" "桌面端"
    Invoke-Pnpm @("--filter","@lfaa/desktop","build") "构建 Desktop production"
}

function Build-AndReleaseAll {
    Assert-WorkspaceScript "apps\web\package.json" "build" "Web 端"
    Assert-WorkspaceScript "apps\desktop\package.json" "build" "桌面端"

    $desktopReleaseScript = Get-DesktopReleaseScript
    if ([string]::IsNullOrWhiteSpace($desktopReleaseScript)) {
        throw "桌面端尚未配置 make/package/release 脚本；正式构建发布暂不可执行。"
    }

    Write-Host ""
    Write-Label "【预检】" "【构建发布】" "Web 与 Desktop 发布脚本齐备，开始生成本地发布产物。" Cyan
    Write-Label "【说明】" "【远程】" "本操作只生成本地产物，不自动上传 GitHub 或其他远程服务。" DarkCyan

    Build-Web
    Build-Desktop
    Invoke-Pnpm @("--filter","@lfaa/desktop",$desktopReleaseScript) ("生成 Desktop 发布产物：{0}" -f $desktopReleaseScript)

    Write-Host ""
    Write-Label "【完成】" "【Web】" "Web production 已生成。" Green
    Write-Label "【完成】" "【Desktop】" "Desktop 本地发布产物已生成。" Green
}


function Test-NodeDependencyToolchain {
    try {
        [void](Assert-NodeToolchain)
        return $true
    }
    catch {
        return $false
    }
}

function Test-RustDependencyToolchain {
    return -not [string]::IsNullOrWhiteSpace((Get-CargoCommandPath))
}

function Invoke-CheckCenter {
    Write-Host ""
    Write-Host "------------------------------------------------------------" -ForegroundColor DarkCyan
    Write-Host " LFAA 检查中心" -ForegroundColor Cyan
    Write-Host "------------------------------------------------------------" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Label "【1】" "【快速检查】" "governance + typecheck + test；不安装依赖、不构建、不要求 Rust。" Green
    Write-Label "【2】" "【完整检查】" "快速检查 + build；不隐式安装依赖、不执行 Rust 发布检查。" Cyan
    Write-Label "【3】" "【正式发布】" "release:full：环境版本 + frozen install + 完整检查 + Rust；仅正式发布前按需执行。" Yellow
    Write-Label "【0】" "【返回】" "不执行检查，返回主菜单。" DarkGray

    $checkChoice = (Read-Host "【请选择】【0-3】").Trim()
    switch ($checkChoice) {
        "0" {
            Write-Label "【返回】" "【检查中心】" "未执行检查。" DarkGray
            return
        }
        "1" {
            Invoke-PnpmScript "quality:quick"
            Write-Label "【完成】" "【快速检查】" "快速检查通过。" Green
            return
        }
        "2" {
            Invoke-PnpmScript "quality:full"
            Write-Label "【完成】" "【完整检查】" "完整项目检查通过。" Green
            return
        }
        "3" {
            if (-not (Confirm-WriteOperation "正式发布检查会按 lockfile 冻结安装依赖，并执行 Rust 发布检查；只有准备正式发布时才需要运行。")) {
                Write-Label "【取消】" "【正式发布】" "用户已取消，本次未执行发布检查。" Yellow
                return
            }
            [void](Ensure-ProjectPnpm)
            Invoke-PnpmScript "release:full"
            Write-Label "【完成】" "【正式发布】" "完整发布门禁通过。" Green
            return
        }
        default {
            throw "无效检查选项，请输入 0 到 3。"
        }
    }
}

function Show-SetupMenu {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host " LFAA 开发、运行、构建与质量检查菜单" -ForegroundColor Cyan
    Write-Host " 作者：二鱼" -ForegroundColor DarkCyan
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Label "【1】" "【按需依赖】" "首次配置、依赖变化或环境损坏时使用；环境已就绪可跳过，不是每次开发都必须执行。" Green
    Write-Label "【2】" "【启动 Web】" "启动 Vite Web 开发服务器，并启用 .lfaa 本地热插拔监听。" Green
    Write-Label "【3】" "【启动桌面】" "启动 Electron Desktop 开发模式；未配置时明确提示。" Green
    Write-Label "【4】" "【构建 Web】" "执行 Web production build。" Cyan
    Write-Label "【5】" "【构建桌面】" "执行 Desktop production build；未配置时明确提示。" Cyan
    Write-Label "【6】" "【构建发布】" "构建 Web + Desktop 并生成本地发布产物；不自动上传远程。" Magenta
    Write-Label "【7】" "【环境检查】" "查看项目根、Node/pnpm、Rust/Cargo、依赖状态与实际路径。" Cyan
    Write-Label "【8】" "【项目资源】" "初始化当前项目 .lfaa 缺失目录。" Magenta
    Write-Label "【9】" "【治理检查】" "运行治理、导入边界、开发日志和 docs 结构检查。" Yellow
    Write-Label "【10】" "【检查中心】" "按需选择快速检查、完整检查或正式发布检查；日常开发无需每次跑最重门禁。" Yellow
    Write-Label "【0】" "【退出】" "不执行任何操作。" DarkGray
}
if (-not (Test-Path (Join-Path $ProjectRoot "lfaa.release.json"))) {
    Stop-Lfaa "脚本所在目录不是有效的 LFAA 项目根。"
}

$firstMenu = $true

while ($true) {
    if (-not $firstMenu) {
        try { Clear-Host } catch {}
    }
    $firstMenu = $false

    Show-SetupMenu
    $choice = (Read-Host "【请选择】【0-10】").Trim()

    if ($choice -eq "0") {
        Write-Host ""
        Write-Label "【退出】" "【完成】" "已退出 LFAA 开发菜单。" Green
        exit 0
    }

    $menuMessage = "操作结束，按任意键返回主菜单。"

    try {
        switch ($choice) {
            "1" {
                try {
                    [void](Assert-NodeVersion)
                }
                catch {
                    Show-Environment
                    throw
                }

                Write-Host ""
                [void](Ensure-ProjectPnpm)
                $nodeToolchain = Assert-NodeToolchain
                $nodeSummary = Get-NodeDependencySummary

                Write-Label "【环境】" "【Node】" ("{0} | {1}" -f $nodeToolchain.NodeVersion,$nodeToolchain.NodeSource) Green
                Write-Label "【环境】" "【pnpm】" ("{0} | {1}" -f $nodeToolchain.PnpmVersion,$nodeToolchain.PnpmSource) Green
                Write-Label "【项目】" "【workspace】" ("{0} 个项目 | 外部 Node 依赖 {1} 个" -f $nodeSummary.WorkspaceProjects,$nodeSummary.ExternalDependencies) Cyan
                Show-DependencyLocations

                $nodeResult = Install-NodeDependencies

                $rustReadiness = Get-RustToolchainReadiness
                $cargoReady = $rustReadiness.Ready
                $rustSkipped = $false

                if ($rustReadiness.Ready) {
                    Write-Label "【状态】" "【Rust/Cargo】" ("{0} 已就绪；无需安装工具链。" -f $rustReadiness.Channel) Green
                }
                else {
                    Write-Label "【状态】" "【Rust/Cargo】" $rustReadiness.Reason Yellow
                    if (Confirm-WriteOperation "Rust 工具链尚未满足当前项目要求。是否按 rust-toolchain.toml 补齐缺失工具链/组件？") {
                        $cargoReady = Install-RustToolchainIfMissing
                    }
                    else {
                        $rustSkipped = $true
                        Write-Label "【跳过】" "【Rust/Cargo】" "用户选择暂不修改 Rust 环境。" Yellow
                    }
                }

                $rustDependencyResult = $null
                if ($cargoReady) {
                    $rustDependencyResult = Install-RustDependencies
                }
                else {
                    Write-Label "【待补齐】" "【Rust/Cargo】" "Rust 环境尚未完成；Node/pnpm 依赖检测不受影响。" Yellow
                }

                Initialize-ProjectResources

                Write-Host ""
                $rustChanged = ($null -ne $rustDependencyResult -and $rustDependencyResult.Changed) -or (-not $rustReadiness.Ready -and $cargoReady)
                if ($nodeResult.Cancelled -or $rustSkipped) {
                    Write-Label "【保留现状】" "【按需依赖】" "已完成真实检测；用户取消的修复项保持现状。" Yellow
                    $menuMessage = "按任意键返回主菜单。"
                }
                elseif (-not $nodeResult.ProjectHealthy) {
                    Write-Label "【未就绪】" "【按需依赖】" "项目 Node 依赖真实解析未通过，请查看上方原因。" Yellow
                    $menuMessage = "按任意键返回主菜单。"
                }
                elseif (-not $nodeResult.StoreHealthy) {
                    Write-Label "【部分就绪】" "【按需依赖】" "项目 Node 依赖当前可用，但 pnpm Store 缓存未恢复；不能标记为全部依赖就绪。" Yellow
                    $menuMessage = "按任意键返回主菜单。"
                }
                elseif (-not $cargoReady) {
                    Write-Label "【部分完成】" "【按需依赖】" "Node 项目依赖与 pnpm Store 已确认；Rust 环境尚未完成，请查看上方原因。" Yellow
                    $menuMessage = "按任意键返回主菜单。"
                }
                elseif ($nodeResult.Changed -or $rustChanged) {
                    Write-Label "【完成】" "【按需依赖】" "所需依赖/缓存同步完成，并通过真实健康检查。" Green
                    $menuMessage = "按任意键返回主菜单。"
                }
                else {
                    Write-Label "【完成】" "【按需依赖】" "项目依赖、pnpm Store 与 Rust 环境均已真实确认；无需下载或安装。" Green
                    $menuMessage = "按任意键返回主菜单。"
                }
            }

            "2" {
                Start-WebDevelopment
                $menuMessage = "Web 操作已结束，按任意键返回主菜单。"
            }

            "3" {
                Start-DesktopDevelopment
                $menuMessage = "Desktop 操作已结束，按任意键返回主菜单。"
            }

            "4" {
                Build-Web
                $menuMessage = "Web 构建完成，按任意键返回主菜单。"
            }

            "5" {
                Build-Desktop
                $menuMessage = "Desktop 构建完成，按任意键返回主菜单。"
            }

            "6" {
                Build-AndReleaseAll
                $menuMessage = "构建发布操作完成，按任意键返回主菜单。"
            }

            "7" {
                Show-Environment
                $menuMessage = "环境检查完成，按任意键返回主菜单。"
            }

            "8" {
                if (-not (Confirm-WriteOperation "将在当前项目创建缺失的 .lfaa 目录。")) {
                    Write-Host ""
                    Write-Label "【取消】" "【项目资源】" "用户已取消，本次未修改项目资源。" Yellow
                    $menuMessage = "已取消，按任意键返回主菜单。"
                    break
                }

                Initialize-ProjectResources
                $menuMessage = "项目资源检查完成，按任意键返回主菜单。"
            }

            "9" {
                Invoke-PnpmScript "governance:check"
                $menuMessage = "治理检查完成，按任意键返回主菜单。"
            }

            "10" {
                Invoke-CheckCenter
                $menuMessage = "检查中心操作结束，按任意键返回主菜单。"
            }

            default {
                throw "无效选项，请输入 0 到 10。"
            }
        }
    }
    catch {
        Write-Host ""
        Write-Label "【错误】" "【失败】" ([string]$_.Exception.Message) Red
        $menuMessage = "操作未完成，按任意键返回主菜单。"
    }

    Wait-LfaaMenu $menuMessage
}

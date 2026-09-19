# 文件：lfaa-sync.ps1
# 作用：把版本包安全同步到稳定工作区。
# 负责：差异预览、目标路径推导、保护项、镜像校验、治理检查、同步日志。
# 不负责：Git Commit/Push、依赖安装、Web 启动。
# 状态归属：稳定工作区文件状态由磁盘内容决定，本脚本不保存业务状态。
# 对外接口：由根目录 LFAA-Sync.bat 调用，可选 -TargetRoot。
# 关联文件：LFAA-Sync.bat、docs/RUNTIME.md、scripts/governance-check.mjs。
# 修改注意事项：.git / 本机日志 / node_modules / target / .env 等保护项不能被版本包删除；默认目标必须稳定指向版本目录同级 lfaa。

param(
    [string]$TargetRoot = ""
)

$ErrorActionPreference = "Stop"

# Force UTF-8 console output so Chinese status labels do not become garbled.
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
$Cp437 = [System.Text.Encoding]::GetEncoding(437)
$Cp936 = [System.Text.Encoding]::GetEncoding(936)
$LegacyPathEncodings = @($Cp437, $Cp936)
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
try { & chcp.com 65001 | Out-Null } catch {}

$RepoName = "LFAA"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$ProjectParent = Split-Path -Parent $ProjectRoot

function Resolve-DefaultTargetRoot {
    param([string]$SourceRoot)

    $cursor = [System.IO.DirectoryInfo](Get-Item -LiteralPath $SourceRoot)
    while ($null -ne $cursor) {
        if ($cursor.Name -match "^LFAA-v\d+\.\d+\.\d+$") {
            if ($null -ne $cursor.Parent) {
                return (Join-Path $cursor.Parent.FullName "lfaa")
            }
            break
        }
        $cursor = $cursor.Parent
    }

    return (Join-Path (Split-Path -Parent $SourceRoot) "lfaa")
}

if ([string]::IsNullOrWhiteSpace($TargetRoot)) {
    $TargetRoot = Resolve-DefaultTargetRoot $ProjectRoot
}
$TargetRoot = [System.IO.Path]::GetFullPath($TargetRoot)

$ProtectedTopDirs = @(
    ".git",
    "node_modules",
    "target",
    "dist",
    "coverage",
    ".cache",
    ".tmp"
)

$ProtectedRootFiles = @(
    ".env",
    ".env.local",
    ".env.development.local",
    ".env.production.local",
    ".env.test.local"
)

# 当版本包与稳定工作区的依赖声明完全相同时，保留目标工作区已经由 pnpm 生成的有效 lockfile。
# 这避免每次版本同步都用发布包中的旧 lockfile 覆盖本机有效 lockfile，从而触发无意义的 pnpm install。
$script:PreserveTargetPnpmLock = $false

function Write-Label {
    param(
        [Parameter(Mandatory = $true)][string]$Left,
        [Parameter(Mandatory = $true)][string]$Right,
        [Parameter(Mandatory = $true)][string]$Text,
        [ConsoleColor]$Color = [ConsoleColor]::Gray
    )
    Write-Host ("{0}{1} " -f $Left, $Right) -ForegroundColor $Color -NoNewline
    Write-Host $Text
}


function Wait-LfaaClose {
    param(
        [Parameter(Mandatory = $true)]
        [bool]$Success
    )

    Write-Host ""

    if ($Success) {
        Write-Label "【提示】" "【可关闭】" "全部操作已完成，现在可以安全关闭终端窗口。" Green
    }
    else {
        Write-Label "【提示】" "【可关闭】" "错误信息已经保留，现在可以关闭窗口；处理问题后再重新运行。" Yellow
    }

    Write-Label "【提示】" "【操作】" "按任意键关闭窗口，或直接点击右上角 X。" DarkGray

    try {
        [void][System.Console]::ReadKey($true)
    }
    catch {
        # 某些非交互终端不支持 ReadKey；这种情况下直接返回。
    }
}

function Stop-Lfaa {
    param([string]$Message)
    Write-Host ""
    Write-Label "【错误】" "【ERROR】" $Message Red
    Wait-LfaaClose -Success $false
    exit 1
}

function Normalize-RelativePath {
    param([string]$RelativePath)
    return ($RelativePath -replace "\\", "/").TrimStart("/")
}

function Get-RelativePath {
    param(
        [string]$Root,
        [string]$FullName
    )
    $rootFull = [System.IO.Path]::GetFullPath($Root)
    if (-not $rootFull.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $rootFull += [System.IO.Path]::DirectorySeparatorChar
    }

    $rootUri = New-Object System.Uri($rootFull)
    $fileUri = New-Object System.Uri([System.IO.Path]::GetFullPath($FullName))
    $relativeUri = $rootUri.MakeRelativeUri($fileUri)
    return Normalize-RelativePath ([System.Uri]::UnescapeDataString($relativeUri.ToString()))
}

function Get-RecoveredUnicodeName {
    param([string]$Name)

    if ([string]::IsNullOrWhiteSpace($Name)) {
        return $null
    }

    foreach ($legacyEncoding in $LegacyPathEncodings) {
        try {
            $bytes = $legacyEncoding.GetBytes($Name)
            $recovered = $Utf8Strict.GetString($bytes)
        }
        catch {
            continue
        }

        if (($recovered -ne $Name) -and ($recovered -match "[\u3400-\u9FFF]")) {
            return $recovered
        }
    }

    return $null
}

function Assert-SourcePathEncoding {
    param([string]$Root)

    $issues = New-Object System.Collections.ArrayList
    $seen = @{}

    Get-ChildItem -LiteralPath $Root -Recurse -Force | ForEach-Object {
        $recovered = Get-RecoveredUnicodeName $_.Name
        if ([string]::IsNullOrWhiteSpace($recovered)) {
            return
        }

        $relative = Get-RelativePath $Root $_.FullName
        $key = ($relative + "|" + $recovered).ToLowerInvariant()
        if (-not $seen.ContainsKey($key)) {
            $seen[$key] = $true
            [void]$issues.Add([PSCustomObject]@{
                Relative = $relative
                Recovered = $recovered
            })
        }
    }

    if ($issues.Count -eq 0) {
        Write-Label "【检查】" "【路径编码】" "源版本包文件名编码正常。" Green
        return
    }

    Write-Host ""
    Write-Label "【错误】" "【路径编码】" "源版本包检测到疑似中文文件名乱码，已阻止同步。" Red

    $shown = 0
    foreach ($item in $issues) {
        Write-Host ("  {0}" -f $item.Relative) -ForegroundColor Red
        Write-Host ("    可能应为: {0}" -f $item.Recovered) -ForegroundColor Yellow
        $shown++
        if ($shown -ge 20) {
            break
        }
    }

    if ($issues.Count -gt $shown) {
        Write-Label "【提示】" "【更多】" ("另有 {0} 个疑似乱码路径未展开显示。" -f ($issues.Count - $shown)) DarkYellow
    }

    Stop-Lfaa "源版本包路径编码异常。请不要同步此版本包，重新获取修复后的发布包。"
}

function Test-ProtectedPath {
    param([string]$RelativePath)

    $rel = Normalize-RelativePath $RelativePath
    if ([string]::IsNullOrWhiteSpace($rel)) {
        return $false
    }

    if ($script:PreserveTargetPnpmLock -and $rel -ieq "pnpm-lock.yaml") {
        return $true
    }

    # Runtime workspace-sync logs live under docs for visibility, but they are
    # local execution artifacts: keep them out of mirror diff/delete checks.
    if ($rel -imatch "^docs/logs/runtime/workspace-sync/.+\.log$") {
        return $true
    }

    if ($rel -imatch "^docs/logs/runtime/github-push/.+\.log$") {
        return $true
    }

    if ($rel -imatch "^docs/logs/runtime/source-update/.+\.log$") {
        return $true
    }

    # Legacy runtime log paths are still protected after the v0.0.20 move.
    if ($rel -imatch "^docs/logs/(workspace-sync|github-push|source-update)/.+\.log$") {
        return $true
    }

    if ($rel -imatch "^\.lfaa/(cache|state|tmp|logs)(/|$)") { return $true }

    $segments = $rel.Split("/")

    foreach ($segment in $segments) {
        foreach ($dir in $ProtectedTopDirs) {
            if ($segment -ieq $dir) {
                return $true
            }
        }
    }

    foreach ($file in $ProtectedRootFiles) {
        if ($rel -ieq $file) {
            return $true
        }
    }

    return $false
}



function Assert-SourcePackageIntegrity {
    param([string]$Root)

    # 来源版本包必须在任何 diff / delete 计划生成前先证明自己完整。
    # 这里复用与 Git Push 相同的静态 preflight；它不依赖 node_modules，
    # 可以阻止「发布 ZIP 漏掉隐藏目录 -> Sync 把稳定工作区对应文件删掉」的破坏性链路。
    $preflightRelative = "scripts\workspace-preflight.mjs"
    $preflight = Join-Path $Root $preflightRelative
    if (-not (Test-Path -LiteralPath $preflight)) {
        Stop-Lfaa "源版本包缺少 $preflightRelative；已在修改稳定工作区之前停止同步。"
    }

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Stop-Lfaa "同步前需要 Node.js 执行源版本包完整性预检；当前未检测到 node。"
    }

    Write-Label "【检查】" "【来源预检】" "正在验证版本包完整性；通过前不会修改稳定工作区..." Cyan

    Push-Location $Root
    try {
        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $sourcePreflightOutput = @(
                & node "scripts\workspace-preflight.mjs" "--root" $Root 2>&1 | ForEach-Object { [string]$_ }
            )
            $sourcePreflightCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $oldPreference
        }
    }
    finally {
        Pop-Location
    }

    if ($sourcePreflightCode -ne 0) {
        Write-Host ""
        Write-Label "【诊断】" "【来源包失败】" "版本包自身不完整或治理不通过；稳定工作区尚未被修改。" Yellow
        foreach ($line in $sourcePreflightOutput) {
            Write-Host ("  " + [string]$line) -ForegroundColor DarkYellow
        }
        Stop-Lfaa "源版本包预检失败。请换用完整发布包，不要继续同步当前目录。"
    }

    Write-Label "【检查】" "【来源通过】" "版本包完整性预检通过。" Green
}

function Get-Sha256Text {
    param([string]$Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
        return (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join "")
    }
    finally { $sha.Dispose() }
}

function Get-DependencyDeclarationFingerprint {
    param([string]$Root)
    if (-not (Test-Path -LiteralPath $Root)) { return "missing" }

    $lines = New-Object System.Collections.Generic.List[string]
    $workspace = Join-Path $Root "pnpm-workspace.yaml"
    if (Test-Path -LiteralPath $workspace) {
        $workspaceText = (Get-Content -LiteralPath $workspace -Raw) -replace "`r`n","`n"
        $lines.Add("workspace=" + $workspaceText)
    }

    $packageFiles = New-Object System.Collections.Generic.List[string]
    $rootManifest = Join-Path $Root "package.json"
    if (Test-Path -LiteralPath $rootManifest) { $packageFiles.Add($rootManifest) }
    foreach ($top in @("apps","packages")) {
        $dir = Join-Path $Root $top
        if (-not (Test-Path -LiteralPath $dir)) { continue }
        Get-ChildItem -LiteralPath $dir -Recurse -Filter package.json -File -ErrorAction SilentlyContinue | Where-Object {
            $_.FullName -notmatch "[\\/](node_modules|dist|target)[\\/]"
        } | ForEach-Object { $packageFiles.Add($_.FullName) }
    }

    foreach ($file in @($packageFiles | Sort-Object -Unique)) {
        try { $data = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json }
        catch { continue }
        $relative = Get-RelativePath $Root $file
        foreach ($section in @("dependencies","devDependencies","optionalDependencies","peerDependencies")) {
            $block = $data.$section
            if ($null -eq $block) { continue }
            foreach ($prop in @($block.PSObject.Properties | Sort-Object Name)) {
                $lines.Add(("{0}|{1}|{2}|{3}" -f $relative,$section,[string]$prop.Name,[string]$prop.Value))
            }
        }
    }
    return (Get-Sha256Text ($lines -join "`n"))
}

function Should-PreserveTargetPnpmLock {
    param([string]$SourceRoot,[string]$DestinationRoot)
    $targetLock = Join-Path $DestinationRoot "pnpm-lock.yaml"
    $sourceLock = Join-Path $SourceRoot "pnpm-lock.yaml"
    if (-not (Test-Path -LiteralPath $targetLock) -or -not (Test-Path -LiteralPath $sourceLock)) { return $false }

    $sourceFingerprint = Get-DependencyDeclarationFingerprint $SourceRoot
    $targetFingerprint = Get-DependencyDeclarationFingerprint $DestinationRoot
    if ($sourceFingerprint -ne $targetFingerprint) { return $false }

    # 如果来源 lockfile 明显更完整，则允许版本包升级目标 lockfile；否则保留本机有效版本。
    $sourceLength = (Get-Item -LiteralPath $sourceLock).Length
    $targetLength = (Get-Item -LiteralPath $targetLock).Length
    return ($targetLength -ge $sourceLength)
}

function Get-FileMap {
    param([string]$Root)

    $map = @{}
    if (-not (Test-Path -LiteralPath $Root)) {
        return $map
    }

    Get-ChildItem -LiteralPath $Root -Recurse -File -Force | ForEach-Object {
        $rel = Get-RelativePath $Root $_.FullName
        if (-not (Test-ProtectedPath $rel)) {
            $key = $rel.ToLowerInvariant()
            $map[$key] = [PSCustomObject]@{
                Relative = $rel
                FullName = $_.FullName
                Length = $_.Length
                LastWriteTimeUtc = $_.LastWriteTimeUtc
            }
        }
    }

    return $map
}

function Test-SameFile {
    param(
        [string]$Source,
        [string]$Target
    )

    $src = Get-Item -LiteralPath $Source
    $dst = Get-Item -LiteralPath $Target

    if ($src.Length -ne $dst.Length) {
        return $false
    }

    $srcHash = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash
    $dstHash = (Get-FileHash -LiteralPath $Target -Algorithm SHA256).Hash
    return ($srcHash -eq $dstHash)
}

function Get-SyncPlan {
    param(
        [string]$SourceRoot,
        [string]$DestinationRoot
    )

    $sourceMap = Get-FileMap $SourceRoot
    $targetMap = Get-FileMap $DestinationRoot

    $adds = New-Object System.Collections.ArrayList
    $mods = New-Object System.Collections.ArrayList
    $dels = New-Object System.Collections.ArrayList
    $same = 0

    foreach ($key in $sourceMap.Keys) {
        $src = $sourceMap[$key]

        if (-not $targetMap.ContainsKey($key)) {
            [void]$adds.Add($src)
            continue
        }

        $dst = $targetMap[$key]
        if (Test-SameFile $src.FullName $dst.FullName) {
            $same++
        }
        else {
            [void]$mods.Add([PSCustomObject]@{
                Relative = $src.Relative
                Source = $src.FullName
                Target = $dst.FullName
            })
        }
    }

    foreach ($key in $targetMap.Keys) {
        if (-not $sourceMap.ContainsKey($key)) {
            [void]$dels.Add($targetMap[$key])
        }
    }

    return [PSCustomObject]@{
        SourceMap = $sourceMap
        TargetMap = $targetMap
        Adds = @($adds | Sort-Object Relative)
        Mods = @($mods | Sort-Object Relative)
        Dels = @($dels | Sort-Object Relative)
        Same = $same
    }
}

function Show-Plan {
    param($Plan)

    Write-Host ""
    Write-Label "【对比】" "【SUMMARY】" ("新增 {0} | 修改 {1} | 删除 {2} | 未变化 {3}" -f `
        $Plan.Adds.Count, $Plan.Mods.Count, $Plan.Dels.Count, $Plan.Same) Cyan
    Write-Host ""

    foreach ($item in $Plan.Adds) {
        Write-Label "【新增】" "【ADD】" $item.Relative Green
    }

    foreach ($item in $Plan.Mods) {
        Write-Label "【修改】" "【MOD】" $item.Relative Yellow
    }

    foreach ($item in $Plan.Dels) {
        Write-Label "【删除】" "【DEL】" $item.Relative Red
    }

    if (($Plan.Adds.Count + $Plan.Mods.Count + $Plan.Dels.Count) -eq 0) {
        Write-Label "【状态】" "【CLEAN】" "源版本与稳定工作区项目文件完全一致。" Green
    }
}

function Save-SyncLog {
    param(
        [string]$WorkspaceRoot,
        $Plan,
        [string]$Version,
        [string]$Status,
        [string[]]$TechnicalOutput = @()
    )

    $logDir = Join-Path $WorkspaceRoot "docs\logs\runtime\workspace-sync"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null

    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $safeVersion = $Version -replace "[^0-9A-Za-z._-]", "_"
    $logFile = Join-Path $logDir ("sync-{0}-v{1}.log" -f $stamp, $safeVersion)

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("LFAA Sync Log")
    $lines.Add("Time: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
    $lines.Add("Version: " + $Version)
    $lines.Add("Source: " + $ProjectRoot)
    $lines.Add("Target: " + $WorkspaceRoot)
    $lines.Add("Status: " + $Status)
    $lines.Add("")
    $lines.Add("ADD: " + $Plan.Adds.Count)
    $lines.Add("MOD: " + $Plan.Mods.Count)
    $lines.Add("DEL: " + $Plan.Dels.Count)
    $lines.Add("SAME: " + $Plan.Same)
    $lines.Add("")

    foreach ($item in $Plan.Adds) { $lines.Add("[ADD] " + $item.Relative) }
    foreach ($item in $Plan.Mods) { $lines.Add("[MOD] " + $item.Relative) }
    foreach ($item in $Plan.Dels) { $lines.Add("[DEL] " + $item.Relative) }

    if ($TechnicalOutput.Count -gt 0) {
        $lines.Add("")
        $lines.Add("Technical Output:")
        foreach ($line in $TechnicalOutput) { $lines.Add([string]$line) }
    }

    [System.IO.File]::WriteAllLines($logFile, $lines, (New-Object System.Text.UTF8Encoding($true)))
    return $logFile
}

function Verify-Mirror {
    param(
        [string]$SourceRoot,
        [string]$DestinationRoot
    )

    $plan = Get-SyncPlan $SourceRoot $DestinationRoot

    if (($plan.Adds.Count + $plan.Mods.Count + $plan.Dels.Count) -ne 0) {
        Write-Host ""
        Write-Label "【校验】" "【FAILED】" "同步后仍然存在差异：" Red
        Show-Plan $plan
        return $false
    }

    return $true
}

# ------------------------------------------------------------------
# Start
# ------------------------------------------------------------------
function Show-SyncMenu {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host " LFAA 稳定工作区同步菜单" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Label "【1】" "【执行同步】" "显示差异后确认，并同步到稳定工作区。" Green
    Write-Label "【2】" "【预览差异】" "只比较版本包与稳定工作区，不修改文件。" Cyan
    Write-Label "【3】" "【同步配置】" "查看来源、目标和保护规则。" Magenta
    Write-Label "【0】" "【退出】" "不执行任何同步操作。" DarkGray
    Write-Host ""
}

$SyncMenuMode = ""
while ([string]::IsNullOrWhiteSpace($SyncMenuMode)) {
    Show-SyncMenu
    $choice = Read-Host "【请选择】【0-3】"

    switch ($choice.Trim()) {
        "1" { $SyncMenuMode = "sync" }
        "2" { $SyncMenuMode = "preview" }
        "3" { $SyncMenuMode = "config" }
        "0" {
            Write-Label "【退出】" "【完成】" "未执行任何操作。" Green
            Wait-LfaaClose -Success $true
            exit 0
        }
        default {
            Write-Label "【提示】" "【无效选项】" "请输入 0、1、2 或 3。" Yellow
        }
    }
}

$releaseFile = Join-Path $ProjectRoot "lfaa.release.json"
if (-not (Test-Path -LiteralPath $releaseFile)) {
    Stop-Lfaa "源目录缺少 lfaa.release.json，无法确认这是有效 LFAA 版本包。"
}

$version = "unknown"
try {
    $releaseData = Get-Content -Raw -LiteralPath $releaseFile | ConvertFrom-Json
    if ($releaseData.displayVersion) {
        $version = [string]$releaseData.displayVersion
    }
}
catch {
    Stop-Lfaa "无法读取 lfaa.release.json。"
}

if ([System.IO.Path]::GetFullPath($ProjectRoot).TrimEnd("\") -ieq $TargetRoot.TrimEnd("\")) {
    Stop-Lfaa "源目录与目标工作区相同，禁止自我同步。"
}

Write-Host ""
Write-Label "【版本】" "【当前】" $version Magenta
Write-Label "【来源】" "【路径】" $ProjectRoot Cyan
Write-Label "【目标】" "【路径】" $TargetRoot Cyan

if ($SyncMenuMode -eq "config") {
    Write-Host ""
    Write-Label "【保护】" "【Git】" ".git 永远不会被同步删除。" Green
    Write-Label "【保护】" "【日志】" "docs/logs/runtime/*/*.log 保留为本机运行记录。" Green
    Write-Label "【保护】" "【Secret】" ".env / .env.local 等本机环境文件不会删除。" Green
    Write-Label "【保护】" "【缓存】" "node_modules、target、dist、coverage、.cache、.tmp 不参与镜像删除。" Green
    Wait-LfaaClose -Success $true
    exit 0
}

Write-Host ""
Write-Label "【检查】" "【路径编码】" "正在检查源版本包中文文件名..." Cyan
Assert-SourcePathEncoding $ProjectRoot
Assert-SourcePackageIntegrity $ProjectRoot

$script:PreserveTargetPnpmLock = Should-PreserveTargetPnpmLock -SourceRoot $ProjectRoot -DestinationRoot $TargetRoot
if ($script:PreserveTargetPnpmLock) {
    Write-Label "【依赖】" "【Lockfile】" "依赖声明未变化，保留稳定工作区现有 pnpm-lock.yaml；本次同步不会触发无意义的依赖重建。" Green
}

$plan = Get-SyncPlan $ProjectRoot $TargetRoot
Show-Plan $plan

Write-Host ""
Write-Label "【保护】" "【说明】" ".git、本机日志、依赖缓存和本地 .env 不会被同步删除。" DarkGray

if ($SyncMenuMode -eq "preview") {
    Write-Host ""
    Write-Label "【预览】" "【完成】" "以上仅为差异预览，没有修改任何文件。" Green
    Wait-LfaaClose -Success $true
    exit 0
}

# --------------------------------------------------------------
# Execute sync
# --------------------------------------------------------------
if (Test-Path -LiteralPath (Join-Path $TargetRoot ".git")) {
    Write-Label "【Git】" "【已存在】" "稳定工作区 .git 将永久保留。" Green

    if (Get-Command git -ErrorAction SilentlyContinue) {
        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"

        try {
            $gitStatus = @(
                & git -C $TargetRoot -c core.quotepath=false status --porcelain 2>&1 |
                    ForEach-Object { [string]$_ }
            )
            $gitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $oldPreference
        }

        if ($gitCode -eq 0 -and $gitStatus.Count -gt 0) {
            Write-Host ""
            Write-Label "【警告】" "【未提交修改】" "稳定工作区当前存在 Git 未提交变化：" Yellow
            foreach ($line in $gitStatus) {
                Write-Host ("  " + $line) -ForegroundColor Yellow
            }
        }
    }
}
else {
    Write-Label "【Git】" "【未初始化】" "同步不会创建 .git；首次推送时由 Git 推送脚本初始化。" DarkYellow
}

if (($plan.Adds.Count + $plan.Mods.Count + $plan.Dels.Count) -eq 0) {
    Write-Host ""
    Write-Label "【完成】" "【无需同步】" "稳定工作区已经与版本包一致。" Green
    Wait-LfaaClose -Success $true
    exit 0
}

Write-Host ""
$answer = Read-Host "【确认】【执行同步】输入 Y 确认，其他键取消"
if ($answer -notmatch "^(?i:y|yes)$") {
    Write-Label "【取消】" "【同步】" "用户取消，未修改任何文件。" Yellow
    Wait-LfaaClose -Success $true
    exit 0
}

if (-not (Test-Path -LiteralPath $TargetRoot)) {
    New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null
    Write-Label "【创建】" "【目标目录】" $TargetRoot Green
}

Write-Host ""
Write-Label "【同步】" "【进行中】" "开始应用文件变化..." Cyan

foreach ($item in $plan.Adds) {
    $dstFile = Join-Path $TargetRoot ($item.Relative -replace "/", "\")
    $dstDir = Split-Path -Parent $dstFile

    if (-not (Test-Path -LiteralPath $dstDir)) {
        New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
    }

    Copy-Item -LiteralPath $item.FullName -Destination $dstFile -Force
    Write-Label "【新增】" "【文件】" $item.Relative Green
}

foreach ($item in $plan.Mods) {
    $dstDir = Split-Path -Parent $item.Target

    if (-not (Test-Path -LiteralPath $dstDir)) {
        New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
    }

    Copy-Item -LiteralPath $item.Source -Destination $item.Target -Force
    Write-Label "【修改】" "【文件】" $item.Relative Yellow
}

foreach ($item in $plan.Dels) {
    if (Test-Path -LiteralPath $item.FullName) {
        Remove-Item -LiteralPath $item.FullName -Force
        Write-Label "【删除】" "【文件】" $item.Relative Red
    }
}

if (Test-Path -LiteralPath $TargetRoot) {
    Get-ChildItem -LiteralPath $TargetRoot -Recurse -Directory -Force |
        Sort-Object { $_.FullName.Length } -Descending |
        ForEach-Object {
            $rel = Get-RelativePath $TargetRoot $_.FullName

            if (-not (Test-ProtectedPath $rel)) {
                $children = Get-ChildItem -LiteralPath $_.FullName -Force
                if ($children.Count -eq 0) {
                    Remove-Item -LiteralPath $_.FullName -Force
                }
            }
        }
}

Write-Host ""
Write-Label "【校验】" "【进行中】" "开始逐文件 SHA-256 镜像校验..." Cyan

if (-not (Verify-Mirror $ProjectRoot $TargetRoot)) {
    $logFile = Save-SyncLog $TargetRoot $plan $version "VERIFY_FAILED"
    Write-Label "【日志】" "【路径】" $logFile DarkYellow
    Stop-Lfaa "同步后镜像校验失败，请检查上方差异。"
}

Write-Label "【校验】" "【通过】" "版本包项目文件与稳定工作区完全一致（保护项除外）。" Green

# 统一工作区预检：与 GitHub Push 完全共用同一个 Node 入口，避免 Sync 通过而 Push 才暴露另一套 Gate。
$workspacePreflight = Join-Path $TargetRoot "scripts\workspace-preflight.mjs"
if ((Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath $workspacePreflight)) {
    Write-Host ""
    Write-Label "【检查】" "【工作区预检】" "运行统一静态治理 Gate..." Cyan

    Push-Location $TargetRoot
    try {
        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $preflightOutput = @(
            & node "scripts\workspace-preflight.mjs" 2>&1 | ForEach-Object { [string]$_ }
        )
        $preflightCode = $LASTEXITCODE
        $ErrorActionPreference = $oldPreference
    }
    finally {
        Pop-Location
    }

    if ($preflightCode -ne 0) {
        Write-Host ""
        Write-Label "【诊断】" "【失败详情】" "以下就是同步后未通过的真实原因：" Yellow
        foreach ($line in $preflightOutput) {
            Write-Host ("  " + [string]$line) -ForegroundColor DarkYellow
        }
        $logFile = Save-SyncLog $TargetRoot $plan $version "PREFLIGHT_FAILED" $preflightOutput
        Write-Label "【日志】" "【路径】" $logFile DarkYellow
        Stop-Lfaa "工作区预检失败；请按上方具体 Gate/文件处理。"
    }

    Write-Label "【检查】" "【通过】" "统一工作区预检通过。" Green
}
else {
    Write-Label "【检查】" "【跳过】" "未检测到 Node 或 workspace-preflight；无法执行统一工作区预检。" DarkYellow
}

$logFile = Save-SyncLog $TargetRoot $plan $version "SUCCESS"

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkGreen
Write-Label "【完成】" "【同步成功】" ("LFAA v" + $version + " 已完整同步到稳定工作区。") Green
Write-Label "【日志】" "【路径】" $logFile DarkCyan
Write-Label "【目标】" "【路径】" $TargetRoot Cyan
Write-Host "============================================================" -ForegroundColor DarkGreen

Wait-LfaaClose -Success $true
exit 0

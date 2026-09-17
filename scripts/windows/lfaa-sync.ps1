param(
    [string]$TargetRoot = ""
)

$ErrorActionPreference = "Stop"

# Force UTF-8 console output so Chinese status labels do not become garbled.
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
try { & chcp.com 65001 | Out-Null } catch {}

$RepoName = "LFAA"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$ProjectParent = Split-Path -Parent $ProjectRoot

if ([string]::IsNullOrWhiteSpace($TargetRoot)) {
    $TargetRoot = Join-Path $ProjectParent "lfaa"
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

function Test-ProtectedPath {
    param([string]$RelativePath)

    $rel = Normalize-RelativePath $RelativePath
    if ([string]::IsNullOrWhiteSpace($rel)) {
        return $false
    }

    # Runtime workspace-sync logs live under docs for visibility, but they are
    # local execution artifacts: keep them out of mirror diff/delete checks.
    if ($rel -imatch "^docs/logs/workspace-sync/.+\.log$") {
        return $true
    }

    if ($rel -imatch "^docs/logs/github-push/.+\.log$") {
        return $true
    }

    if ($rel -imatch "^docs/logs/source-update/.+\.log$") {
        return $true
    }

    $segments = $rel.Split("/")
    $first = $segments[0]

    foreach ($dir in $ProtectedTopDirs) {
        if ($first -ieq $dir) {
            return $true
        }
    }

    foreach ($file in $ProtectedRootFiles) {
        if ($rel -ieq $file) {
            return $true
        }
    }

    return $false
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
        [string]$Status
    )

    $logDir = Join-Path $WorkspaceRoot "docs\logs\workspace-sync"
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
    Write-Label "【1】" "【预览差异】" "只比较版本包与稳定工作区，不修改文件。" Cyan
    Write-Label "【2】" "【执行同步】" "显示差异后确认，并同步到稳定工作区。" Green
    Write-Label "【3】" "【同步配置】" "查看来源、目标和保护规则。" Magenta
    Write-Label "【0】" "【退出】" "不执行任何同步操作。" DarkGray
    Write-Host ""
}

$SyncMenuMode = ""
while ([string]::IsNullOrWhiteSpace($SyncMenuMode)) {
    Show-SyncMenu
    $choice = Read-Host "【请选择】【0-3】"

    switch ($choice.Trim()) {
        "1" { $SyncMenuMode = "preview" }
        "2" { $SyncMenuMode = "sync" }
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
    Write-Label "【保护】" "【日志】" "docs/logs/*/*.log 保留为本机运行记录。" Green
    Write-Label "【保护】" "【Secret】" ".env / .env.local 等本机环境文件不会删除。" Green
    Write-Label "【保护】" "【缓存】" "node_modules、target、dist、coverage、.cache、.tmp 不参与镜像删除。" Green
    Wait-LfaaClose -Success $true
    exit 0
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

# Governance check - capture raw output, only show Chinese result.
$governance = Join-Path $TargetRoot "scripts\governance-check.mjs"
if ((Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath $governance)) {
    Write-Host ""
    Write-Label "【检查】" "【治理】" "运行 LFAA 项目治理检查..." Cyan

    Push-Location $TargetRoot
    try {
        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $governanceOutput = @(
            & node "scripts\governance-check.mjs" 2>&1 | ForEach-Object { [string]$_ }
        )
        $governanceCode = $LASTEXITCODE
        $ErrorActionPreference = $oldPreference
    }
    finally {
        Pop-Location
    }

    if ($governanceCode -ne 0) {
        $logFile = Save-SyncLog $TargetRoot $plan $version "GOVERNANCE_FAILED"
        Write-Label "【日志】" "【路径】" $logFile DarkYellow
        Stop-Lfaa "项目治理检查失败。"
    }

    Write-Label "【检查】" "【通过】" "项目治理检查通过。" Green
}
else {
    Write-Label "【检查】" "【跳过】" "未检测到 Node 或治理脚本，跳过自动检查。" DarkYellow
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

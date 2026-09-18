# 文件：lfaa-update.ps1
# 作用：更新已经 Git Clone 的 LFAA 源码工作区。
# 负责：远端检测、分支同步、必要备份、更新日志和交互菜单。
# 不负责：首次 clone、版本包镜像同步、GitHub 提交发布。
# 状态归属：Git 仓库当前分支和工作树是更新事实源。
# 对外接口：由根目录 LFAA-Update.bat 调用。
# 关联文件：LFAA-Update.bat、docs/logs/runtime/source-update/README.md。
# 修改注意事项：不得假定盘符或固定绝对路径；必须保护用户本地改动并清楚报告冲突。

$ErrorActionPreference = "Stop"

# Windows PowerShell 5.1 中文输出。
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
try { & chcp.com 65001 | Out-Null } catch {}

$DefaultBranch = "main"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PackageRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$LaunchDirectory = (Get-Location).Path

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
    param([Parameter(Mandatory = $true)][bool]$Success)

    Write-Host ""

    if ($Success) {
        Write-Label "【提示】" "【可关闭】" "全部更新操作已完成，现在可以安全关闭终端窗口。" Green
    }
    else {
        Write-Label "【提示】" "【可关闭】" "错误或阻止原因已经显示，现在可以关闭窗口；处理后再重新运行。" Yellow
    }

    Write-Label "【提示】" "【操作】" "按任意键关闭窗口，或直接点击右上角 X。" DarkGray

    try {
        [void][System.Console]::ReadKey($true)
    }
    catch {
    }
}

function Stop-Lfaa {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [string[]]$TechnicalOutput = @()
    )

    Write-Host ""
    Write-Label "【错误】" "【停止】" $Message Red

    if ($TechnicalOutput.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($WorkspaceRoot)) {
        try {
            $logDir = Join-Path $WorkspaceRoot "docs\logs\runtime\source-update"
            New-Item -ItemType Directory -Force -Path $logDir | Out-Null
            $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
            $logFile = Join-Path $logDir ("update-error-{0}.log" -f $stamp)

            $lines = New-Object System.Collections.Generic.List[string]
            $lines.Add("LFAA Source Update Error Log")
            $lines.Add("Time: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
            $lines.Add("Message: " + $Message)
            $lines.Add("")
            $lines.Add("Raw Git Output:")
            foreach ($line in $TechnicalOutput) {
                $lines.Add([string]$line)
            }

            [System.IO.File]::WriteAllLines(
                $logFile,
                $lines,
                (New-Object System.Text.UTF8Encoding($true))
            )

            Write-Label "【日志】" "【技术详情】" $logFile DarkYellow
        }
        catch {
        }
    }

    Wait-LfaaClose -Success $false
    exit 1
}

function Invoke-GitRaw {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$GitArgs
    )

    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    try {
        $captured = @(
            & git @GitArgs 2>&1 | ForEach-Object {
                [string]$_
            }
        )
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $oldPreference
    }

    return [PSCustomObject]@{
        ExitCode = $exitCode
        Output = $captured
    }
}

function Invoke-GitChecked {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$GitArgs,
        [Parameter(Mandatory = $true)]
        [string]$ActionName
    )

    $result = Invoke-GitRaw -GitArgs $GitArgs

    if ($result.ExitCode -ne 0) {
        Stop-Lfaa -Message ($ActionName + "失败。") -TechnicalOutput $result.Output
    }

    return $result
}

function Get-ReleaseVersion {
    param([string]$Root)

    $releaseFile = Join-Path $Root "lfaa.release.json"

    if (-not (Test-Path -LiteralPath $releaseFile)) {
        return "unknown"
    }

    try {
        $releaseData = Get-Content -Raw -LiteralPath $releaseFile | ConvertFrom-Json
        if ($releaseData.displayVersion) {
            return [string]$releaseData.displayVersion
        }
    }
    catch {
    }

    return "unknown"
}

function Save-UpdateLog {
    param(
        [string]$Root,
        [string]$OriginUrl,
        [string]$Branch,
        [string]$OldCommit,
        [string]$NewCommit,
        [string[]]$ChangedFiles,
        [string]$Result
    )

    $logDir = Join-Path $Root "docs\logs\runtime\source-update"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null

    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $logFile = Join-Path $logDir ("update-{0}.log" -f $stamp)

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("LFAA Source Update Log")
    $lines.Add("Time: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
    $lines.Add("Origin: " + $OriginUrl)
    $lines.Add("Branch: " + $Branch)
    $lines.Add("Before: " + $OldCommit)
    $lines.Add("After: " + $NewCommit)
    $lines.Add("Result: " + $Result)
    $lines.Add("")
    $lines.Add("Remote Changes:")

    foreach ($line in $ChangedFiles) {
        $lines.Add($line)
    }

    [System.IO.File]::WriteAllLines(
        $logFile,
        $lines,
        (New-Object System.Text.UTF8Encoding($true))
    )

    return $logFile
}

function Show-RemoteChanges {
    param([string[]]$Lines)

    $add = 0
    $mod = 0
    $del = 0
    $ren = 0
    $other = 0

    foreach ($line in $Lines) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        $parts = $line -split "`t"
        $code = $parts[0]

        if ($code -match "^A") {
            $add++
        }
        elseif ($code -match "^M") {
            $mod++
        }
        elseif ($code -match "^D") {
            $del++
        }
        elseif ($code -match "^R") {
            $ren++
        }
        else {
            $other++
        }
    }

    Write-Host ""
    Write-Label "【远程变化】" "【汇总】" ("新增 {0} | 修改 {1} | 删除 {2} | 重命名 {3} | 其他 {4}" -f $add, $mod, $del, $ren, $other) Cyan
    Write-Host ""

    foreach ($line in $Lines) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        $parts = $line -split "`t"
        $code = $parts[0]

        if ($code -match "^A") {
            Write-Label "【新增】" "【文件】" $parts[1] Green
        }
        elseif ($code -match "^M") {
            Write-Label "【修改】" "【文件】" $parts[1] Yellow
        }
        elseif ($code -match "^D") {
            Write-Label "【删除】" "【文件】" $parts[1] Red
        }
        elseif ($code -match "^R") {
            $text = if ($parts.Count -ge 3) {
                $parts[1] + " -> " + $parts[2]
            }
            else {
                $line
            }

            Write-Label "【重命名】" "【文件】" $text Magenta
        }
        else {
            Write-Label "【变更】" "【文件】" $line Cyan
        }
    }
}


function Get-RemoteFileChanges {
    param(
        [Parameter(Mandatory = $true)][string]$FromRef,
        [Parameter(Mandatory = $true)][string]$ToRef
    )

    # 第一方案：直接比较两个明确的 tree-ish。
    # 不使用 HEAD..origin/main 这种 revision-range 字符串，降低不同 Git/PowerShell
    # 参数解析环境下出现歧义的可能。
    $primary = Invoke-GitRaw -GitArgs @(
        "-c", "core.quotepath=false",
        "diff", "--name-status", "-M",
        $FromRef, $ToRef
    )

    if ($primary.ExitCode -eq 0) {
        return @($primary.Output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    }

    # 第二方案：diff-tree fallback。
    $fallback = Invoke-GitRaw -GitArgs @(
        "-c", "core.quotepath=false",
        "diff-tree", "-r", "--no-commit-id", "--name-status", "-M",
        $FromRef, $ToRef
    )

    if ($fallback.ExitCode -eq 0) {
        Write-Label "【兼容】" "【备用比较】" "标准 diff 不可用，已自动使用备用文件差异比较。" DarkYellow
        return @($fallback.Output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    }

    $technical = @()
    $technical += "[git diff]"
    $technical += $primary.Output
    $technical += ""
    $technical += "[git diff-tree]"
    $technical += $fallback.Output

    Stop-Lfaa -Message "读取远程文件变化失败。" -TechnicalOutput $technical
}


function Get-GitRootFromPath {
    param([string]$StartPath)

    if ([string]::IsNullOrWhiteSpace($StartPath)) {
        return $null
    }

    if (-not (Test-Path -LiteralPath $StartPath)) {
        return $null
    }

    $item = Get-Item -LiteralPath $StartPath

    $probePath = if ($item.PSIsContainer) {
        $item.FullName
    }
    else {
        $item.DirectoryName
    }

    $result = Invoke-GitRaw -GitArgs @("-C", $probePath, "rev-parse", "--show-toplevel")

    if ($result.ExitCode -ne 0 -or $result.Output.Count -eq 0) {
        return $null
    }

    $root = ($result.Output -join "").Trim()

    if ([string]::IsNullOrWhiteSpace($root)) {
        return $null
    }

    if (-not (Test-Path -LiteralPath (Join-Path $root ".git"))) {
        return $null
    }

    return (Resolve-Path -LiteralPath $root).Path
}

function Get-NearbyGitRoots {
    param([string]$BasePath)

    $found = New-Object System.Collections.Generic.List[string]

    if ([string]::IsNullOrWhiteSpace($BasePath) -or -not (Test-Path -LiteralPath $BasePath)) {
        return @()
    }

    $baseItem = Get-Item -LiteralPath $BasePath
    $baseDir = if ($baseItem.PSIsContainer) {
        $baseItem.FullName
    }
    else {
        $baseItem.DirectoryName
    }

    $parent = Split-Path -Parent $baseDir

    $candidates = New-Object System.Collections.Generic.List[string]
    $candidates.Add($baseDir)

    if (-not [string]::IsNullOrWhiteSpace($parent) -and (Test-Path -LiteralPath $parent)) {
        Get-ChildItem -LiteralPath $parent -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
            $candidates.Add($_.FullName)
        }
    }

    foreach ($candidate in $candidates) {
        $root = Get-GitRootFromPath $candidate
        if (-not [string]::IsNullOrWhiteSpace($root) -and -not $found.Contains($root)) {
            $found.Add($root)
        }
    }

    return @($found)
}

function Select-WorkspaceRoot {
    # 1. 优先：脚本所在项目本身就是 Git 仓库。
    $root = Get-GitRootFromPath $PackageRoot
    if (-not [string]::IsNullOrWhiteSpace($root)) {
        Write-Label "【定位】" "【自动】" ("已根据脚本所在项目识别 Git 根目录：" + $root) Green
        return $root
    }

    # 2. 其次：从用户启动脚本时的当前目录识别。
    $root = Get-GitRootFromPath $LaunchDirectory
    if (-not [string]::IsNullOrWhiteSpace($root)) {
        Write-Label "【定位】" "【自动】" ("已根据当前目录识别 Git 根目录：" + $root) Green
        return $root
    }

    # 3. 扫描脚本附近目录，不依赖盘符或固定目录名。
    $nearby = @(Get-NearbyGitRoots $PackageRoot)

    if ($nearby.Count -eq 1) {
        Write-Label "【定位】" "【自动】" ("检测到附近唯一 Git 工作区：" + $nearby[0]) Green
        return $nearby[0]
    }

    if ($nearby.Count -gt 1) {
        Write-Host ""
        Write-Label "【定位】" "【多个项目】" "检测到多个 Git 工作区，请选择：" Yellow

        for ($i = 0; $i -lt $nearby.Count; $i++) {
            Write-Host ("  [{0}] {1}" -f ($i + 1), $nearby[$i]) -ForegroundColor Cyan
        }

        Write-Host "  [0] 手工输入其他路径" -ForegroundColor DarkGray

        while ($true) {
            $choice = Read-Host "【请选择】【项目编号】"
            $number = 0

            if ([int]::TryParse($choice, [ref]$number)) {
                if ($number -ge 1 -and $number -le $nearby.Count) {
                    return $nearby[$number - 1]
                }

                if ($number -eq 0) {
                    break
                }
            }

            Write-Label "【提示】" "【无效选项】" "请输入列表中的有效编号。" Yellow
        }
    }

    # 4. 最后：用户手工输入项目路径。
    while ($true) {
        Write-Host ""
        Write-Label "【定位】" "【需要路径】" "未自动找到 Git 工作区，请输入你实际项目所在目录。" Magenta
        Write-Label "【说明】" "【不限制盘符】" "例如 C:\\Code\\LFAA、D:\\AI\\Project、U 盘目录都可以。" DarkCyan

        $inputPath = Read-Host "【输入】【项目路径】"

        if ([string]::IsNullOrWhiteSpace($inputPath)) {
            Write-Label "【提示】" "【不能为空】" "请输入有效项目路径。" Yellow
            continue
        }

        $expanded = [Environment]::ExpandEnvironmentVariables($inputPath.Trim().Trim('"'))

        if (-not (Test-Path -LiteralPath $expanded)) {
            Write-Label "【提示】" "【路径不存在】" $expanded Yellow
            continue
        }

        $manualRoot = Get-GitRootFromPath $expanded

        if ([string]::IsNullOrWhiteSpace($manualRoot)) {
            Write-Label "【提示】" "【不是 Git 仓库】" "该路径及其父级未识别到有效 .git，请重新输入。" Yellow
            continue
        }

        Write-Label "【定位】" "【确认】" $manualRoot Green
        return $manualRoot
    }
}

# --------------------------------------------------------------
# 菜单
# --------------------------------------------------------------
function Show-UpdateMenu {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host " LFAA 源码更新菜单" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Label "【1】" "【安全拉取】" "推荐。保护本地修改，只允许 fast-forward 更新。" Green
    Write-Label "【2】" "【强制拉取】" "先自动备份，再强制让当前分支与远程一致。" Red
    Write-Label "【3】" "【检查更新】" "只 fetch 和比较，不修改本地源码。" Cyan
    Write-Label "【0】" "【退出】" "不执行任何更新操作。" DarkGray
    Write-Host ""
}

$UpdateMode = ""
while ([string]::IsNullOrWhiteSpace($UpdateMode)) {
    Show-UpdateMenu
    $choice = Read-Host "【请选择】【0-3】"

    switch ($choice.Trim()) {
        "1" { $UpdateMode = "safe" }
        "2" { $UpdateMode = "force" }
        "3" { $UpdateMode = "check" }
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

# --------------------------------------------------------------
# 定位真正的 Git 工作区
# 不依赖 H: / C: / 固定目录名。
# --------------------------------------------------------------
$WorkspaceRoot = Select-WorkspaceRoot

if ([string]::IsNullOrWhiteSpace($WorkspaceRoot)) {
    Stop-Lfaa "无法确定需要更新的 Git 工作区。"
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkCyan
if ($UpdateMode -eq "safe") {
    Write-Host " LFAA 安全拉取" -ForegroundColor Green
}
elseif ($UpdateMode -eq "force") {
    Write-Host " LFAA 强制拉取" -ForegroundColor Red
}
else {
    Write-Host " LFAA 检查远程更新" -ForegroundColor Cyan
}
Write-Host "============================================================" -ForegroundColor DarkCyan

Write-Label "【工作区】" "【路径】" $WorkspaceRoot Cyan

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Stop-Lfaa "未检测到 Git，请先安装 Git for Windows 并加入系统 PATH。"
}

Set-Location $WorkspaceRoot

[void](Invoke-GitChecked -GitArgs @("config", "core.quotepath", "false") -ActionName "设置 Git 中文路径显示")

$version = Get-ReleaseVersion $WorkspaceRoot
Write-Label "【版本】" "【本地】" $version Magenta

# --------------------------------------------------------------
# origin / branch
# --------------------------------------------------------------
$remoteList = Invoke-GitChecked -GitArgs @("remote") -ActionName "读取远程仓库"
$remotes = @($remoteList.Output | ForEach-Object { $_.Trim() } | Where-Object { $_ })

if ($remotes -notcontains "origin") {
    Stop-Lfaa "当前 Git 工作区没有 origin。请先运行 LFAA-GitHub.bat 配置远程仓库地址。"
}

$originResult = Invoke-GitChecked -GitArgs @("remote", "get-url", "origin") -ActionName "读取 origin 地址"
$origin = ($originResult.Output -join "").Trim()
Write-Label "【远程】" "【origin】" $origin Green

$branchResult = Invoke-GitChecked -GitArgs @("branch", "--show-current") -ActionName "读取当前分支"
$branch = ($branchResult.Output -join "").Trim()

if ([string]::IsNullOrWhiteSpace($branch)) {
    Stop-Lfaa "当前仓库处于 detached HEAD 状态，为避免误更新，脚本已停止。"
}

Write-Label "【分支】" "【当前】" $branch Cyan

# --------------------------------------------------------------
# 本地未提交修改
# --------------------------------------------------------------
$statusResult = Invoke-GitChecked -GitArgs @(
    "-c", "core.quotepath=false",
    "status", "--porcelain=v1", "--untracked-files=all"
) -ActionName "读取本地文件状态"

$localChanges = @($statusResult.Output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

if ($localChanges.Count -gt 0) {
    Write-Host ""
    Write-Label "【本地】" "【存在修改】" ("检测到 " + $localChanges.Count + " 条未提交变化。") Yellow

    foreach ($line in $localChanges) {
        if ($line.Length -lt 3) { continue }

        $code = $line.Substring(0, 2)
        $path = $line.Substring(3).Trim()

        if ($code -match "A|\?") {
            Write-Label "【新增】" "【本地】" $path Green
        }
        elseif ($code -match "D") {
            Write-Label "【删除】" "【本地】" $path Red
        }
        elseif ($code -match "M") {
            Write-Label "【修改】" "【本地】" $path Yellow
        }
        else {
            Write-Label "【变更】" "【本地】" $path Cyan
        }
    }

    if ($UpdateMode -eq "safe") {
        Write-Host ""
        Write-Label "【保护】" "【停止】" "安全拉取不会覆盖未提交修改。" Yellow
        Write-Label "【处理】" "【建议】" "请先 Commit，或手工 stash，然后重新选择安全拉取。" DarkYellow
        Wait-LfaaClose -Success $false
        exit 2
    }

    if ($UpdateMode -eq "force") {
        Write-Label "【强制模式】" "【备份】" "继续后会先自动 stash（包含未跟踪文件），再对齐远程。" Red
    }

    if ($UpdateMode -eq "check") {
        Write-Label "【检查模式】" "【说明】" "仅检查远程，不会修改这些本地文件。" Cyan
    }
}
else {
    Write-Label "【本地】" "【干净】" "未检测到未提交修改。" Green
}

# --------------------------------------------------------------
# Fetch
# --------------------------------------------------------------
Write-Host ""
Write-Label "【远程】" "【获取】" "正在获取远程最新状态，请稍候..." Cyan

$fetchResult = Invoke-GitRaw -GitArgs @("fetch", "--prune", "origin")
if ($fetchResult.ExitCode -ne 0) {
    Stop-Lfaa -Message "获取远程更新失败，请检查网络、origin 地址或 Git 登录状态。" -TechnicalOutput $fetchResult.Output
}
Write-Label "【远程】" "【完成】" "远程状态获取完成。" Green

$remoteRef = "origin/" + $branch
$remoteRefCheck = Invoke-GitRaw -GitArgs @("rev-parse", "--verify", $remoteRef)
if ($remoteRefCheck.ExitCode -ne 0) {
    Stop-Lfaa -Message ("远程不存在分支：" + $remoteRef + "。") -TechnicalOutput $remoteRefCheck.Output
}

# --------------------------------------------------------------
# ahead / behind
# --------------------------------------------------------------
$countResult = Invoke-GitChecked -GitArgs @(
    "rev-list", "--left-right", "--count", "HEAD..." + $remoteRef
) -ActionName "比较本地与远程版本"

$countText = ($countResult.Output -join " ").Trim()
$countParts = $countText -split "\s+"

if ($countParts.Count -lt 2) {
    Stop-Lfaa "无法解析本地与远程版本差异。"
}

$ahead = [int]$countParts[0]
$behind = [int]$countParts[1]

Write-Host ""
Write-Label "【版本差异】" "【本地领先】" ($ahead.ToString() + " 个提交") Magenta
Write-Label "【版本差异】" "【本地落后】" ($behind.ToString() + " 个提交") Cyan

$oldHeadResult = Invoke-GitChecked -GitArgs @("rev-parse", "HEAD") -ActionName "读取当前 Commit"
$oldHead = ($oldHeadResult.Output -join "").Trim()

# --------------------------------------------------------------
# 先处理无需读取文件差异的状态。
# 0/0 已经证明本地 HEAD 与 origin/<branch> 完全一致，
# 此时禁止再执行多余的 git diff。
# --------------------------------------------------------------
if ($ahead -eq 0 -and $behind -eq 0) {
    Write-Host ""
    Write-Label "【远程变化】" "【无】" "本地与远程指向同一版本，没有文件差异。" Green

    if ($UpdateMode -eq "check") {
        Write-Label "【检查】" "【已是最新】" "本地与远程完全一致。" Green
    }
    elseif ($UpdateMode -eq "safe") {
        Write-Label "【更新】" "【已是最新】" "当前源码已经是远程最新版本，无需拉取。" Green
    }
    else {
        Write-Label "【强制拉取】" "【无需执行】" "本地已经与远程完全一致，不需要强制覆盖。" Green
    }

    Wait-LfaaClose -Success $true
    exit 0
}

# 本地纯领先时，远程没有“需要拉取”的新提交。
if ($ahead -gt 0 -and $behind -eq 0 -and $UpdateMode -ne "force") {
    Write-Host ""
    Write-Label "【远程变化】" "【无新提交】" "远程没有比本地更新的 Commit。" Green

    if ($UpdateMode -eq "check") {
        Write-Label "【检查】" "【本地领先】" ("本地有 " + $ahead + " 个尚未推送的 Commit。") Yellow
    }
    else {
        Write-Label "【保护】" "【本地领先】" "本地存在尚未出现在远程的 Commit，不需要拉取。" Yellow
        Write-Label "【处理】" "【建议】" "如需上传，请使用 LFAA-GitHub.bat。" DarkYellow
    }

    Wait-LfaaClose -Success $true
    exit 0
}

# 安全拉取遇到分叉时，在读取文件 diff 之前直接停止。
if ($UpdateMode -eq "safe" -and $ahead -gt 0 -and $behind -gt 0) {
    Write-Host ""
    Write-Label "【保护】" "【分支已分叉】" "安全拉取不会自动 merge / rebase。" Red
    Write-Label "【处理】" "【建议】" "请人工处理，或明确选择强制拉取并使用自动备份。" DarkYellow
    Wait-LfaaClose -Success $false
    exit 2
}

# --------------------------------------------------------------
# 只有确实需要查看远程变化时，才读取文件差异。
# 使用两个明确 ref 直接比较，并提供 diff-tree fallback。
# --------------------------------------------------------------
$remoteChanges = @(Get-RemoteFileChanges -FromRef $oldHead -ToRef $remoteRef)

if ($remoteChanges.Count -gt 0) {
    Show-RemoteChanges -Lines $remoteChanges
}
else {
    Write-Host ""
    Write-Label "【远程变化】" "【无文件差异】" "Commit 状态存在差异，但最终文件树没有变化。" Green
}

# --------------------------------------------------------------
# 仅检查
# --------------------------------------------------------------
if ($UpdateMode -eq "check") {
    Write-Host ""

    if ($ahead -eq 0 -and $behind -gt 0) {
        Write-Label "【检查】" "【可更新】" ("远程有 " + $behind + " 个新 Commit，可选择安全拉取。") Cyan
    }
    elseif ($ahead -gt 0 -and $behind -gt 0) {
        Write-Label "【检查】" "【已分叉】" "本地和远程都有各自的新 Commit。" Red
    }
    else {
        Write-Label "【检查】" "【状态】" "已完成本地与远程状态检查。" Cyan
    }

    Wait-LfaaClose -Success $true
    exit 0
}

# --------------------------------------------------------------
# 安全拉取
# --------------------------------------------------------------
if ($UpdateMode -eq "safe") {
    Write-Host ""
    Write-Label "【更新】" "【提交数量】" ("将拉取 " + $behind + " 个远程 Commit。") Cyan
    Write-Label "【更新】" "【方式】" "fast-forward only，不执行自动 merge/rebase。" Green

    $confirm = Read-Host "【确认】【安全拉取】输入 Y 确认，其他键取消"
    if ($confirm -notmatch "^(?i:y|yes)$") {
        Write-Label "【取消】" "【更新】" "已取消，本地源码未发生改变。" Yellow
        Wait-LfaaClose -Success $true
        exit 0
    }

    Write-Host ""
    Write-Label "【更新】" "【进行中】" "正在安全拉取远程最新源码..." Cyan

    $pullResult = Invoke-GitRaw -GitArgs @("pull", "--ff-only", "origin", $branch)
    if ($pullResult.ExitCode -ne 0) {
        Stop-Lfaa -Message "安全拉取失败；脚本没有执行强制覆盖。" -TechnicalOutput $pullResult.Output
    }

    $newHeadResult = Invoke-GitChecked -GitArgs @("rev-parse", "HEAD") -ActionName "读取更新后 Commit"
    $newHead = ($newHeadResult.Output -join "").Trim()

    $verifyResult = Invoke-GitChecked -GitArgs @(
        "rev-list", "--left-right", "--count", "HEAD..." + $remoteRef
    ) -ActionName "校验更新结果"

    $verifyText = ($verifyResult.Output -join " ").Trim()
    $verifyParts = $verifyText -split "\s+"

    if ($verifyParts.Count -lt 2 -or [int]$verifyParts[0] -ne 0 -or [int]$verifyParts[1] -ne 0) {
        Stop-Lfaa "安全拉取完成后，本地与远程仍不一致。"
    }

    $newVersion = Get-ReleaseVersion $WorkspaceRoot
    $logFile = Save-UpdateLog `
        -Root $WorkspaceRoot `
        -OriginUrl $origin `
        -Branch $branch `
        -OldCommit $oldHead `
        -NewCommit $newHead `
        -ChangedFiles $remoteChanges `
        -Result "SAFE_SUCCESS"

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkGreen
    Write-Label "【完成】" "【安全拉取成功】" "本地源码已更新到远程最新版本。" Green
    Write-Label "【版本】" "【更新前】" $version Magenta
    Write-Label "【版本】" "【更新后】" $newVersion Green
    Write-Label "【日志】" "【路径】" $logFile DarkCyan
    Write-Host "============================================================" -ForegroundColor DarkGreen

    Wait-LfaaClose -Success $true
    exit 0
}

# --------------------------------------------------------------
# 强制拉取：自动恢复点 -> reset --hard remote -> clean -fd
# --------------------------------------------------------------
if ($UpdateMode -eq "force") {
    Write-Host ""
    Write-Label "【警告】" "【强制拉取】" "该模式会让当前分支最终与远程分支保持一致。" Red
    Write-Label "【保护】" "【自动备份】" "执行前会创建本地备份分支；未提交修改会自动保存到 stash。" Yellow
    Write-Label "【保护】" "【忽略文件】" "Git 忽略的本地文件（例如 .env、缓存）不会被 git clean -fd 删除。" DarkYellow

    $confirmForce = Read-Host "【确认】【强制拉取】输入 Y 继续，其他键取消"
    if ($confirmForce -notmatch "^(?i:y|yes)$") {
        Write-Label "【取消】" "【强制拉取】" "已取消，本地源码未发生改变。" Yellow
        Wait-LfaaClose -Success $true
        exit 0
    }

    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupBranch = "lfaa-backup/" + $branch + "-" + $stamp

    [void](Invoke-GitChecked -GitArgs @("branch", $backupBranch, "HEAD") -ActionName "创建强制拉取备份分支")
    Write-Label "【备份】" "【分支】" $backupBranch Green

    $stashRef = ""
    if ($localChanges.Count -gt 0) {
        $stashResult = Invoke-GitRaw -GitArgs @(
            "stash", "push", "-u", "-m", ("LFAA force update backup " + $stamp)
        )

        if ($stashResult.ExitCode -ne 0) {
            Stop-Lfaa -Message "自动保存未提交修改失败；尚未执行强制覆盖。" -TechnicalOutput $stashResult.Output
        }

        $stashRefResult = Invoke-GitRaw -GitArgs @("stash", "list", "-1", "--format=%gd")
        if ($stashRefResult.ExitCode -eq 0 -and $stashRefResult.Output.Count -gt 0) {
            $stashRef = ($stashRefResult.Output -join "").Trim()
        }

        if (-not [string]::IsNullOrWhiteSpace($stashRef)) {
            Write-Label "【备份】" "【stash】" $stashRef Green
        }
    }

    Write-Host ""
    Write-Label "【强制拉取】" "【进行中】" ("正在对齐 " + $remoteRef + "...") Red

    $resetResult = Invoke-GitRaw -GitArgs @("reset", "--hard", $remoteRef)
    if ($resetResult.ExitCode -ne 0) {
        Stop-Lfaa -Message "强制对齐远程失败；备份分支已经保留。" -TechnicalOutput $resetResult.Output
    }

    $cleanResult = Invoke-GitRaw -GitArgs @("clean", "-fd")
    if ($cleanResult.ExitCode -ne 0) {
        Stop-Lfaa -Message "清理未跟踪文件失败；当前 HEAD 已对齐远程，备份仍然保留。" -TechnicalOutput $cleanResult.Output
    }

    $verifyResult = Invoke-GitChecked -GitArgs @(
        "rev-list", "--left-right", "--count", "HEAD..." + $remoteRef
    ) -ActionName "校验强制拉取结果"

    $verifyText = ($verifyResult.Output -join " ").Trim()
    $verifyParts = $verifyText -split "\s+"

    if ($verifyParts.Count -lt 2 -or [int]$verifyParts[0] -ne 0 -or [int]$verifyParts[1] -ne 0) {
        Stop-Lfaa "强制拉取完成后，本地与远程仍不一致；请使用备份分支检查。"
    }

    $newHeadResult = Invoke-GitChecked -GitArgs @("rev-parse", "HEAD") -ActionName "读取强制拉取后 Commit"
    $newHead = ($newHeadResult.Output -join "").Trim()
    $newVersion = Get-ReleaseVersion $WorkspaceRoot

    $logFile = Save-UpdateLog `
        -Root $WorkspaceRoot `
        -OriginUrl $origin `
        -Branch $branch `
        -OldCommit $oldHead `
        -NewCommit $newHead `
        -ChangedFiles $remoteChanges `
        -Result "FORCE_SUCCESS"

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkGreen
    Write-Label "【完成】" "【强制拉取成功】" "当前分支已与远程分支完全对齐。" Green
    Write-Label "【备份】" "【分支】" $backupBranch Yellow

    if (-not [string]::IsNullOrWhiteSpace($stashRef)) {
        Write-Label "【备份】" "【stash】" $stashRef Yellow
        Write-Label "【恢复】" "【提示】" ("如需恢复未提交文件，可手工执行：git stash apply " + $stashRef) DarkYellow
    }

    Write-Label "【版本】" "【更新前】" $version Magenta
    Write-Label "【版本】" "【更新后】" $newVersion Green
    Write-Label "【日志】" "【路径】" $logFile DarkCyan
    Write-Host "============================================================" -ForegroundColor DarkGreen

    Wait-LfaaClose -Success $true
    exit 0
}

Stop-Lfaa "未知更新模式。"

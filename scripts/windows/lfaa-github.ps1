$ErrorActionPreference = "Stop"

# Windows PowerShell 5.1 中文输出处理。
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
try { & chcp.com 65001 | Out-Null } catch {}

$Branch = "main"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PackageRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$ParentRoot = Split-Path -Parent $PackageRoot
$StableWorkspace = Join-Path $ParentRoot "lfaa"

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
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [string[]]$TechnicalOutput = @()
    )

    Write-Host ""
    Write-Label "【错误】" "【失败】" $Message Red

    if ($TechnicalOutput.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($WorkspaceRoot)) {
        try {
            $errorDir = Join-Path $WorkspaceRoot "docs\logs\github-push"
            New-Item -ItemType Directory -Force -Path $errorDir | Out-Null
            $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
            $errorFile = Join-Path $errorDir ("push-error-{0}.log" -f $stamp)

            $lines = New-Object System.Collections.Generic.List[string]
            $lines.Add("LFAA GitHub Push Error Log")
            $lines.Add("Time: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
            $lines.Add("Message: " + $Message)
            $lines.Add("")
            $lines.Add("Raw Git Output:")

            foreach ($line in $TechnicalOutput) {
                $lines.Add([string]$line)
            }

            [System.IO.File]::WriteAllLines(
                $errorFile,
                $lines,
                (New-Object System.Text.UTF8Encoding($true))
            )

            Write-Label "【日志】" "【技术详情】" $errorFile DarkYellow
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
        return "unknown"
    }

    return "unknown"
}

function Test-RemoteUrlFormat {
    param([string]$Url)

    if ([string]::IsNullOrWhiteSpace($Url)) {
        return $false
    }

    $value = $Url.Trim()

    if ($value -match "^https?://") {
        return $true
    }

    if ($value -match "^ssh://") {
        return $true
    }

    if ($value -match "^[^@\s]+@[^:\s]+:.+$") {
        return $true
    }

    if ($value -match "^file://") {
        return $true
    }

    return $false
}

function Configure-Origin {
    Write-Host ""
    Write-Label "【配置】" "【远程仓库】" "首次使用需要配置 Git origin。" Magenta
    Write-Label "【说明】" "【地址示例】" "https://github.com/你的用户名/你的仓库.git" DarkCyan
    Write-Label "【说明】" "【保存位置】" ".git/config；配置一次后下次无需再次输入。" DarkGray

    do {
        $inputUrl = Read-Host "【输入】【origin 地址】"

        if (-not (Test-RemoteUrlFormat $inputUrl)) {
            Write-Label "【提示】" "【格式】" "地址格式无法识别，请重新输入 HTTPS / SSH Git 仓库地址。" Yellow
            $inputUrl = ""
        }
    }
    while ([string]::IsNullOrWhiteSpace($inputUrl))

    $inputUrl = $inputUrl.Trim()

    Write-Host ""
    Write-Label "【确认】" "【origin】" $inputUrl Cyan
    $confirm = Read-Host "【确认】【保存 origin】输入 Y 确认，其他键重新输入"

    if ($confirm -notmatch "^(?i:y|yes)$") {
        return Configure-Origin
    }

    [void](Invoke-GitChecked -GitArgs @("remote", "add", "origin", $inputUrl) -ActionName "保存 Git origin")

    Write-Label "【远程】" "【已保存】" "origin 已保存到 .git/config，下次将自动使用。" Green

    return $inputUrl
}

function Get-ChangeInfo {
    param([string]$StatusLine)

    if ([string]::IsNullOrWhiteSpace($StatusLine) -or $StatusLine.Length -lt 3) {
        return $null
    }

    $code = $StatusLine.Substring(0, 2)
    $path = $StatusLine.Substring(3).Trim()

    $label = "【变更】"
    $tag = "【其他】"
    $color = [ConsoleColor]::Cyan
    $kind = "CHANGE"

    if ($code -match "A|\?") {
        $label = "【新增】"
        $tag = "【文件】"
        $color = [ConsoleColor]::Green
        $kind = "ADD"
    }
    elseif ($code -match "D") {
        $label = "【删除】"
        $tag = "【文件】"
        $color = [ConsoleColor]::Red
        $kind = "DEL"
    }
    elseif ($code -match "R") {
        $label = "【重命名】"
        $tag = "【文件】"
        $color = [ConsoleColor]::Magenta
        $kind = "REN"
    }
    elseif ($code -match "M") {
        $label = "【修改】"
        $tag = "【文件】"
        $color = [ConsoleColor]::Yellow
        $kind = "MOD"
    }

    return [PSCustomObject]@{
        Code = $code
        Path = $path
        Label = $label
        Tag = $tag
        Color = $color
        Kind = $kind
    }
}

function Show-ChangeSummary {
    param([string[]]$StatusLines)

    $items = New-Object System.Collections.Generic.List[object]

    foreach ($line in $StatusLines) {
        $item = Get-ChangeInfo $line
        if ($null -ne $item) {
            $items.Add($item)
        }
    }

    $add = @($items | Where-Object { $_.Kind -eq "ADD" }).Count
    $mod = @($items | Where-Object { $_.Kind -eq "MOD" }).Count
    $del = @($items | Where-Object { $_.Kind -eq "DEL" }).Count
    $ren = @($items | Where-Object { $_.Kind -eq "REN" }).Count
    $other = @($items | Where-Object { $_.Kind -eq "CHANGE" }).Count

    Write-Host ""
    Write-Label "【对比】" "【汇总】" ("新增 {0} | 修改 {1} | 删除 {2} | 重命名 {3} | 其他 {4}" -f $add, $mod, $del, $ren, $other) Cyan
    Write-Host ""

    foreach ($item in $items) {
        Write-Label $item.Label $item.Tag $item.Path $item.Color
    }

    return $items
}

function Save-PushLog {
    param(
        [string]$Root,
        [string]$Version,
        [string]$OriginUrl,
        [string]$CommitMessage,
        [string[]]$StatusLines,
        [string]$Result
    )

    $logDir = Join-Path $Root "docs\logs\github-push"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null

    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $safeVersion = $Version -replace "[^0-9A-Za-z._-]", "_"
    $logFile = Join-Path $logDir ("push-{0}-v{1}.log" -f $stamp, $safeVersion)

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("LFAA GitHub Push Log")
    $lines.Add("Time: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
    $lines.Add("Version: " + $Version)
    $lines.Add("Origin: " + $OriginUrl)
    $lines.Add("Branch: " + $Branch)
    $lines.Add("Result: " + $Result)
    $lines.Add("Commit: " + $CommitMessage)
    $lines.Add("")

    foreach ($line in $StatusLines) {
        $lines.Add($line)
    }

    [System.IO.File]::WriteAllLines(
        $logFile,
        $lines,
        (New-Object System.Text.UTF8Encoding($true))
    )

    return $logFile
}

# --------------------------------------------------------------
# 定位稳定工作区
# --------------------------------------------------------------
if ((Split-Path -Leaf $PackageRoot) -ieq "lfaa") {
    $WorkspaceRoot = $PackageRoot
}
elseif (Test-Path -LiteralPath $StableWorkspace) {
    $WorkspaceRoot = (Resolve-Path $StableWorkspace).Path
}
else {
    $WorkspaceRoot = $StableWorkspace
    Stop-Lfaa ("未找到稳定工作区：" + $StableWorkspace + "。请先运行 LFAA-Sync.bat。")
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host " LFAA GitHub 一键推送" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor DarkCyan

Write-Label "【工作区】" "【路径】" $WorkspaceRoot Cyan

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Stop-Lfaa "未检测到 Git，请先安装 Git for Windows 并加入系统 PATH。"
}

$version = Get-ReleaseVersion $WorkspaceRoot
Write-Label "【版本】" "【当前】" $version Magenta

# --------------------------------------------------------------
# 治理检查
# --------------------------------------------------------------
$governance = Join-Path $WorkspaceRoot "scripts\governance-check.mjs"

if ((Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath $governance)) {
    Write-Host ""
    Write-Label "【检查】" "【治理】" "推送前运行项目治理检查..." Cyan

    Push-Location $WorkspaceRoot
    try {
        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $governanceOutput = @(
            & node "scripts\governance-check.mjs" 2>&1 | ForEach-Object { [string]$_ }
        )
        $governanceCode = $LASTEXITCODE
        $ErrorActionPreference = $oldPreference

        if ($governanceCode -ne 0) {
            Stop-Lfaa -Message "项目治理检查未通过，已阻止 GitHub 推送。" -TechnicalOutput $governanceOutput
        }
    }
    finally {
        Pop-Location
    }

    Write-Label "【检查】" "【通过】" "项目治理检查通过。" Green
}
else {
    Write-Label "【检查】" "【跳过】" "未检测到 Node 或治理脚本，跳过自动治理检查。" DarkYellow
}

Set-Location $WorkspaceRoot

# --------------------------------------------------------------
# Git 初始化
# --------------------------------------------------------------
$gitDir = Join-Path $WorkspaceRoot ".git"

if (-not (Test-Path -LiteralPath $gitDir)) {
    Write-Host ""
    Write-Label "【Git】" "【初始化】" "首次使用，正在创建 .git..." Cyan

    [void](Invoke-GitChecked -GitArgs @("init") -ActionName "初始化 Git 仓库")
    [void](Invoke-GitChecked -GitArgs @("branch", "-M", $Branch) -ActionName "设置 main 分支")

    Write-Label "【Git】" "【完成】" ".git 初始化完成。" Green
}
else {
    Write-Label "【Git】" "【已存在】" ".git 已存在，将继续复用当前 Git 历史。" Green
}

[void](Invoke-GitChecked -GitArgs @("config", "core.quotepath", "false") -ActionName "设置 Git 中文路径显示")

# --------------------------------------------------------------
# 用户信息
# --------------------------------------------------------------
$nameResult = Invoke-GitRaw -GitArgs @("config", "user.name")
$emailResult = Invoke-GitRaw -GitArgs @("config", "user.email")

$userName = if ($nameResult.ExitCode -eq 0 -and $nameResult.Output.Count -gt 0) {
    ($nameResult.Output -join "").Trim()
}
else {
    ""
}

$userEmail = if ($emailResult.ExitCode -eq 0 -and $emailResult.Output.Count -gt 0) {
    ($emailResult.Output -join "").Trim()
}
else {
    ""
}

if ([string]::IsNullOrWhiteSpace($userName)) {
    $userName = Read-Host "【Git】【姓名】请输入 Git 提交显示名称"

    if ([string]::IsNullOrWhiteSpace($userName)) {
        Stop-Lfaa "Git 提交显示名称不能为空。"
    }

    [void](Invoke-GitChecked -GitArgs @("config", "user.name", $userName) -ActionName "保存 Git 提交显示名称")
}

if ([string]::IsNullOrWhiteSpace($userEmail)) {
    $userEmail = Read-Host "【Git】【邮箱】请输入 Git 提交邮箱"

    if ([string]::IsNullOrWhiteSpace($userEmail)) {
        Stop-Lfaa "Git 提交邮箱不能为空。"
    }

    [void](Invoke-GitChecked -GitArgs @("config", "user.email", $userEmail) -ActionName "保存 Git 提交邮箱")
}

Write-Label "【Git】" "【身份】" ("{0} <{1}>" -f $userName, $userEmail) DarkCyan

# --------------------------------------------------------------
# origin 首次由用户配置；以后读取 .git/config 自动复用。
# --------------------------------------------------------------
$remoteList = Invoke-GitChecked -GitArgs @("remote") -ActionName "读取 Git 远程仓库"
$remotes = @($remoteList.Output | ForEach-Object { $_.Trim() } | Where-Object { $_ })

if ($remotes -notcontains "origin") {
    $origin = Configure-Origin
}
else {
    $originResult = Invoke-GitChecked -GitArgs @("remote", "get-url", "origin") -ActionName "读取 origin 地址"
    $origin = ($originResult.Output -join "").Trim()

    Write-Label "【远程】" "【已配置】" $origin Green
    Write-Label "【远程】" "【说明】" "origin 已保存在 .git/config，本次无需重新输入。" DarkGray
}

if ([string]::IsNullOrWhiteSpace($origin)) {
    Stop-Lfaa "origin 地址为空，无法继续。"
}

[void](Invoke-GitChecked -GitArgs @("branch", "-M", $Branch) -ActionName "确认 main 分支")

# --------------------------------------------------------------
# 文件变化
# --------------------------------------------------------------
Write-Host ""
Write-Label "【检测】" "【文件变化】" "正在检查稳定工作区..." Cyan

$statusResult = Invoke-GitChecked -GitArgs @(
    "-c", "core.quotepath=false",
    "status", "--porcelain=v1", "--untracked-files=all"
) -ActionName "读取 Git 文件状态"

$workingStatus = @($statusResult.Output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

if ($workingStatus.Count -eq 0) {
    Write-Label "【状态】" "【无变化】" "当前没有需要提交的本地文件变化。" Green
}
else {
    [void](Show-ChangeSummary -StatusLines $workingStatus)
}

# --------------------------------------------------------------
# 暂存和提交
# --------------------------------------------------------------
if ($workingStatus.Count -gt 0) {
    Write-Host ""
    Write-Label "【暂存】" "【开始】" "正在执行 git add -A..." Cyan
    [void](Invoke-GitChecked -GitArgs @("add", "-A") -ActionName "暂存全部文件变化")
    Write-Label "【暂存】" "【完成】" "全部变化已进入暂存区。" Green

    $stagedResult = Invoke-GitChecked -GitArgs @(
        "-c", "core.quotepath=false",
        "diff", "--cached", "--name-status", "--find-renames"
    ) -ActionName "读取待提交文件"

    $stagedLines = @($stagedResult.Output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

    Write-Host ""
    Write-Label "【待提交】" "【文件列表】" "以下文件将进入本次提交：" Cyan

    foreach ($line in $stagedLines) {
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
            $renameText = if ($parts.Count -ge 3) {
                $parts[1] + " -> " + $parts[2]
            }
            else {
                $line
            }
            Write-Label "【重命名】" "【文件】" $renameText Magenta
        }
        else {
            Write-Label "【变更】" "【文件】" $line Cyan
        }
    }

    $headResult = Invoke-GitRaw -GitArgs @("rev-parse", "--verify", "HEAD")
    $isFirstCommit = ($headResult.ExitCode -ne 0)

    Write-Host ""
    if ($isFirstCommit) {
        Write-Label "【提交】" "【首次】" "这是仓库第一次提交，请输入本次提交名称。" Magenta
    }
    else {
        Write-Label "【提交】" "【名称】" "请输入本次提交名称。" Magenta
    }

    do {
        $commitMessage = Read-Host "【输入】【提交名称】"
    }
    while ([string]::IsNullOrWhiteSpace($commitMessage))

    Write-Label "【提交】" "【名称】" $commitMessage Green

    $confirmCommit = Read-Host "【确认】【创建提交】输入 Y 确认，其他键取消"
    if ($confirmCommit -notmatch "^(?i:y|yes)$") {
        Write-Label "【取消】" "【提交】" "已取消提交；文件仍在暂存区，尚未推送。" Yellow
        exit 2
    }

    [void](Invoke-GitChecked -GitArgs @("commit", "-m", $commitMessage) -ActionName "创建 Git 提交")
    Write-Label "【提交】" "【完成】" "本地提交创建成功。" Green
}
else {
    $commitMessage = "本次没有新提交"
}

# --------------------------------------------------------------
# 远程分支
# --------------------------------------------------------------
Write-Host ""
Write-Label "【远程】" "【检测】" "正在检测远程 main 分支..." Cyan

$lsRemote = Invoke-GitRaw -GitArgs @("ls-remote", "--heads", "origin", $Branch)

if ($lsRemote.ExitCode -ne 0) {
    Stop-Lfaa -Message "无法连接 origin，请检查仓库地址、网络或 Git 登录状态。" -TechnicalOutput $lsRemote.Output
}

$remoteHasMain = -not [string]::IsNullOrWhiteSpace(($lsRemote.Output -join "").Trim())

if ($remoteHasMain) {
    Write-Label "【远程】" "【已有 main】" "推送前先同步远程更新..." Cyan

    $pullResult = Invoke-GitRaw -GitArgs @("pull", "--rebase", "origin", $Branch)

    if ($pullResult.ExitCode -ne 0) {
        $logFile = Save-PushLog $WorkspaceRoot $version $origin $commitMessage $workingStatus "PULL_REBASE_FAILED"
        Write-Label "【日志】" "【路径】" $logFile DarkYellow
        Stop-Lfaa -Message "同步远程 main 失败。请先处理 Git 冲突，再重新运行脚本。" -TechnicalOutput $pullResult.Output
    }

    Write-Label "【远程】" "【同步完成】" "远程 main 已同步。" Green
}
else {
    Write-Label "【远程】" "【首次推送】" "远程 main 目前为空，将执行第一次推送。" DarkYellow
}

# --------------------------------------------------------------
# Push
# --------------------------------------------------------------
Write-Host ""
Write-Label "【推送】" "【origin】" $origin Cyan
Write-Label "【推送】" "【分支】" $Branch Cyan
Write-Label "【推送】" "【提交】" $commitMessage Cyan

$confirmPush = Read-Host "【确认】【推送远程仓库】输入 Y 确认，其他键取消"
if ($confirmPush -notmatch "^(?i:y|yes)$") {
    Write-Label "【取消】" "【推送】" "已取消远程推送；本地提交会继续保留。" Yellow
    exit 2
}

Write-Host ""
Write-Label "【推送】" "【进行中】" "正在推送，请稍候；如出现 Git 登录窗口，请完成授权。" Cyan

$pushResult = Invoke-GitRaw -GitArgs @("push", "-u", "origin", $Branch)

if ($pushResult.ExitCode -ne 0) {
    $logFile = Save-PushLog $WorkspaceRoot $version $origin $commitMessage $workingStatus "PUSH_FAILED"
    Write-Label "【日志】" "【路径】" $logFile DarkYellow
    Stop-Lfaa -Message "远程仓库推送失败，原始 Git 技术信息已写入日志。" -TechnicalOutput $pushResult.Output
}

$logFile = Save-PushLog $WorkspaceRoot $version $origin $commitMessage $workingStatus "SUCCESS"

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkGreen
Write-Label "【完成】" "【推送成功】" "代码已成功推送到远程 Git 仓库。" Green
Write-Label "【远程】" "【origin】" $origin Cyan
Write-Label "【分支】" "【名称】" $Branch Cyan
Write-Label "【版本】" "【当前】" $version Magenta
Write-Label "【日志】" "【路径】" $logFile DarkCyan
Write-Host "============================================================" -ForegroundColor DarkGreen

Wait-LfaaClose -Success $true
exit 0

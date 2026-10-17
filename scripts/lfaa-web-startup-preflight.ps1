$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path

function Get-ResolvedDataDirectory {
    # 与 CLI 共用同一数据目录解析器和 .env 优先级，定位写锁时不自行推导默认路径。
    $nodeCommand = Get-Command 'node' -ErrorAction Stop
    $resolverFile = Join-Path $projectRoot 'scripts\resolve-data-directory.mjs'
    $resolverOutput = @(& $nodeCommand.Source $resolverFile $projectRoot 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "无法解析当前 LFAA 数据目录：$($resolverOutput -join ' ')"
    }

    $dataDirectory = [string]($resolverOutput | Select-Object -Last 1)
    if ([string]::IsNullOrWhiteSpace($dataDirectory)) {
        throw '数据目录解析没有返回路径，已停止 Web 启动。'
    }
    return $dataDirectory.Trim()
}

function Read-ConfigurationLockRecord {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    try {
        $record = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw "LFAA 配置写锁格式无效，未尝试结束进程：$Path"
    }

    $processId = [long]0
    $identity = [guid]::Empty
    if (-not [long]::TryParse([string]$record.pid, [ref]$processId) -or $processId -lt 1 -or
        -not [guid]::TryParse([string]$record.identity, [ref]$identity)) {
        throw "LFAA 配置写锁缺少有效 PID 或身份标识，未尝试结束进程：$Path"
    }
    return [pscustomobject]@{ ProcessId = $processId; Identity = $identity.ToString() }
}

function Test-LfaaWebLockOwnerCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$CommandLine
    )

    if ($Name -notmatch '^node(?:\.exe)?$') { return $false }

    $normalizedCommandLine = $CommandLine.Replace('/', '\')
    $hasLfaaPackageLoader = $normalizedCommandLine -match '(?i)register-package-loader\.mjs'
    $isPackagedLfaaWeb = $normalizedCommandLine -match '(?i)(?:^|\s)"?[^\"]*apps\\cli\\bin\\lfaa\.mjs"?\s+web(?:\s|$)'
    $isSourceLfaaWeb = $hasLfaaPackageLoader -and
        $normalizedCommandLine -match '(?i)(?:^|\s)"?[^\"]*apps\\cli\\src\\bin\.ts"?\s+web(?:\s|$)'
    $isLegacySourceLfaaWeb = $hasLfaaPackageLoader -and
        $normalizedCommandLine -match '(?i)(?:^|\s)"?[^\"]*src\\index\.ts"?\s+--profile\s+web(?:\s|$)'

    return $isPackagedLfaaWeb -or $isSourceLfaaWeb -or $isLegacySourceLfaaWeb
}

function Stop-ExistingLfaaWebLockOwner {
    # 只协调可确认的 Web 写锁持有者；锁释放仍由存储 Owner 事务处理。
    $dataDirectory = Get-ResolvedDataDirectory
    $lockPath = Join-Path (Join-Path $dataDirectory 'storages') '.configuration.lock'
    $lockRecord = Read-ConfigurationLockRecord -Path $lockPath
    if ($null -eq $lockRecord) { return }

    $owner = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $($lockRecord.ProcessId)" -ErrorAction Stop
    if ($null -eq $owner) {
        Write-Host '配置写锁记录的 PID 已退出；由存储模块在启动事务中安全回收。' -ForegroundColor Yellow
        return
    }

    $ownerCommandLine = [string]$owner.CommandLine
    if (-not (Test-LfaaWebLockOwnerCommand -Name ([string]$owner.Name) -CommandLine $ownerCommandLine)) {
        throw "数据目录写锁 PID $($lockRecord.ProcessId) 仍存活，但无法确认为 LFAA Web CLI；为避免误杀，已停止启动。"
    }

    $currentLockRecord = Read-ConfigurationLockRecord -Path $lockPath
    if ($null -eq $currentLockRecord) { return }
    if ($currentLockRecord.ProcessId -ne $lockRecord.ProcessId -or $currentLockRecord.Identity -ne $lockRecord.Identity) {
        throw 'Web 启动期间配置写锁归属发生变化，已停止启动。'
    }

    $currentOwner = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $($lockRecord.ProcessId)" -ErrorAction Stop
    if ($null -eq $currentOwner) { return }
    if ($currentOwner.Name -ne $owner.Name -or
        [string]$currentOwner.CommandLine -ne $ownerCommandLine -or
        [string]$currentOwner.CreationDate -ne [string]$owner.CreationDate) {
        throw 'Web 启动期间锁持有进程身份发生变化，已停止启动。'
    }

    Write-Host "检测到当前数据目录由 LFAA Web PID $($lockRecord.ProcessId) 占用，正在结束该进程并重新启动 Web。" -ForegroundColor Yellow
    Stop-Process -Id $lockRecord.ProcessId -Force -ErrorAction Stop
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if (-not (Get-Process -Id $lockRecord.ProcessId -ErrorAction SilentlyContinue)) { return }
        Start-Sleep -Milliseconds 125
    }
    throw "未能确认 LFAA Web PID $($lockRecord.ProcessId) 已退出，已停止重启。"
}

Stop-ExistingLfaaWebLockOwner

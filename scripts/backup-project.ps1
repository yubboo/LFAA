<#
功能：创建 LFAA 项目的版本化 ZIP 源码备份。
作用：将源码备份写入根目录 dist\backups，排除依赖、构建产物、运行数据与敏感本地配置。
关联文件：根目录 lfaa.bat、项目根目录 dist\backups、package.json、pnpm-lock.yaml、pnpm-workspace.yaml。
#>

[CmdletBinding()]
param(
    [string]$BackupRoot
)

$ErrorActionPreference = 'Stop'

function ConvertTo-NormalizedFullPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $volumeRoot = [System.IO.Path]::GetPathRoot($fullPath)
    if ($fullPath.Length -gt $volumeRoot.Length) {
        $fullPath = $fullPath.TrimEnd([char[]]@('\', '/'))
    }
    return $fullPath
}

function Test-PathInsideDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$Candidate,
        [Parameter(Mandatory = $true)][string]$Directory
    )

    $candidatePath = ConvertTo-NormalizedFullPath $Candidate
    $directoryPath = ConvertTo-NormalizedFullPath $Directory
    if ($candidatePath.Equals($directoryPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }

    $directoryPrefix = $directoryPath.TrimEnd([char[]]@('\', '/')) + '\'
    return $candidatePath.StartsWith($directoryPrefix, [System.StringComparison]::OrdinalIgnoreCase)
}

$projectRoot = ConvertTo-NormalizedFullPath (Join-Path $PSScriptRoot '..')
$projectBackupRoot = ConvertTo-NormalizedFullPath (Join-Path $projectRoot 'dist\backups')
$temporaryRoot = ConvertTo-NormalizedFullPath (Join-Path $projectRoot 'dist\.tmp\backup-project')
$manifestPath = Join-Path $projectRoot 'package.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$projectName = ([string]$manifest.name).Split('/')[-1].ToUpperInvariant()
$updateLogPath = Join-Path $projectRoot 'docs\updata-log.md'
if (-not (Test-Path -LiteralPath $updateLogPath -PathType Leaf)) {
    throw '找不到 docs\updata-log.md，无法确定项目版本。'
}
$updateLog = Get-Content -LiteralPath $updateLogPath -Raw -Encoding UTF8
$versionPattern = '(?m)^\s*-\s*\*\*项目版本：\*\*\s*`' + [regex]::Escape($projectName) + '\s+(?<version>\d+\.\d+\.\d+)`'
$versionMatch = [regex]::Match($updateLog, $versionPattern)
if (-not $versionMatch.Success) {
    throw '无法从 docs\updata-log.md 的最新版本记录中读取项目版本。'
}
$projectVersion = $versionMatch.Groups['version'].Value
$archiveBaseName = "$projectName $projectVersion"
$requiredPaths = @(
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'frontend\src',
    'server\src',
    'daemon\src',
    'apps',
    'scripts',
    'docs',
    '开发规范.md',
    'AGENTS.md'
)

foreach ($relativePath in $requiredPaths) {
    $requiredPath = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "项目关键路径缺失，已停止备份：$relativePath"
    }
}

if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
    $BackupRoot = $projectBackupRoot
}

$BackupRoot = ConvertTo-NormalizedFullPath $BackupRoot
if (-not (Test-PathInsideDirectory -Candidate $BackupRoot -Directory $projectBackupRoot)) {
    throw '备份输出目录必须位于根目录 dist\backups。'
}

$excludedDirectoryNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$excludedDirectoryNameList = @(
    'node_modules',
    'dist',
    'build',
    'target',
    'coverage',
    '.turbo',
    '.next',
    '.vite',
    '.cache',
    '.pnpm-store',
    '.npm',
    '.gradle',
    '.venv',
    'venv',
    '__pycache__',
    '.pytest_cache'
)
foreach ($excludedDirectoryName in $excludedDirectoryNameList) {
    [void]$excludedDirectoryNames.Add($excludedDirectoryName)
}

$excludedDirectories = [System.Collections.Generic.List[string]]::new()
$excludedEnvironmentFiles = [System.Collections.Generic.List[string]]::new()
$excludedRuntimeData = ConvertTo-NormalizedFullPath (Join-Path $projectRoot 'data')
$directoryStack = [System.Collections.Generic.Stack[string]]::new()
$directoryStack.Push($projectRoot)
$includedFiles = [System.Collections.Generic.Dictionary[string, long]]::new([System.StringComparer]::OrdinalIgnoreCase)
$includedFileCount = [long]0
$includedByteCount = [long]0
$excludedLogCount = [long]0
$excludedLinkCount = [long]0

while ($directoryStack.Count -gt 0) {
    $currentDirectory = $directoryStack.Pop()
    foreach ($entry in Get-ChildItem -LiteralPath $currentDirectory -Force -ErrorAction Stop) {
        if ($entry.PSIsContainer) {
            $entryPath = ConvertTo-NormalizedFullPath $entry.FullName
            $isRuntimeData = $entryPath.Equals($excludedRuntimeData, [System.StringComparison]::OrdinalIgnoreCase)
            $isLink = ($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
            if ($isRuntimeData -or $excludedDirectoryNames.Contains($entry.Name) -or $isLink) {
                $excludedDirectories.Add($entryPath)
                if ($isLink) { $excludedLinkCount++ }
                continue
            }
            $directoryStack.Push($entryPath)
            continue
        }

        $isLinkFile = ($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
        if ($isLinkFile) {
            $excludedEnvironmentFiles.Add($entry.FullName)
            $excludedLinkCount++
            continue
        }

        $isExampleEnvironmentFile = $entry.Name.Equals('.env.example', [System.StringComparison]::OrdinalIgnoreCase)
        $isSecretEnvironmentFile = $entry.Name.Equals('.env', [System.StringComparison]::OrdinalIgnoreCase) -or
            ($entry.Name.StartsWith('.env.', [System.StringComparison]::OrdinalIgnoreCase) -and -not $isExampleEnvironmentFile)
        if ($isSecretEnvironmentFile) {
            $excludedEnvironmentFiles.Add($entry.FullName)
            continue
        }

        if ($entry.Extension.Equals('.log', [System.StringComparison]::OrdinalIgnoreCase)) {
            $excludedLogCount++
            continue
        }

        $relativeFilePath = $entry.FullName.Substring($projectRoot.Length).TrimStart([char[]]@('\', '/'))
        $includedFiles[$relativeFilePath] = [long]$entry.Length
        $includedFileCount++
        $includedByteCount += [long]$entry.Length
    }
}

if ($includedFileCount -eq 0) {
    throw '没有找到可备份的项目文件，已停止备份。'
}

$archivePath = Join-Path $BackupRoot ("$archiveBaseName.zip")
$archiveSequence = 2
while (Test-Path -LiteralPath $archivePath) {
    $archivePath = Join-Path $BackupRoot ("$archiveBaseName ($archiveSequence).zip")
    $archiveSequence++
}
$archivePath = ConvertTo-NormalizedFullPath $archivePath
if (-not (Test-PathInsideDirectory -Candidate $archivePath -Directory $projectBackupRoot)) {
    throw '最终压缩包只能位于根目录 dist\backups，已停止备份。'
}

$archiveFileName = [System.IO.Path]::GetFileNameWithoutExtension($archivePath)
$stagingSession = ConvertTo-NormalizedFullPath (Join-Path $temporaryRoot ([Guid]::NewGuid().ToString('N')))
$stagingDirectory = Join-Path $stagingSession $archiveFileName
$temporaryArchivePath = Join-Path $BackupRoot (".$archiveFileName.$([Guid]::NewGuid().ToString('N')).partial")

$backupVolume = [System.IO.Path]::GetPathRoot($BackupRoot)
try {
    $driveInfo = [System.IO.DriveInfo]::new($backupVolume)
    if ($driveInfo.IsReady) {
        $requiredFreeBytes = ($includedByteCount * 2) + [Math]::Max(64MB, [Math]::Ceiling($includedByteCount * 0.05))
        if ($driveInfo.AvailableFreeSpace -lt $requiredFreeBytes) {
            throw ("备份空间不足。需要约 {0:N0} MB，可用 {1:N0} MB。" -f ($requiredFreeBytes / 1MB), ($driveInfo.AvailableFreeSpace / 1MB))
        }
    }
}
catch [System.Management.Automation.RuntimeException] {
    throw
}
catch {
    Write-Host '无法读取目标磁盘剩余空间，继续尝试备份。' -ForegroundColor Yellow
}

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
New-Item -ItemType Directory -Path $stagingDirectory -Force | Out-Null
$logPath = Join-Path $stagingSession 'backup.log'
$robocopy = Join-Path $env:SystemRoot 'System32\robocopy.exe'
if (-not (Test-Path -LiteralPath $robocopy -PathType Leaf)) {
    throw '找不到 Windows Robocopy，未能开始备份。'
}

Write-Host ''
Write-Host 'LFAA 版本化源码压缩备份' -ForegroundColor Cyan
Write-Host "项目目录：$projectRoot"
Write-Host "项目版本：$projectName $projectVersion"
Write-Host "压缩包：$archivePath"
Write-Host ("待备份文件：{0:N0} 个，约 {1:N2} MB" -f $includedFileCount, ($includedByteCount / 1MB))
Write-Host ("排除目录：{0:N0} 个；本地密钥配置：{1:N0} 个；日志：{2:N0} 个；链接：{3:N0} 个" -f $excludedDirectories.Count, $excludedEnvironmentFiles.Count, $excludedLogCount, $excludedLinkCount)
Write-Host '保留：源码、静态资源、文档、项目配置、锁文件和可用的 Git 元数据。' -ForegroundColor Green
Write-Host '排除：node_modules、整个 dist/、其他构建/缓存目录、data/ 运行数据、日志、真实 .env 和目录链接。' -ForegroundColor Yellow
Write-Host ''

$robocopyArguments = [System.Collections.Generic.List[string]]::new()
$robocopyArguments.Add($projectRoot)
$robocopyArguments.Add($stagingDirectory)
$robocopyArguments.Add('*')
$robocopyArguments.Add('/E')
$robocopyArguments.Add('/COPY:DAT')
$robocopyArguments.Add('/DCOPY:DAT')
$robocopyArguments.Add('/R:2')
$robocopyArguments.Add('/W:2')
$robocopyArguments.Add('/XJ')
$robocopyArguments.Add('/MT:8')
$robocopyArguments.Add('/Z')
$robocopyArguments.Add('/NP')
$robocopyArguments.Add('/TEE')
$robocopyArguments.Add('/NFL')
$robocopyArguments.Add('/NDL')
$robocopyArguments.Add("/LOG:$logPath")
$robocopyArguments.Add('/XF')
$robocopyArguments.Add('*.log')
foreach ($environmentFile in $excludedEnvironmentFiles) {
    $robocopyArguments.Add($environmentFile)
}
$robocopyArguments.Add('/XD')
foreach ($directory in $excludedDirectories) {
    $robocopyArguments.Add($directory)
}

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    & $robocopy @robocopyArguments
    $robocopyExitCode = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $previousErrorActionPreference
}

if ($robocopyExitCode -ge 8) {
    Write-Host "备份未完成，Robocopy 退出码：$robocopyExitCode。临时文件保留在：$stagingSession" -ForegroundColor Red
    throw "Robocopy 备份失败，退出码：$robocopyExitCode。"
}

$copiedFiles = @(Get-ChildItem -LiteralPath $stagingDirectory -File -Force -Recurse -ErrorAction Stop)
$copiedByteCount = [long](($copiedFiles | Measure-Object -Property Length -Sum).Sum)
$verifiedPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$verificationErrors = [System.Collections.Generic.List[string]]::new()
foreach ($copiedFile in $copiedFiles) {
    $relativeFilePath = $copiedFile.FullName.Substring($stagingDirectory.Length).TrimStart([char[]]@('\', '/'))
    if (-not $includedFiles.ContainsKey($relativeFilePath)) {
        $verificationErrors.Add("备份中出现未计划的文件：$relativeFilePath")
        continue
    }
    if ($includedFiles[$relativeFilePath] -ne [long]$copiedFile.Length) {
        $verificationErrors.Add("文件大小不一致：$relativeFilePath")
        continue
    }
    $verifiedPaths.Add($relativeFilePath) | Out-Null
}
foreach ($relativeFilePath in $includedFiles.Keys) {
    if (-not $verifiedPaths.Contains($relativeFilePath)) {
        $verificationErrors.Add("备份缺少文件：$relativeFilePath")
    }
}

if ($verificationErrors.Count -gt 0 -or $copiedFiles.Count -ne $includedFileCount -or $copiedByteCount -ne $includedByteCount) {
    Write-Host ("暂存校验未通过：源文件 {0:N0} 个 / {1:N0} 字节，暂存文件 {2:N0} 个 / {3:N0} 字节。" -f $includedFileCount, $includedByteCount, $copiedFiles.Count, $copiedByteCount) -ForegroundColor Red
    $verificationErrors | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    Write-Host "未删除临时文件，请检查日志：$logPath" -ForegroundColor Yellow
    throw '源码暂存校验未通过。'
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
try {
    $archiveFileStream = [System.IO.File]::Open(
        $temporaryArchivePath,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
    )
    $archiveWriter = $null
    try {
        $archiveWriter = [System.IO.Compression.ZipArchive]::new(
            $archiveFileStream,
            [System.IO.Compression.ZipArchiveMode]::Create,
            $false
        )
        foreach ($copiedFile in $copiedFiles) {
            $relativeFilePath = $copiedFile.FullName.Substring($stagingDirectory.Length).TrimStart([char[]]@('\', '/'))
            $archiveEntryName = "$archiveFileName/$($relativeFilePath.Replace('\', '/'))"
            $archiveEntry = $archiveWriter.CreateEntry($archiveEntryName, [System.IO.Compression.CompressionLevel]::Optimal)
            $sourceStream = [System.IO.File]::OpenRead($copiedFile.FullName)
            $entryStream = $archiveEntry.Open()
            try {
                $sourceStream.CopyTo($entryStream)
            }
            finally {
                $entryStream.Dispose()
                $sourceStream.Dispose()
            }
        }
    }
    finally {
        if ($null -ne $archiveWriter) {
            $archiveWriter.Dispose()
        }
        $archiveFileStream.Dispose()
    }

$zipArchive = [System.IO.Compression.ZipFile]::OpenRead($temporaryArchivePath)
try {
    $archiveFiles = @($zipArchive.Entries | Where-Object { -not $_.FullName.EndsWith('/') -and -not $_.FullName.EndsWith('\') })
    $archiveByteCount = [long]0
    $archiveVerifiedPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $archiveVerificationErrors = [System.Collections.Generic.List[string]]::new()
    $archivePrefix = "$archiveFileName/"
    foreach ($archiveEntry in $archiveFiles) {
        if ($archiveEntry.FullName.IndexOf('\') -ge 0) {
            $archiveVerificationErrors.Add("压缩包条目必须使用 ZIP 标准斜线：$($archiveEntry.FullName)")
            continue
        }
        $archiveEntryPath = $archiveEntry.FullName.Replace('\', '/')
        if (-not $archiveEntryPath.StartsWith($archivePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            $archiveVerificationErrors.Add("压缩包中出现根目录异常的文件：$($archiveEntry.FullName)")
            continue
        }

        $relativeFilePath = $archiveEntryPath.Substring($archivePrefix.Length).Replace('/', '\')
        if (-not $includedFiles.ContainsKey($relativeFilePath)) {
            $archiveVerificationErrors.Add("压缩包中出现未计划的文件：$relativeFilePath")
        }
        elseif ($includedFiles[$relativeFilePath] -ne [long]$archiveEntry.Length) {
            $archiveVerificationErrors.Add("压缩包内文件大小不一致：$relativeFilePath")
        }
        else {
            $archiveVerifiedPaths.Add($relativeFilePath) | Out-Null
        }

        $archiveByteCount += [long]$archiveEntry.Length
        $entryStream = $archiveEntry.Open()
        try {
            $buffer = [byte[]]::new(81920)
            while ($entryStream.Read($buffer, 0, $buffer.Length) -gt 0) { }
        }
        finally {
            $entryStream.Dispose()
        }
    }

    foreach ($relativeFilePath in $includedFiles.Keys) {
        if (-not $archiveVerifiedPaths.Contains($relativeFilePath)) {
            $archiveVerificationErrors.Add("压缩包缺少文件：$relativeFilePath")
        }
    }

    if ($archiveVerificationErrors.Count -gt 0 -or $archiveFiles.Count -ne $includedFileCount -or $archiveByteCount -ne $includedByteCount) {
        $archiveVerificationErrors | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
        throw 'ZIP 压缩包校验未通过。'
    }
}
finally {
    $zipArchive.Dispose()
}

[System.IO.File]::Move($temporaryArchivePath, $archivePath)
}
catch {
    if ((Test-PathInsideDirectory -Candidate $temporaryArchivePath -Directory $BackupRoot) -and
        (Test-Path -LiteralPath $temporaryArchivePath -PathType Leaf)) {
        Remove-Item -LiteralPath $temporaryArchivePath -Force -ErrorAction SilentlyContinue
    }
    throw
}

try {
    if (Test-PathInsideDirectory -Candidate $stagingSession -Directory $temporaryRoot) {
        Remove-Item -LiteralPath $stagingSession -Recurse -Force -ErrorAction Stop
    }
}
catch {
    Write-Host "压缩包已生成，但临时目录清理失败：$stagingSession" -ForegroundColor Yellow
}

Write-Host ''
Write-Host ("备份完成并通过 ZIP 文件数量、总大小校验：{0:N0} 个文件，{1:N2} MB。" -f $archiveFiles.Count, ($archiveByteCount / 1MB)) -ForegroundColor Green
Write-Host "保存位置：$archivePath" -ForegroundColor Cyan

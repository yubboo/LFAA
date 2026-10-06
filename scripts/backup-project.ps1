<#
功能：创建 LFAA 项目的版本化纯净 ZIP 源码备份。
作用：将源码备份写入根目录 dist\backups，排除大依赖、构建产物、全部运行数据目录、数据库、密钥、日志与真实 .env。
关联文件：根目录 lfaa.bat、project-menu.mjs 菜单所在的 install-dependencies.ps1、项目根目录 dist\backups、package.json、pnpm-lock.yaml、pnpm-workspace.yaml。
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
# 输出祖先不能是目录联接；字符串路径位于 dist 不代表实际落盘也位于 dist。
function Assert-BackupPathHasNoLinks {
    param([string]$Path)
    $currentPath = ConvertTo-NormalizedFullPath $Path
    while (Test-PathInsideDirectory -Candidate $currentPath -Directory $projectRoot) {
        if ((Test-Path -LiteralPath $currentPath) -and
            ((Get-Item -LiteralPath $currentPath -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
            throw '备份输出或暂存路径含目录链接，已停止备份。'
        }
        if ($currentPath -eq $projectRoot) { break }
        $currentPath = Split-Path -Parent $currentPath
    }
}
Assert-BackupPathHasNoLinks $temporaryRoot
New-Item -ItemType Directory -Path $temporaryRoot -Force | Out-Null
Assert-BackupPathHasNoLinks (Join-Path $temporaryRoot 'backup.lock')
try {
    $backupLock = [System.IO.File]::Open((Join-Path $temporaryRoot 'backup.lock'), [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
} catch { throw '已有源码备份正在执行，或暂存目录不可写。请等待当前备份完成后重试。' }
$stagingSession = $null
$temporaryArchivePath = $null
try {
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
    'packages\client',
    'packages\boot\app-boot',
    'packages\host\daemon',
    'native\system',
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
Assert-BackupPathHasNoLinks $BackupRoot

$excludedDirectoryNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$excludedDirectoryNameList = @(
    '.git',
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

# 运行数据根目录：控制端与节点在本地生成的数据库、凭据、缓存和日志都落在这些目录下。
# 按实际路径判断而不是按目录名判断，避免误排 packages/credentials 等源码包。
$runtimeDataRootCandidates = [System.Collections.Generic.List[string]]::new()
$runtimeDataRootCandidates.Add((Join-Path $projectRoot 'data'))
$runtimeDataRootCandidates.Add((Join-Path $projectRoot 'server\data'))
# 只加载环境文件并调用同一数据路径 Owner，避免漏收项目内部显式配置的数据根；不导入会创建密钥的运行配置。
$nodeCommand = Get-Command 'node' -ErrorAction SilentlyContinue
if ($nodeCommand) {
    $resolveDataScript = @'
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.argv[1];
if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'));
const { resolveDataDirectory } = await import(pathToFileURL(resolve(root, 'packages/util/home-paths/src/resolve-data-directory.mjs')));
process.stdout.write(resolveDataDirectory(root, process.env.LFAA_DATA_DIR?.trim() || 'data'));
'@
    $configuredDataRoot = & $nodeCommand.Source --input-type=module -e $resolveDataScript $projectRoot
    if ($LASTEXITCODE -ne 0) { throw '无法核查实际数据根目录，已停止备份，避免收录运行数据。' }
    $runtimeDataRootCandidates.Add([string]$configuredDataRoot)
} elseif ($env:LFAA_DATA_DIR) {
    $configuredDataPath = $env:LFAA_DATA_DIR
    if (-not [System.IO.Path]::IsPathRooted($configuredDataPath)) { $configuredDataPath = Join-Path $projectRoot $configuredDataPath }
    $runtimeDataRootCandidates.Add([System.IO.Path]::GetFullPath($configuredDataPath))
} elseif (Test-Path -LiteralPath (Join-Path $projectRoot '.env')) {
    throw '存在本机环境配置但没有 Node.js，无法安全核查数据目录。请先安装 Node.js。'
}
foreach ($appDirectory in Get-ChildItem -LiteralPath (Join-Path $projectRoot 'apps') -Directory -ErrorAction SilentlyContinue) {
    $runtimeDataRootCandidates.Add((Join-Path $appDirectory.FullName 'data'))
}
$runtimeDataRoots = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($runtimeDataRootCandidate in $runtimeDataRootCandidates) {
    if (Test-Path -LiteralPath $runtimeDataRootCandidate -PathType Container) {
        [void]$runtimeDataRoots.Add((ConvertTo-NormalizedFullPath $runtimeDataRootCandidate))
    }
}

# 敏感与本机运行文件名：即使落在未被排除的目录里，也不进入备份。
# 同一份清单同时用于文件清点与 Robocopy /XF，保证两者排除范围一致。
$excludedFileNamePatterns = @(
    '.git',
    '*.log',
    '*.sqlite', '*.sqlite-wal', '*.sqlite-shm',
    '*.db', '*.db-wal', '*.db-shm',
    '*.key', '*.pem', '*.p12', '*.pfx', '*.jks', '*.keystore', '*.crt', '*.cer', '*.der',
    'jwt-secret', 'daemon-token', 'daemon-node-id', 'daemon.lock',
    '.lfaa-data-directory.pending.json',
    '.npmrc', '.pypirc', '.netrc', '.git-credentials',
    'credentials.json', 'secrets.json', 'token.json', 'auth.json', 'service-account*.json',
    '*.sqlite3', '*.token', '*.secret', '*.secrets', '*.p8', 'id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'
)

$excludedDirectories = [System.Collections.Generic.List[string]]::new()
$excludedEnvironmentFiles = [System.Collections.Generic.List[string]]::new()
$excludedRuntimeFiles = [System.Collections.Generic.List[string]]::new()
$directoryStack = [System.Collections.Generic.Stack[string]]::new()
$directoryStack.Push($projectRoot)
$includedFiles = [System.Collections.Generic.Dictionary[string, long]]::new([System.StringComparer]::OrdinalIgnoreCase)
$includedFileCount = [long]0
$includedByteCount = [long]0
$excludedLinkCount = [long]0

while ($directoryStack.Count -gt 0) {
    $currentDirectory = $directoryStack.Pop()
    foreach ($entry in Get-ChildItem -LiteralPath $currentDirectory -Force -ErrorAction Stop) {
        if ($entry.PSIsContainer) {
            $entryPath = ConvertTo-NormalizedFullPath $entry.FullName
            $isRuntimeData = $runtimeDataRoots.Contains($entryPath)
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

        $isExcludedRuntimeFile = $false
        foreach ($excludedFileNamePattern in $excludedFileNamePatterns) {
            if ($entry.Name -like $excludedFileNamePattern) {
                $isExcludedRuntimeFile = $true
                break
            }
        }
        if ($isExcludedRuntimeFile) {
            $excludedRuntimeFiles.Add($entry.FullName)
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
# 清理历史中断留下的未完成压缩包；它们不是可用备份，只占空间。
$stalePartialFiles = @(Get-ChildItem -LiteralPath $BackupRoot -Filter ".$projectName *.partial" -File -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '\.[0-9a-f]{32}\.partial$' })
foreach ($stalePartialFile in $stalePartialFiles) {
    Remove-Item -LiteralPath $stalePartialFile.FullName -Force -ErrorAction SilentlyContinue
}
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
Write-Host ("排除目录：{0:N0} 个（含运行数据根目录 {1:N0} 个）；本地密钥配置：{2:N0} 个；数据库/密钥/日志等敏感文件：{3:N0} 个；链接：{4:N0} 个；清掉历史未完成压缩包：{5:N0} 个" -f $excludedDirectories.Count, $runtimeDataRoots.Count, $excludedEnvironmentFiles.Count, $excludedRuntimeFiles.Count, $excludedLinkCount, $stalePartialFiles.Count)
Write-Host '保留：当前源码、静态资源、文档、项目配置、锁文件和上游目录占位。' -ForegroundColor Green
Write-Host '排除：Git 历史、node_modules、整个 dist/、构建/缓存目录、实际运行数据、数据库、密钥、日志、真实 .env、本机认证配置和目录链接。' -ForegroundColor Yellow
Write-Host ''

# Robocopy 通过命令行接收逐项排除路径；条目过多时命令行可能被截断，先明确报错而不是留下半个备份。
$exclusionArgumentLength = [long]0
foreach ($exclusionFile in (@($excludedEnvironmentFiles) + @($excludedRuntimeFiles))) {
    $exclusionArgumentLength += $exclusionFile.Length + 1
}
if ($exclusionArgumentLength -gt 20000) {
    throw '需要逐项排除的本机文件过多，无法安全传给 Robocopy；请先清理运行数据目录，或为这些目录补充目录级排除规则。'
}

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
$robocopyArguments.Add('/NJH')
$robocopyArguments.Add('/NJS')
$robocopyArguments.Add('/NFL')
$robocopyArguments.Add('/NDL')
$robocopyArguments.Add("/LOG:$logPath")
$robocopyArguments.Add('/XF')
foreach ($excludedFileNamePattern in $excludedFileNamePatterns) {
    $robocopyArguments.Add($excludedFileNamePattern)
}
foreach ($environmentFile in $excludedEnvironmentFiles) {
    $robocopyArguments.Add($environmentFile)
}
foreach ($excludedRuntimeFile in $excludedRuntimeFiles) {
    $robocopyArguments.Add($excludedRuntimeFile)
}
$robocopyArguments.Add('/XD')
foreach ($directory in $excludedDirectories) {
    $robocopyArguments.Add($directory)
}

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    Write-Host '阶段 1/3：暂存当前源码（详情写入暂存日志）。' -ForegroundColor Cyan
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
    Write-Host '本轮暂存将在退出时清理；请根据上面的差异修复后重试。' -ForegroundColor Yellow
    throw '源码暂存校验未通过。'
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
Write-Host '阶段 2/3：压缩源码。' -ForegroundColor Cyan
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
        $compressedCount = 0
        foreach ($copiedFile in $copiedFiles) {
            $compressedCount++
            if ($compressedCount % 100 -eq 0) { Write-Host ("已压缩 {0}/{1} 个文件。" -f $compressedCount, $copiedFiles.Count) -ForegroundColor DarkGray }
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

Write-Host '阶段 3/3：逐项读取 ZIP 并核对源码清单。' -ForegroundColor Cyan
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
} finally {
    # 失败也撤销本轮暂存与未完成压缩包；不删除正式 ZIP，也不清理其他备份进程的文件。
    if ($temporaryArchivePath -and (Test-PathInsideDirectory -Candidate $temporaryArchivePath -Directory $projectBackupRoot) -and (Test-Path -LiteralPath $temporaryArchivePath -PathType Leaf)) {
        Remove-Item -LiteralPath $temporaryArchivePath -Force -ErrorAction SilentlyContinue
    }
    if ($stagingSession -and (Test-PathInsideDirectory -Candidate $stagingSession -Directory $temporaryRoot) -and (Test-Path -LiteralPath $stagingSession)) {
        Remove-Item -LiteralPath $stagingSession -Recurse -Force -ErrorAction SilentlyContinue
    }
    $backupLock.Dispose()
}

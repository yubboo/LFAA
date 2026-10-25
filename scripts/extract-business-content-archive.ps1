param(
    [Parameter(Mandatory = $true)][string]$ArchivePath,
    [Parameter(Mandatory = $true)][string]$Destination
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$archivePath = [System.IO.Path]::GetFullPath($ArchivePath)
$destinationPath = [System.IO.Path]::GetFullPath($Destination)
$archiveInfo = Get-Item -LiteralPath $archivePath -Force
if (-not $archiveInfo -or $archiveInfo.PSIsContainer -or ($archiveInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { throw 'ZIP 路径必须是普通文件。' }
if (Test-Path -LiteralPath $destinationPath) {
    $destinationInfo = Get-Item -LiteralPath $destinationPath -Force
    if (-not $destinationInfo.PSIsContainer -or ($destinationInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { throw 'ZIP 暂存目标必须是普通目录。' }
    if (Get-ChildItem -LiteralPath $destinationPath -Force | Select-Object -First 1) { throw 'ZIP 暂存目标必须为空。' }
} else { [System.IO.Directory]::CreateDirectory($destinationPath) | Out-Null }

$zip = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
$seenRaw = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$raw = @()
try {
    if ($zip.Entries.Count -eq 0 -or $zip.Entries.Count -gt 500000) { throw 'ZIP 条目数量无效或超过 500,000 项。' }
    foreach ($entry in $zip.Entries) {
        $path = $entry.FullName.Replace('\', '/').TrimEnd('/')
        if ([string]::IsNullOrWhiteSpace($path) -or $path.StartsWith('/') -or $path -match '^[A-Za-z]:' -or $path.Contains(':') -or $path.Contains([char]0)) { throw 'ZIP 中包含绝对路径或无效路径。' }
        $segments = $path.Split('/')
        if ($segments | Where-Object { $_ -eq '' -or $_ -eq '.' -or $_ -eq '..' }) { throw 'ZIP 中包含目录穿越或无效路径。' }
        if (-not $seenRaw.Add($path)) { throw 'ZIP 中包含重复路径（忽略大小写后）。' }
        $unixMode = ($entry.ExternalAttributes -shr 16) -band 0xF000
        $windowsAttributes = $entry.ExternalAttributes -band 0xFFFF
        if ($unixMode -eq 0xA000 -or ($windowsAttributes -band 0x400) -ne 0) { throw 'ZIP 中包含符号链接或重解析点。' }
        $raw += [pscustomobject]@{ Entry = $entry; Path = $path; IsDirectory = [string]::IsNullOrEmpty($entry.Name) }
    }

    $businessPattern = '^(games(?:/|$)|users/[0-9a-f]{64}/projects/(?:writing|aivideo|canvas)(?:/|$))'
    $hasDirectBusiness = @($raw | Where-Object { $_.Path -match $businessPattern }).Count -gt 0
    $wrapper = ''
    if (-not $hasDirectBusiness) {
        $wrappers = @($raw | ForEach-Object {
            $slash = $_.Path.IndexOf('/')
            if ($slash -gt 0 -and $_.Path.Substring($slash + 1) -match $businessPattern) { $_.Path.Substring(0, $slash) }
        } | Sort-Object -Unique)
        if ($wrappers.Count -gt 1) { throw 'ZIP 包含多个外层目录，无法唯一识别 data 根。' }
        if ($wrappers.Count -eq 1) { $wrapper = [string]$wrappers[0] + '/' }
    }

    $rootPrefix = $destinationPath.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    $selected = @()
    [long]$totalBytes = 0
    foreach ($item in $raw) {
        $relative = $item.Path
        if ($wrapper -and $relative.StartsWith($wrapper, [System.StringComparison]::OrdinalIgnoreCase)) { $relative = $relative.Substring($wrapper.Length) }
        if ($relative -eq 'lfaa-business-content.json') { $selected += [pscustomobject]@{ Entry = $item.Entry; Path = $relative; IsDirectory = $false }; continue }
        if ($relative -notmatch $businessPattern) { continue }
        $target = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($destinationPath, ($relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar))))
        if (-not $target.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'ZIP 内容路径超出暂存目录。' }
        if (-not $item.IsDirectory) {
            if ($item.Entry.Length -lt 0 -or $item.Entry.Length -gt [long]::MaxValue - $totalBytes) { throw 'ZIP 解压大小溢出。' }
            $totalBytes += $item.Entry.Length
        }
        $selected += [pscustomobject]@{ Entry = $item.Entry; Path = $relative; IsDirectory = $item.IsDirectory }
    }
    if ($selected.Count -eq 0) { throw 'ZIP 中没有识别到 games/ 或账户项目下的 Writing/AI Video 业务数据。' }
    $drive = [System.IO.DriveInfo]::new([System.IO.Path]::GetPathRoot($destinationPath))
    if ($totalBytes + 134217728 -gt $drive.AvailableFreeSpace) { throw '目标磁盘空间不足以暂存 ZIP 业务数据（另需预留 128 MiB）。' }

    $seenSelected = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($item in $selected) {
        if (-not $seenSelected.Add($item.Path)) { throw 'ZIP 中业务目录存在重复路径（忽略大小写后）。' }
        $target = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($destinationPath, ($item.Path.Replace('/', [System.IO.Path]::DirectorySeparatorChar))))
        if (-not $target.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'ZIP 内容路径超出暂存目录。' }
        if ($item.Path -eq 'lfaa-business-content.json') {
            if ($item.Entry.Length -gt 4194304) { throw 'ZIP 业务内容清单超过 4 MiB。' }
        } elseif ($item.IsDirectory) { [System.IO.Directory]::CreateDirectory($target) | Out-Null; continue }
        [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($target)) | Out-Null
        $input = $item.Entry.Open()
        $output = [System.IO.File]::Open($target, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        try { $input.CopyTo($output) } finally { $output.Dispose(); $input.Dispose() }
    }
    [Console]::Out.WriteLine(($selected.Count.ToString() + ' business entries; ' + $totalBytes.ToString() + ' bytes'))
} finally { $zip.Dispose() }
exit 0

param(
    [Parameter(Mandatory = $true)][string]$ArchivePath,
    [Parameter(Mandatory = $true)][string]$Destination
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$archiveFullPath = [System.IO.Path]::GetFullPath($ArchivePath)
$destinationFullPath = [System.IO.Path]::GetFullPath($Destination)
$archiveInfo = Get-Item -LiteralPath $archiveFullPath -Force
if (-not $archiveInfo -or $archiveInfo.PSIsContainer -or ($archiveInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    throw 'ZIP 备份路径必须是普通文件。'
}
if (Test-Path -LiteralPath $destinationFullPath) {
    $destinationInfo = Get-Item -LiteralPath $destinationFullPath -Force
    if (-not $destinationInfo.PSIsContainer -or ($destinationInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
        throw 'ZIP 暂存目标必须是普通目录。'
    }
    if (Get-ChildItem -LiteralPath $destinationFullPath -Force | Select-Object -First 1) {
        throw 'ZIP 暂存目标必须为空。'
    }
} else {
    [System.IO.Directory]::CreateDirectory($destinationFullPath) | Out-Null
}

$root = $destinationFullPath.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$archive = [System.IO.Compression.ZipFile]::OpenRead($archiveFullPath)
$totalBytes = [long]0
try {
    if ($archive.Entries.Count -eq 0 -or $archive.Entries.Count -gt 500000) { throw 'ZIP 文件项数量无效或超过 500,000 项。' }
    $entries = @($archive.Entries)
    foreach ($entry in $entries) {
        $relative = $entry.FullName.Replace('\', '/').TrimEnd('/')
        $isDirectory = [string]::IsNullOrEmpty($entry.Name)
        if ([string]::IsNullOrWhiteSpace($relative) -or $relative.StartsWith('/') -or $relative -match '^[A-Za-z]:' -or $relative.Contains(':') -or $relative.Contains([char]0)) {
            throw 'ZIP 中包含绝对路径或无效路径。'
        }
        $segments = $relative.Split('/')
        if ($segments | Where-Object { $_ -eq '' -or $_ -eq '.' -or $_ -eq '..' }) { throw 'ZIP 中包含目录穿越或无效路径。' }
        if (-not $seen.Add($relative)) { throw 'ZIP 中有重复路径（忽略大小写后）。' }
        $unixMode = ($entry.ExternalAttributes -shr 16) -band 0xF000
        $windowsAttributes = $entry.ExternalAttributes -band 0xFFFF
        if ($unixMode -eq 0xA000 -or ($windowsAttributes -band 0x400) -ne 0) { throw 'ZIP 中包含符号链接或重解析点。' }
        if (-not $isDirectory) {
            if ($entry.Length -lt 0 -or $entry.Length -gt [long]::MaxValue - $totalBytes) { throw 'ZIP 解压大小超出允许范围。' }
            $totalBytes += $entry.Length
        }
        $target = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($destinationFullPath, ($relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar))))
        if (-not $target.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'ZIP 中的路径超出解压目录。' }
    }

    $drive = [System.IO.DriveInfo]::new([System.IO.Path]::GetPathRoot($destinationFullPath))
    if ($totalBytes + 268435456 -gt $drive.AvailableFreeSpace) { throw '目标磁盘可用空间不足以安全导入该 ZIP（另需预留 256 MiB）。' }

    foreach ($entry in $entries) {
        $relative = $entry.FullName.Replace('\', '/').TrimEnd('/')
        $target = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($destinationFullPath, ($relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar))))
        if ([string]::IsNullOrEmpty($entry.Name)) {
            [System.IO.Directory]::CreateDirectory($target) | Out-Null
            continue
        }
        [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($target)) | Out-Null
        $inputStream = $entry.Open()
        try {
            $outputStream = [System.IO.File]::Open($target, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
            try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose() }
        } finally { $inputStream.Dispose() }
    }
    [Console]::Out.WriteLine(($entries.Count.ToString() + ' entries; ' + $totalBytes.ToString() + ' bytes'))
} finally {
    $archive.Dispose()
}

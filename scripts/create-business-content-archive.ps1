param(
    [Parameter(Mandatory = $true)][string]$SourceRoot,
    [Parameter(Mandatory = $true)][string]$ArchivePath,
    [Parameter(Mandatory = $true)][string]$ManifestPath,
    [Parameter(Mandatory = $true)][string]$ManifestName
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression

$source = [System.IO.Path]::GetFullPath($SourceRoot)
$archive = [System.IO.Path]::GetFullPath($ArchivePath)
$manifest = [System.IO.Path]::GetFullPath($ManifestPath)
$manifestInfo = Get-Item -LiteralPath $manifest -Force
if (-not $manifestInfo -or $manifestInfo.PSIsContainer -or ($manifestInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    throw '业务内容备份清单必须是普通文件。'
}
$entries = (Get-Content -LiteralPath $manifest -Raw -Encoding UTF8 | ConvertFrom-Json).entries
if ($null -eq $entries -or $entries.Count -gt 250000) { throw '业务内容备份清单为空或超过安全条目上限。' }

$stream = [System.IO.File]::Open($archive, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
$zip = $null
try {
    $zip = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
    $rootPrefix = $source.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    foreach ($entry in $entries) {
        $relative = [string]$entry.path
        if ([string]::IsNullOrWhiteSpace($relative) -or $relative.StartsWith('/') -or $relative.Contains('\') -or $relative.Contains(':') -or $relative.Contains([char]0)) { throw '业务备份清单包含无效路径。' }
        $segments = $relative.Split('/')
        if ($segments | Where-Object { $_ -eq '' -or $_ -eq '.' -or $_ -eq '..' }) { throw '业务备份清单包含路径穿越。' }
        $isGames = $relative -eq 'games' -or $relative.StartsWith('games/', [System.StringComparison]::OrdinalIgnoreCase)
        $isProject = $relative -match '^users/[0-9a-f]{64}/projects/(writing|aivideo|canvas)(/|$)'
        if (-not ($isGames -or $isProject)) { throw '业务备份清单包含非业务内容路径。' }
        $full = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($source, ($relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar))))
        if (-not $full.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw '业务备份路径超出当前内容目录。' }
        if ([string]$entry.type -eq 'directory') {
            $item = Get-Item -LiteralPath $full -Force
            if (-not $item.PSIsContainer -or ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { throw '业务目录已变化或包含链接。' }
            [void]$zip.CreateEntry(($relative.TrimEnd('/') + '/'))
            continue
        }
        if ([string]$entry.type -ne 'file') { throw '业务备份清单包含不支持的文件类型。' }
        $item = Get-Item -LiteralPath $full -Force
        if ($item.PSIsContainer -or ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { throw '业务文件已变化或包含链接。' }
        $zipEntry = $zip.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal)
        $input = [System.IO.File]::Open($full, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
        $output = $zipEntry.Open()
        try { $input.CopyTo($output) } finally { $output.Dispose(); $input.Dispose() }
    }
    $manifestEntry = $zip.CreateEntry($ManifestName, [System.IO.Compression.CompressionLevel]::Optimal)
    $manifestInput = [System.IO.File]::OpenRead($manifest)
    $manifestOutput = $manifestEntry.Open()
    try { $manifestInput.CopyTo($manifestOutput) } finally { $manifestOutput.Dispose(); $manifestInput.Dispose() }
} finally {
    if ($zip) { $zip.Dispose() }
    $stream.Dispose()
}
exit 0

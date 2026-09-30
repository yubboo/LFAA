<#
功能：读取项目所在 Windows 卷的 DriveType。
作用：区分固定磁盘与可移动磁盘，决定默认数据使用当前用户目录还是跟随项目目录。
关联文件：scripts/resolve-data-directory.mjs。
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'
$fullProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$driveRoot = [System.IO.Path]::GetPathRoot($fullProjectRoot)
if (-not $driveRoot) {
    throw '无法确定 LFAA 项目所在 Windows 卷。'
}

$driveInfo = [System.IO.DriveInfo]::new($driveRoot)
if (-not $driveInfo.IsReady) {
    throw 'LFAA 项目所在 Windows 卷尚未就绪。'
}

[Console]::Out.Write($driveInfo.DriveType.ToString())

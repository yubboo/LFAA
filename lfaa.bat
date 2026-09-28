@echo off
rem 文件：lfaa.bat
rem 作用：切换到项目根目录并启动统一菜单，提供依赖管理、开发服务、环境检查、源码备份和 GitHub 推送。
rem 关联文件：scripts\install-dependencies.ps1、scripts\backup-project.ps1、package.json、pnpm-workspace.yaml、.gitignore。
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-dependencies.ps1"
exit /b %ERRORLEVEL%

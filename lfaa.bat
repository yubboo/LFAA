@echo off
goto :lfaa_start
rem 文件：lfaa.bat
rem 功能：从任意工作目录打开 LFAA 项目菜单。
rem 作用：在当前终端启动 Harness 工作区菜单，辅助进程不另开窗口。
rem 关联文件：scripts\project-menu.mjs、scripts\install-dependencies.ps1、package.json。
rem 编码：无 BOM 的 UTF-8，CRLF 换行。
rem 中文说明由顶部跳转跳过，避免 CMD 按代码页错误截断注释。
:lfaa_start
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0" || exit /b 1
where node.exe >nul 2>nul
if errorlevel 1 goto :lfaa_without_node
node "%~dp0scripts\project-menu.mjs"
exit /b %ERRORLEVEL%
:lfaa_without_node
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-dependencies.ps1"
exit /b %ERRORLEVEL%

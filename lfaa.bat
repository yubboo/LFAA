@echo off
rem Windows 双击入口：切到 UTF-8 代码页，定位并启动 scripts\lfaa.ps1 菜单。
rem 关联：scripts\lfaa.ps1（菜单与动作）· package.json（脚本定义）
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "MENU=%~dp0scripts\lfaa.ps1"
if not exist "%MENU%" (
    echo [错误] 找不到 scripts\lfaa.ps1，仓库可能不完整。
    pause
    endlocal & exit /b 1
)
if not exist "%~dp0package.json" (
    echo [错误] 当前目录不是 LFAA 仓库根：%~dp0
    pause
    endlocal & exit /b 1
)

rem %* 原样透传：lfaa.bat 2 可直接执行菜单项 2 后退出，lfaa.bat --help 看用法。
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%MENU%" %*
set "LFAA_EXIT=%ERRORLEVEL%"

rem 菜单选 0 退出时，双击打开的窗口保留下来继续敲命令（exit 88 是脚本约定的标记）。
if "%LFAA_EXIT%"=="88" (
    echo %cmdcmdline% | find /i "/c" >nul
    if not errorlevel 1 (
        endlocal
        cd /d "%~dp0"
        cmd /k
        exit /b 0
    )
    endlocal & exit /b 0
)

rem 失败才暂停：双击时不会闪退，能看清报错；成功路径不留空窗口。
if not "%LFAA_EXIT%"=="0" pause
endlocal & exit /b %LFAA_EXIT%
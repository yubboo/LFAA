@echo off
rem Copyright (c) 2026 二鱼. Part of the LFAA project.
setlocal EnableExtensions
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\lfaa-setup.ps1"
exit /b %ERRORLEVEL%

; 功能：定制 LFAA Windows Electron 安装向导。
; 作用：保留安装数据；路径无效/空间不足时给出原因；支持当前用户 CLI PATH、真实安装明细和完成页快捷方式选项。
; 关联文件：apps/desktop-electron/package.json、apps/desktop-electron/assets/lfaa.cmd、apps/desktop-electron/nsis/path-environment.ps1、apps/desktop-electron/scripts/prepare-runtime.mjs。

; 目录页先允许继续，再由下一个向导页读取 GetInstDirError 并解释无效目录或空间不足；不会绕过 NSIS 的安装校验。
!define MUI_DIRECTORYPAGE_VERIFYONLEAVE
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

ShowInstDetails show

Var LfaaCliPathEntry

!ifndef BUILD_UNINSTALLER
  Var LfaaAddCliPath
  Var LfaaCliPathCheckbox

  !macro customPageAfterChangeDir
    Page custom LfaaCliPathPage LfaaCliPathPageLeave
  !macroend

  Function LfaaCliPathPage
  GetInstDirError $0
  ${if} $0 == 1
    IntOp $1 ${APP_64_UNPACKED_SIZE} + 1023
    IntOp $1 $1 / 1024
    MessageBox MB_OK|MB_ICONEXCLAMATION "所选安装目录无效或 Windows 无法访问。请选择可访问的目录；本安装约需 $1 MB 空间。"
    Abort
  ${elseif} $0 == 2
    IntOp $1 ${APP_64_UNPACKED_SIZE} + 1023
    IntOp $1 $1 / 1024
    MessageBox MB_OK|MB_ICONEXCLAMATION "目标磁盘可用空间不足。本安装约需 $1 MB，请释放空间或选择其他磁盘。"
    Abort
  ${endif}

  nsDialogs::Create 1018
  Pop $0
  ${if} $0 == error
    Abort
  ${endif}

  !insertmacro MUI_HEADER_TEXT "命令行工具（CLI）" "可选：将 LFAA 命令加入当前用户 PATH"
  ${NSD_CreateLabel} 0 0 100% 36u "勾选后，新打开的终端可直接运行 LFAA CLI。安装程序会调用随包 Node 运行时，不需要另外安装 Node.js。"
  Pop $0
  ${NSD_CreateLabel} 0 38u 100% 18u "示例命令：lfaa --help"
  Pop $0
  ${NSD_CreateCheckbox} 0 62u 100% 18u "将 LFAA CLI 添加到当前用户 PATH（推荐，默认勾选）"
  Pop $LfaaCliPathCheckbox
  ${NSD_Check} $LfaaCliPathCheckbox
  nsDialogs::Show
  FunctionEnd

  Function LfaaCliPathPageLeave
    ${NSD_GetState} $LfaaCliPathCheckbox $LfaaAddCliPath
  FunctionEnd
!endif

!macro customInstallFilesStart
  SetDetailsPrint textonly
  DetailPrint "正在安装到：$INSTDIR"
  SetDetailsPrint listonly
!macroend

!macro customInstall
  SetDetailsPrint both
  DetailPrint "LFAA 桌面程序与本机运行环境已安装到：$INSTDIR"
  DetailPrint "Control Plane 与 Daemon 运行组件已随程序安装。"
  DetailPrint "开始菜单快捷方式已创建；桌面快捷方式将在完成页按选择创建。"

  ReadRegStr $0 HKCU "Software\LFAA\DesktopInstaller" "CliPathAdded"
  ${if} $LfaaAddCliPath == 1
  ${orIf} $0 == 1
    IfFileExists "$INSTDIR\resources\app-runtime\node.exe" lfaaCliRuntimeReady
    DetailPrint "警告：随包 Node 运行时缺失，未设置 CLI PATH。"
    MessageBox MB_OK|MB_ICONEXCLAMATION "随包 Node 运行时缺失，不能设置 CLI PATH。请重新下载完整安装包后重试。"
    Goto lfaaCliPathDone

    lfaaCliRuntimeReady:
    CreateDirectory "$INSTDIR\bin"
    SetOutPath "$INSTDIR\bin"
    File "${PROJECT_DIR}\assets\lfaa.cmd"
    SetOutPath "$INSTDIR"
    StrCpy $LfaaCliPathEntry "$INSTDIR\bin"
    WriteRegStr HKCU "Software\LFAA\DesktopInstaller" "CliPathEntry" "$LfaaCliPathEntry"
    File /oname=$PLUGINSDIR\lfaa-path-environment.ps1 "${PROJECT_DIR}\nsis\path-environment.ps1"
    nsExec::ExecToStack /OEM '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\lfaa-path-environment.ps1" -Action Add'
    Pop $0
    Pop $1
    ${if} $0 == 0
      DetailPrint "LFAA CLI 已加入当前用户 PATH。新打开的终端即可使用。"
      System::Call 'user32::SendMessageTimeoutW(p 0xffff, i 0x001a, p 0, w "Environment", i 2, i 5000, *p .r1)'
    ${else}
      ${if} $1 == ""
        StrCpy $1 "脚本没有返回详细原因，请查看安装明细。"
      ${endif}
      DetailPrint "警告：将 LFAA CLI 加入当前用户 PATH 失败（错误码：$0）：$1"
      MessageBox MB_OK|MB_ICONEXCLAMATION "无法更新当前用户 PATH（错误码：$0）。原因：$1。LFAA 已安装；可重新运行安装器尝试，或手动把安装目录下的 bin 文件夹加入 PATH。"
    ${endif}
  ${endif}
  lfaaCliPathDone:
!macroend

!macro customFinishPage
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "LfaaRunInstalledApp"
  !define MUI_FINISHPAGE_RUN_TEXT "运行 LFAA"
  !define MUI_FINISHPAGE_SHOWREADME
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION "LfaaCreateDesktopShortcut"
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "创建桌面快捷方式"
  !insertmacro MUI_PAGE_FINISH

  Function LfaaRunInstalledApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  Function LfaaCreateDesktopShortcut
    SetShellVarContext current
    CreateShortCut "$DESKTOP\LFAA.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 SW_SHOWNORMAL "" "$INSTDIR"
  FunctionEnd
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    ReadRegStr $0 HKCU "Software\LFAA\DesktopInstaller" "CliPathAdded"
    ${if} $0 == 1
      ReadRegStr $LfaaCliPathEntry HKCU "Software\LFAA\DesktopInstaller" "CliPathEntry"
      InitPluginsDir
      File /oname=$PLUGINSDIR\lfaa-path-environment.ps1 "${PROJECT_DIR}\nsis\path-environment.ps1"
      nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\lfaa-path-environment.ps1" -Action Remove'
      Pop $0
      ${if} $0 == 0
        System::Call 'user32::SendMessageTimeoutW(p 0xffff, i 0x001a, p 0, w "Environment", i 2, i 5000, *p .r1)'
        DetailPrint "已从当前用户 PATH 移除 LFAA CLI 路径。"
      ${else}
        DetailPrint "警告：从当前用户 PATH 移除 LFAA CLI 失败，错误码：$0"
        MessageBox MB_OK|MB_ICONEXCLAMATION "无法从当前用户 PATH 移除 LFAA CLI 路径：$LfaaCliPathEntry。卸载会继续；如该目录仍留在 PATH 中，请手动移除。"
      ${endif}
    ${endif}
  ${endif}
!macroend

; 功能：保留用户已经选择的数据目录。
; 作用：仅让 electron-builder 清出程序文件，再恢复安装目录中的 data/。
!macro customRemoveFiles
  CreateDirectory "$PLUGINSDIR\old-install"
  Push ""
  Call un.atomicRMDir
  Pop $R0
  ${if} $R0 != 0
    Push ""
    Call un.restoreFiles
    Pop $R0
    Abort "LFAA 程序文件正在使用，卸载已停止；数据目录未删除。"
  ${endIf}

  IfFileExists "$PLUGINSDIR\old-install\data\*.*" 0 lfaaDataPreserved
  CreateDirectory "$INSTDIR\data"
  Push "\data"
  Call un.restoreFiles
  Pop $R0
lfaaDataPreserved:
  RMDir /r "$INSTDIR\resources"
  Delete /REBOOTOK "$INSTDIR\${UNINSTALL_FILENAME}"
!macroend

; 功能：在卸载或覆盖安装时保留安装目录中的 LFAA 运行数据。
; 作用：复用 electron-builder 的安全文件移出流程，只把程序安装文件清出安装目录，再恢复 data/ 数据树。
; 关联文件：apps/desktop-electron/package.json、apps/desktop-electron/src/main.mjs、apps/desktop-electron/assets/installation-notice.txt。
ShowInstDetails show

!macro customInstall
  SetDetailsPrint both
  DetailPrint "LFAA 桌面程序与本机运行环境已安装到：$INSTDIR"
  DetailPrint "Control Plane 与 Daemon 运行组件已随程序安装。"
  DetailPrint "开始菜单与桌面快捷方式已创建。"
!macroend

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

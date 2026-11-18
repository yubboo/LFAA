# Dev Log 000051 — 选择菜单 0 退出时保留终端窗口不自动关闭

- **时间**：2026-11-18 08:34:34 +08:00
- **任务编号**：000051
- **任务目标**：用户选择 `lfaa.bat` 菜单项 `0` 时，退出菜单但不关闭当前终端窗口，方便继续执行命令行操作。

## 变更文件清单

- `e:\lfaa\scripts\lfaa.ps1`：
  - 新增 `Test-LaunchedStandalone`（通过 `Win32_Process` 检测祖父进程是否非 `cmd.exe`/`powershell.exe`/`pwsh.exe`），区分资源管理器双击独立启动与在已有终端中运行。
  - 将 `0` 选项文案更新为 `0. 退出菜单（保留终端窗口）`；独立启动时打印保留提示并以退出码 `88` 交由 `lfaa.bat` 接管，已有终端中运行则常规 `exit 0` 返回原提示符。
- `e:\lfaa\lfaa.bat`：捕获退出码 `88` 且 `%cmdcmdline%` 含 `/c` 时，切换到仓库根目录并执行 `cmd /k` 保持窗口打开。
- `e:\lfaa\scripts\README.md`：补充选项 `0` 保留终端窗口说明。

## 验证结果

1. **PowerShell 语法校验**：`[System.Management.Automation.Language.Parser]::ParseFile("e:\lfaa\scripts\lfaa.ps1", ...)` 输出 `PS1_SYNTAX_OK`。
2. **`lfaa.bat` 实测**：通过 PowerShell 管道输入 `0` 执行 `cmd /c e:\lfaa\lfaa.bat`，菜单正确渲染并在输出 `已退出 LFAA 菜单。` 后以 `BAT_EXIT=0` 正常返回原终端。
3. **说明**：双击独立窗口路径（`exit 88 -> cmd /k`）依据 `Win32_Process` 父进程与 `%cmdcmdline%` 检查逻辑设计，未从资源管理器人工双击实测；本轮未涉及 Web UI 改动，未启动内置浏览器。

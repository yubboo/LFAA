# UPDATE-000003｜修复 Windows 启动器闪退

- 时间（含时区）：2026-11-17 11:23 +08:00
- 类型：修复
- 关联开发日志：`../dev-log/000003-20261117-1123-powershell-encoding-fix.md`

## 用户能看到的变化

- 双击 `lfaa.bat` 后，Windows 菜单可以正常显示，不再因 PowerShell 解析错误立即关闭。
- 选择 Web 启动时，未配置应用入口会显示说明并返回菜单。

## 影响范围与使用提示

- 修正了 `scripts/lfaa.ps1` 的文件编码，兼容 Windows PowerShell 5.1。
- Web 应用本身尚未创建，因此当前只能打开菜单和安装依赖。

## 已知限制

- Web 启动仍需后续补充 CLI 应用入口和根 `lfaa` 命令。

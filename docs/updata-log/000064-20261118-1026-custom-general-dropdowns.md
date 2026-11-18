# Update Log 000064 — 优化「常规」设置全部下拉选择器外观与交互体验

- **编号**：000064
- **时间**：2026-11-18 10:26:15 +08:00
- **对应 Dev Log**：[000064-20261118-1026-custom-general-dropdowns.md](file:///e:/lfaa/docs/dev-log/000064-20261118-1026-custom-general-dropdowns.md)

---

## 体验优化

1. **统一自定义圆角深色弹出式菜单**
   - 移除系统原生 `<select>` 的生硬黑框样式，全页 10 个下拉项统一升级为圆角深色悬浮菜单，选中项带清晰勾选标识。
2. **补全图标、副标题说明与语言搜索**
   - **默认文件打开位置**：支持带图标展示的 `Antigravity`、`默认应用`、`File Explorer`、`VS Code`、`Cursor`。
   - **智能体环境**：展示「Windows 原生（直接在 Windows 中运行智能体）」「适用于 Linux 的 Windows 子系统（在 WSL 中运行智能体）」等带副标题选项。
   - **集成终端 Shell**：新增 `WSL` 选项（`PowerShell` / `Command Prompt` / `Git Bash` / `WSL`）。
   - **语言**：支持顶部「搜索语言」关键字即时过滤。

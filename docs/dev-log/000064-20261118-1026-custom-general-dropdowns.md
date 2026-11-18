# Dev Log 000064 — 将「常规」设置全部原生 `<select>` 升级为圆角深色弹出式菜单（支持图标、副标题与搜索过滤）

- **编号**：000064
- **时间**：2026-11-18 10:26:15 +08:00
- **任务名**：`custom-general-dropdowns`
- **状态**：已完成实现、单元测试、类型检查、构建与内置浏览器实测验收

---

## 1. 优化目标

替换浏览器原生丑陋的直角白边 `<select>` 下拉框，参考目标桌面设置风格，将「设置 → 常规」全页 **10 处下拉控件** 统一升级为自定义圆角深色弹出式选择器（`role="listbox"`）：

1. **触发器外观**：统一圆角胶囊触发器 + 细线向下箭头 `IconChevronDown`（支持前导图标如黄色 `File Explorer` 文件夹图标）。
2. **富选项弹出卡片**：圆角悬浮卡片、选中项右侧勾选 `IconCheck`、支持副标题描述（如 `智能体环境` 的「直接在 Windows 中运行智能体」「在 WSL 中运行智能体」）。
3. **搜索过滤与选项完善**：
   - `默认文件打开位置`：补充 `Antigravity`、`默认应用`、`File Explorer`、`VS Code`、`Cursor` 并配对应图标；
   - `集成终端 Shell`：补充 `WSL`（含 `PowerShell`、`Command Prompt`、`Git Bash`、`WSL`）；
   - `语言`：支持顶部 `搜索语言` 输入实时检索及多语言清单（`自动检测`、`简体中文`、`繁體中文（台灣/香港）`、`English`、`日本語`、`한국어`、`Français`、`Deutsch`、`Español`、`Português`、`Русский`）。

---

## 2. 实际变更清单

- 修改 [general-settings.ts](file:///e:/lfaa/packages/core/chat/src/general-settings.ts) 与 [general-settings-client.ts](file:///e:/lfaa/packages/core/chat/client/general-settings-client.ts)：为 `FileOpenerKind` 增加 `"antigravity"`、为 `IntegratedShellKind` 增加 `"wsl"`、扩展 `AppLanguagePref` 枚举并在 `writeLocaleOverride` 兼容 `zh-*` 与其他语言映射。
- 修改 [GeneralSettingsControls.tsx](file:///e:/lfaa/packages/core/chat/client/components/GeneralSettingsControls.tsx)（186 行）：重写 `SettingSelect` 为带外部点击/`Escape` 关闭、可搜索过滤、图标、副标题与无障碍 ARIA 属性的自定义圆角下拉菜单。
- 修改 [GeneralSettingsGeneralGroup.tsx](file:///e:/lfaa/packages/core/chat/client/components/GeneralSettingsGeneralGroup.tsx)（351 行，低于 400 行强约束阈值）与 [GeneralSettingsView.module.css](file:///e:/lfaa/packages/core/chat/client/components/GeneralSettingsView.module.css)（394 行，低于 400 行强约束阈值）：装配图标、副标题描述、WSL Shell 项及可搜索语言菜单并统一样式。

---

## 3. 验证记录

| 检查项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 全部单元测试 | `pnpm exec tsx --test packages/core/*/tests/*.ts packages/ui/*/tests/*.ts packages/workspace/*/tests/*.ts` | **36/36 通过**（`duration_ms 3412.3561`） |
| TypeScript 类型检查 | `pnpm run typecheck`（12 个 tsconfig） | **exit code 0** |
| Web 生产构建 | `pnpm run build`（`vite build`） | **exit code 0**（`✓ built in 1.57s`） |
| 内置浏览器实测 | `browser` 子代理访问 `http://127.0.0.1:5173/`（`1440x900`） | **通过**（控制台 error = 0，网络失败 = 0/50） |

- 实测核验：`page.locator('select').count() === 0`，10 处设置控件全部为自定义 `aria-haspopup="listbox"` 弹出器；逐一展开并验证了「默认文件打开位置」「智能体环境」「集成终端 Shell」「语言（含输入 `日` 过滤出 `日本語`）」4 组交互及回选，最终截图见 [final_step_18.png](file:///C:/Users/Administrator/.gemini/antigravity/brain/6802e411-f569-44da-8e24-b1a6955c35fb/browser_evidence/177d027c-c51a-4a1e-894a-de308b9644d4/final_step_18.png)。
- 后台 `pnpm lfaa web`（`task-1124`）保持在线服务于 `http://127.0.0.1:5173/`；未执行 `git commit` / `git push`。

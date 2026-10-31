# LFAA 集成终端 Shell 选择

<a id="lfaa-integrated-shell-choice-20261031"></a>

## 目标与 Owner

设置中心「常规」沿用现有 `general.integratedShell`，明确提供 Windows PowerShell 与命令提示符选项。用户选择应用于新建的交互式终端，以及本次调用未单独指定 Shell 的命令；按次明确指定 Shell 的命令继续以单次参数为准。已打开的终端不因偏好更新而切换进程。

- 设置合同、默认值、校验、账户持久化：`packages/util/values/src/settings-contract.ts`、`packages/settings/settings/src/validation.ts`、`packages/settings/settings/src/service.ts`。
- 偏好界面及显示标签：`packages/client/ui-settings/src/SettingsPage.tsx`、`packages/settings/settings/src/agent-settings.ts`。
- 交互 PTY 启动器：`packages/terminal/terminal-bash/src/index.ts`；Minecraft 与通用终端消费者按创建会话时的设置解析启动进程。
- Shell 命令 Owner：`packages/shell/tool-shell/src/index.ts`；省略 `shell` 时读取用户常规偏好，显式参数覆盖本次调用。

## 设置与数据边界

- 复用 `general.integratedShell`，默认 `system`；允许值仍为 `system | powershell | cmd | bash | zsh`。不新增字段、不改默认、不覆盖已有账户值。
- `general.taskFolder` 继续由普通集成终端读取作为工作目录；Minecraft 实例终端仍使用实例登记目录。
- 权限继续由 `settings.permissions.mode` 与 Permission Owner 决定，不改变命令授权、校验或节点路由。
- `system` 的平台默认解析保持原样。明确选择 Windows PowerShell 时使用原生 `powershell.exe` 且显示真实欢迎行；明确选择命令提示符时使用原生 `cmd.exe` 且显示真实启动行。PowerShell 禁用用户启动配置文件，但不禁用程序欢迎行。

## 验收条件

1. 常规设置清楚展示 Windows PowerShell 与命令提示符，并说明设置作用于新终端和未另选 Shell 的命令。
2. 选择值复用现有账户持久化，不重置当前用户偏好；按次 Shell 覆盖仍有效。
3. 新建交互会话的两项显式选择分别启动真实 Windows PowerShell / cmd，并显示系统实际输出的欢迎行，不拼接模拟文本。
4. 源码和包 README 记录共享设置、默认不变、终端新开生效与命令覆写规则；直接相关构建通过。
5. IAB 常规设置实页确认选项与当前保存值；不执行任何命令、不启停 Minecraft 实例。真实 PowerShell/cmd 进程欢迎行若未实际启动验证，必须明确记录为未测。

## 修改文件

- `E:/lfaa1/lfaa/docs/PROMPTS.md`：登记本轮 Shell 设置合同。
- `E:/lfaa1/lfaa/docs/development/integrated-shell-choice-20261031.md`：记录 Owner、设置边界和验收合同。
- `E:/lfaa1/lfaa/packages/client/ui-settings/src/SettingsPage.tsx`：明确常规设置选项和新会话生效说明，修正默认终端位置的过时说明。
- `E:/lfaa1/lfaa/packages/settings/settings/src/agent-settings.ts`：设置变更显示标签使用 Windows PowerShell。
- `E:/lfaa1/lfaa/packages/terminal/terminal-bash/src/index.ts`：显式 Windows PowerShell/cmd 会话显示各自真实启动欢迎行。
- `E:/lfaa1/lfaa/packages/settings/settings/README.md`：记录偏好默认、值域、持久化和按次覆盖规则。
- `E:/lfaa1/lfaa/packages/client/ui-settings/README.md`：说明常规设置对交互终端和命令的作用范围。
- `E:/lfaa1/lfaa/packages/client/ui-sidebar-terminal/README.md`：记录终端会话读取设置及不热切换行为。
- `E:/lfaa1/lfaa/packages/shell/tool-shell/README.md`：澄清命令显式/默认 Shell 规则并保留 system 默认原行为。
- `E:/lfaa1/lfaa/packages/terminal/terminal-bash/README.md`：记录真实 Shell 启动解析边界。
- `E:/lfaa1/lfaa/packages/terminal/tool-terminal/README.md`：记录交互式新会话读取账户 Shell 偏好以及已打开会话不热切换。

## 验收记录

完成源码与设置页验收。以下相关构建通过：`lfaa-client-ui-settings`、`lfaa-settings`、`lfaa-terminal-bash`、`lfaa-tool-shell`、`lfaa-tool-terminal`、`lfaa-web`；`node scripts/runtime-build-state.mjs web` 返回 `[]`。任务范围内 `git diff --check` 通过；全仓差异检查仍有与本任务无关、既存于 `packages/games/minecraft/src/core-sources.ts:121,123` 的空白问题。

ChatGPT 内置浏览器实际路由 `http://127.0.0.1:3000/settings?section=general`，视口约 878×850。常规页的集成终端 Shell 菜单实际展开，确认包含“Windows PowerShell”和“命令提示符”；同时观察到“系统默认”、Bash、Zsh 选项。随后按 Esc 收起菜单，当前保存值仍为“系统默认”，没有改动用户偏好。IAB 页面截图与可访问性树已核对。

未启动新的 PTY，也未实测 Windows PowerShell / 命令提示符进程欢迎行和交互输入；未执行用户命令、未操作 Minecraft 实例。上述 PTY 进程实测仍是单独的验收缺口，不能用构建及设置页验收代替。未运行自动化测试、真实设备及帧时间测量。

# project-foundation PLAN

## 状态

```text
deliverable
```

## 目的

建立 LFAA v0.0.1 开发基础。

## 范围

- 产品身份
- Monorepo
- 根目录当前规范
- 当前/历史架构隔离
- 命名规范
- 模块边界
- Plan/Progress
- Prompt
- Changelog
- Version
- Apps/Packages/Crates 骨架

## 验收

- AI 进入根目录可找到开发入口；
- 当前和历史架构物理隔离；
- 主模块与下一步明确；
- 骨架模块有 README；
- Rust workspace 可独立检查；
- Governance check 可执行。

## #16 横向加固范围

- LFAA 官方命名、作者署名、版权与第三方归属；
- 项目级 Skills / Experts / Plugins / Extensions / MCP；
- 性能、安全和质量门禁；
- 路径无关的依赖安装与开发检查菜单。

## #21.11 Web 工作台 Header 联动布局

### 任务原因

v0.0.42 的 #21.10 已把 Shell Actions 移到中间区域左右上角，但按钮仍通过 `position:absolute` 漂在正文层，和用户提供的 Codex 参考中“按钮属于顶部工作区 Header”的结构不一致。

### 本次范围

允许修改：

- `packages/app-shell/src/AgentWorkbench.tsx`；
- `packages/app-shell/src/agent-workbench.css`；
- #21 Active Prompt / Development Log / UI Layout / Web UI Test；
- Changelog / Release / 版本号。

禁止修改：

- Sync / GitHub / Setup / Update 业务逻辑；
- `ResizableWorkbench` 拖拽吸附算法；
- PTY 协议与 Vite node-pty bridge；
- Config / Agent Runtime / Permission / Rust Native 边界。

### 实施顺序

1. 保留 v0.0.42 为旧版本；
2. 把 #21.10 当前日志归档；
3. 新建 Center Header 与 Right Shell Header；
4. 右栏开合时迁移终端/右栏按钮归属；
5. 保留左栏 Hover Preview / 快捷键 / 三向吸附；
6. 同步 Prompt / Progress / Log / UI Standard / Changelog / Release；
7. 执行治理、语法、版本、ZIP、PowerShell BOM 门禁。

### 验收条件

- Shell Actions 不再使用正文 absolute 浮层；
- Center Header / Right Header 高度一致；
- 右栏展开与收起时按钮位置符合当前结构事实；
- Tooltip 与快捷键提示存在；
- v0.0.42 的 Sync / GitHub / Setup / Update 脚本字节不变；
- 旧 #21.10 有 Archive，新 #21.11 为 Active。

## #4.3 / #20.4 Windows 脚本编码与开发规范执行闭环

### 任务原因

v0.0.41 为 Windows PowerShell 脚本补中文结构化文件头时，保存过程把原本的 UTF-8 BOM 去掉，破坏了 Windows PowerShell 5.1 的脚本编码兼容性。这说明“代码可读性”规范与“可执行文件编码”规范之间缺少自动门禁。

### 本次范围

允许修改：

- `scripts/windows/*.ps1` 的编码，不改变原有业务行为；
- Windows 脚本编码治理检查；
- DEVELOPMENT / AGENTS / Standards / Development Log / Prompt / Progress / Changelog / Release；
- 版本号与发布包。

禁止修改：

- Web UI 交互；
- 同步算法语义；
- GitHub Push 流程；
- Setup / Update 的业务逻辑；
- Protocol / DB Schema / 安全执行边界。

### 实施顺序

1. 保留 v0.0.41 作为历史缺陷版本；
2. v0.0.42 从 v0.0.41 递增；
3. 恢复所有 Windows PowerShell 脚本 UTF-8 BOM；
4. 新增 `windows-script-encoding-check.mjs`；
5. 接入治理链路；
6. 更新 #4.3 与 #20.4 的当前/历史记录；
7. 做版本一致性、ZIP 根目录、中文路径、PowerShell BOM Round-trip 验证。

### 验收条件

- 4 个 `scripts/windows/*.ps1` 均以 `EF BB BF` 开头；
- 去掉 BOM 后的脚本文本与 v0.0.41 业务逻辑一致（除本次允许的说明性注释变更）；
- `governance:check` 会在 BOM 缺失时失败；
- v0.0.42 的 CHANGELOG / Release / Prompt / Development Log / Progress 完整；
- ZIP 内项目根无额外嵌套目录；
- ZIP 解压后 PowerShell BOM 仍保留。

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

## #21.15 容器响应式与布局变量化

### 任务原因

v0.0.46 使用固定 `280 / 360` 最小宽度与固定 `1240 / 760` viewport 断点。Windows 实机缩小浏览器后，左右栏仍会占用过多横向空间，中央区被挤窄；同时 TS 与 CSS 分别维护尺寸，后续维护容易漂移。

### 本次范围

允许修改：

- `packages/ui/src/workbench/workbench-layout.config.ts`（新增）；
- `packages/ui/src/workbench/workbench-layout.types.ts`；
- `packages/ui/src/workbench/ResizableWorkbench.tsx`；
- `packages/ui/src/workbench/workbench.css`；
- `packages/ui/src/index.ts`；
- `packages/app-shell/src/AgentWorkbench.tsx`；
- `packages/app-shell/src/agent-workbench.css`；
- UI 静态契约门禁；
- Prompt / Plan / Progress / Development Log / UI Standard / Test / Code Map / Changelog / Release。

禁止修改：

- Sync / GitHub / Setup / Update 业务逻辑；
- PTY bridge 与 node-pty 协议；
- Config / Agent Runtime / Permission / Rust Native 边界。

### 实施顺序

1. 保留 v0.0.46 为历史版本；
2. 归档 #21.14 Active Log / Prompt；
3. 新增单一布局变量与计算公式文件；
4. 使用 ResizeObserver 观察 Workbench 容器，而不是 window 固定断点；
5. 根据 left/right/center 实际需求自动选择 Desktop / Compact / Mobile；
6. Compact 右栏保持 Overlay、Mobile 双侧栏 Overlay；
7. 历史持久化 pane width 随当前容器重新 clamp；
8. CSS 改用变量 / rem / clamp / calc，删除旧固定 Drawer 尺寸；
9. 保持 min 吸附收起 + Pointer 不松手反向解锁语义；
10. 更新静态 UI 契约与全部当前事实源；
11. 执行治理、语法、版本、ZIP、PowerShell BOM 门禁。

### 验收条件

- App Shell 不存在固定 LEFT/RIGHT/BOTTOM_LIMITS；
- 响应式由容器宽高计算；
- 1024 左右宽度能保持可用中央区，不被 280/360 固定侧栏挤坏；
- 760~950 左右进入左 Dock + 右 Overlay；
- 更窄容器进入双 Overlay；
- 侧栏 min 明显小于 v0.0.46，但内容仍可读；
- 三向吸附不回退；
- Windows 脚本与 PTY 业务逻辑不变。

## #21.14 最小尺寸吸附收起语义修正

### 任务原因

v0.0.45 把 min 以下设计成“弹性压缩区”，导致面板仍然处于展开状态时可以被压得过窄，右栏文字和快捷键出现截断。用户明确要求：**到最小可用尺寸就应该吸附收起，而不是继续以更窄尺寸展开。**

### 本次范围

允许修改：

- `packages/app-shell/src/AgentWorkbench.tsx`；
- `packages/app-shell/src/agent-workbench.css`；
- `packages/ui/src/workbench/ResizableWorkbench.tsx`；
- `packages/ui/src/workbench/workbench.css`；
- UI 静态契约门禁；
- Prompt / Plan / Progress / Development Log / UI Standard / Test / Code Map / Changelog / Release。

禁止修改：

- Sync / GitHub / Setup / Update 业务逻辑；
- PTY bridge 与 node-pty 协议；
- Config / Agent Runtime / Permission / Rust Native 边界。

### 实施顺序

1. 保留 v0.0.45 为历史版本；
2. 归档 #21.13 Active Log 与 Prompt；
3. 删除 min 以下弹性展开算法；
4. 到 min 即进入 snap capture / 收起预览；
5. Pointer 不松手时保留反向恢复能力；
6. 提高左 / 右 / Bottom 可用最小尺寸；
7. 调整 Desktop / Compact 断点以容纳新 min；
8. 更新 UI 静态门禁；
9. 同步当前事实源与发布记录；
10. 执行治理、语法、版本、ZIP、PowerShell BOM 门禁。

### 验收条件

- 左栏 min 280、右栏 min 360、Bottom min 180；
- 展开态不得出现 min 以下尺寸；
- 到 min 即进入吸附收起预览；
- Pointer 不松手可反向拖过迟滞区，恢复到至少 min；
- Pointer Up 后正式 collapsed，separator 不能拖出；
- Desktop / Compact 断点为 1240 / 760；
- Windows 脚本和 PTY 业务逻辑不变。

## #21.13 Web 响应式与弹性吸附重构（历史）

### 任务原因

v0.0.44 在 Tooltip 单一来源上已修正，但用户 Windows 实机缩小浏览器后发现：右栏浮层仍可覆盖绝大多数主区、Header 控件在覆盖布局中不可见，且左右/底部吸附从 min 硬跳到 0，拖拽手感生硬。

### 本次范围

允许修改：

- `packages/app-shell/src/AgentWorkbench.tsx`；
- `packages/app-shell/src/agent-workbench.css`；
- `packages/ui/src/workbench/ResizableWorkbench.tsx`；
- `packages/ui/src/workbench/workbench.css`；
- UI 静态契约门禁；
- Prompt / Plan / Progress / Development Log / UI Standard / Test / Code Map / Changelog / Release。

禁止修改：

- Sync / GitHub / Setup / Update 业务逻辑；
- PTY bridge 与 node-pty 协议；
- Config / Agent Runtime / Permission / Rust Native 边界。

### 实施顺序

1. 保留 v0.0.44 为历史版本；
2. 归档 #21.12；
3. 增加 Desktop / Compact / Mobile LayoutMode；
4. Compact 右栏和 Mobile 双侧栏改为 Drawer；
5. 保证核心 Shell Actions 在小屏 Header 始终可见；
6. Tooltip 增加贴边方向；
7. 左 / 右 / 底部统一弹性磁区状态机；
8. Pointer 拖拽期间禁止 CSS transition；
9. 更新静态 UI 契约检查；
10. 同步所有当前事实源与发布记录；
11. 执行治理、语法、版本、ZIP、PowerShell BOM 门禁。

### 验收条件

- 1180 / 760 两个响应式断点有明确模式；
- Compact 右 Drawer 不超过 420px / 56vw 上限；
- Mobile 主区全宽，Header 核心入口可用；
- 三向拖拽按住时均可从 snap capture 反向拖回 min；
- Pointer Up 后正式 collapsed，separator 不能拖出；
- 拖拽时不启用 transition 追鼠标；
- Tooltip 不贴边裁切；
- Windows 脚本和 PTY 业务逻辑不变。

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

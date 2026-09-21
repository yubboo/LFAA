# LFAA UI Architecture — v0.1.6

## v0.1.6 三种交互模式

Chat Agent 与 Work Agent 的视觉/干预方式不同，但能力完全相同：Chat 是 conversation-first，运行中用户通过对话插话；Work 是 canvas-first，用户可直接修改无限画布节点并把画布上下文送回同一个 Agent Core。Manual 是第三种完全手动模式，不要求配置模型，复用 Work Canvas 与真实 Terminal/Tool 基础能力。

左侧导航、Center Header、Composer 和 Right Tool Surface 允许随模式改变**表现**；不得据此选择不同模型能力等级或复制 Agent Runtime。

AI Settings 的余额/额度卡仍只展示 Host 返回的官方 Usage Snapshot；认证、Runtime Ready 与 Usage/Quota 是独立状态，官方无指标时显示“官方未提供”。


UI 视觉和交互保持 v0.0.98 已验证行为，本版本主要改变代码 Owner，不重新设计 Workbench。

## 1. UI package hierarchy

```text
client-web
  ↓
app-shell
  ├─ workspace
  └─ ui

ui-terminal 由 client-web 组合进入需要的 Surface
```

### `@lfaa/ui`

共享 UI Kit / Interaction Engine：

- Resizable Workbench primitives
- Overlay / Dismissible Layer
- Controls / Slider
- Effects / Motion
- Extension registry seams
- Resize / Shortcuts
- Infinite Canvas renderer/interaction primitive

不拥有账户、Plugin、Workspace Session、Agent Run 真值。

### `@lfaa/workspace`

产品 Workspace：

```text
Workspace
├─ Chat Agent Mode
├─ Work Agent Mode
└─ Manual Mode
```

Chat 与 Work 共用 Session/Run controller 与干预入口。Work 保存 Canvas 布局/可编辑内容并投影 `workspaceContext`；Manual 复用 Canvas 但不启动 Agent Run；Canvas pointer engine 仍属于 UI Kit。

### `@lfaa/app-shell`

产品 Shell：

- 三栏 Workbench；
- Header；
- Composer；
- Runtime controls；
- Settings；
- User/Shell menu；
- Left/Right region product composition。

### `@lfaa/client-web`

只做 Web Client composition / React mount / Host 实例注入；不拥有具体视觉模块。

## 2. Settings

Settings 导航/产品 Surface 归 App Shell。AI 设置表单视图继续位于 UI feature 目录并只消费 Props/Host contract，不直接读 Config/Secret 文件。

Plugin 管理视图通过 Browser Host client 调 Plugin Controller。

## 3. Motion / resize / snap

v0.1.1 不改变已有 animation/snap/resize 阻尼、触发阈值和模型菜单体验。架构迁移不能因为移动文件而重置已调好的参数。

可复用交互参数继续集中到已有 config/token/logic Owner，不在 View 内复制 magic numbers。

## 4. Terminal UI

`packages/client/ui-terminal` 拥有 xterm view/style/event types，只发送/接收 terminal 自定义事件，不 import node-pty。

## 5. CSS namespace

`.lfaa-*` CSS class 是产品 CSS namespace，**不是**已删除的 `.lfaa/` 文件系统目录。不要因为 Runtime Home 重构批量重命名 CSS selector。

## 6. 新 UI 的归属判断

- 通用 primitive → `client/ui`
- Chat/Work 产品内容 → `client/workspace`
- Shell/Settings/Composer 产品装配 → `client/app-shell`
- Web mount/Host injection → `client/web`
- 某独立 Web-only feature 只有在有真实边界时才新增 package


## v0.1.2 Chat 流式消息

Workspace Session Controller 现在接收 `assistant.delta`，同一个 `runId` 始终更新同一条 assistant message；`assistant.completed` 到达后用最终权威文本覆盖。这样 Codex App Server 的流式文本不会生成重复气泡。

当前 Composer 的权限 Profile UI 不等于 Codex 写权限：在正式审批 UI 接入前，Codex Text Runtime 强制 read-only。UI 不得显示“已获得写权限”这类与真实 Runtime 不一致的状态。

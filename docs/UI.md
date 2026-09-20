# LFAA UI Architecture — v0.1.0

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
├─ Chat Mode
└─ Work Mode
```

Chat 与 Work 共用 Session/Run controller。Work 保存 Canvas 的产品布局状态；Canvas pointer engine 仍属于 UI Kit。

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

v0.1.0 不改变已有 animation/snap/resize 阻尼、触发阈值和模型菜单体验。架构迁移不能因为移动文件而重置已调好的参数。

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

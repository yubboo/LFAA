# 架构基线

## 已确定

- 项目名：`lfaa`；内部包作用域：`@lfaa`。
- 项目时区：`Asia/Shanghai`。
- 技术方向：TypeScript、React、CSS Modules、pnpm Monorepo、Cordis 插件机制。
- 首个可运行应用：Web；Vite 负责开发服务器和静态构建，`apps/cli` 统一分发 `pnpm lfaa web`。
- 第二个运行形态：**桌面端（Electron 45）**；`apps/desktop` 只做窗口/菜单/生命周期，`apps/desktop-host` 作为独立 Node 子进程运行 `@lfaa/web-server` 的生产宿主（静态托管 + `/api`），壳通过 IPC 拿到地址后加载窗口；与 Web 共用同一套 UI 与 Host，详见 [desktop.md](desktop.md)。
- Cordis 版本基线：`@deepseek-ai/cordis` 4.1.x；React 19.3.x；Vite 8.3.x。
- 包所有权：`packages/<group>/<package>`；业务包的浏览器 UI（如有）放在同包 `client/`。
- 依赖方向：应用负责启动与装配；Host 领域代码不依赖 React/DOM；Client 通过公开 contract、RPC 或事件与 Host 交互。
- 统一桌面 Shell 由共享 UI 布局包持有；具体插槽契约须在实现功能区前单独定义。

## 后续纵切片前确认

- Node 与 pnpm 的团队支持范围；当前环境 Node 24.15.0、pnpm 11.17.0。
- Host / Client 自动化测试工具；加入业务插件时再确认测试策略。

## 当前 Web 布局与插件化决策（2026-11-17 更新）

负责人明确采用**四栏可折叠布局**：左侧图标菜单（`primary-navigation`）、二级功能菜单（`section-navigation`，支持展开/收起）、中央工作区（`workspace`）、右侧上下文菜单栏（`context-panel`，支持展开/收起）。

按包级单一职责与 Host/Client 分离原则，核心能力拆分为独立工作区包并通过 Cordis 装配：
- `@lfaa/ui-layout`（`packages/ui/layout`）：纯粹的四栏/三栏骨架、通用列表原语（含拖拽）、右侧上下文容器与 `workbench` 注册服务；不再持有主题表单或项目业务弹窗。
- `@lfaa/ui-theme`（`packages/ui/theme`）：主题预设、强调色、液态玻璃/字体 CSS 变量实时注入与“外观”设置页面插件。
- `@lfaa/ui-icons`（`packages/ui/icons`）：共享彩色文件/文件夹类型图标与扩展名映射，供文件树、标签栏、面包屑与变更列表复用；字形取自 MIT 的 vscode-icons。
- `@lfaa/sections`（`packages/workspace/sections`）：用户自定义分区 Host 服务（`~/.lfaa/sections.json`）及新建/重命名/删除 UI 插件。
- `@lfaa/workspace`（`packages/workspace/workspace`）：本地项目 CRUD（`~/.lfaa/projects.json`，重名拦截）、多源目录检视、项目悬停信息卡与操作菜单、`system-paths` 原生系统调用。

“最近”分组严格预留给聊天会话；因聊天、Agent 与远端连接服务尚未接入，相关入口如实提示未接入，不展示伪造的账户额度、插件目录、会话记录或远端数据。

# #21 Web 工作台 UI

## 主模块

`project-foundation / app-shell`

## 任务目标

先实现可通过 Vite 本地启动的三栏工作台 UI，作为后续 Config UI、Agent UI 和 `.lfaa` 热插拔验证壳。

## 视觉要求

- ChatGPT 类左右菜单 + 中间工作区；
- 水墨 / 宣纸风格；
- 左右栏自由拉伸；
- 拖拽到阈值吸附收起；
- 双击分隔条收起 / 展开；
- 布局缩放时中央工作区不乱；
- 窄窗口转为浮层侧栏。

## 允许修改

- `packages/ui`
- `packages/app-shell`
- `apps/web`
- Web/Vite 相关 package 配置
- UI 规范、Prompt、Plan、Progress、Development Log、CHANGELOG
- Setup 本地依赖安装语义，如为 Vite 开发依赖首次安装所必需

## 禁止修改

- Agent Loop
- Tool Runtime
- Permission Engine
- Rust Broker
- Config Storage
- Secret Store
- Knowledge
- Plugin Runtime 正式实现

## 状态所有权

- 侧栏宽度 / 收起状态：UI 本地状态，可持久化到浏览器 `localStorage`；
- `.lfaa` 资源列表：Vite 开发桥接的只读快照，不是正式 Runtime 状态；
- 正式资源状态 Owner 未来仍属于 Resource Registry。

## 本地热插拔测试

Vite 开发服务器监听当前项目：

```text
.lfaa/skills
.lfaa/experts
.lfaa/plugins
.lfaa/extensions
.lfaa/mcp
```

变化后通过 Vite HMR 自定义事件通知浏览器刷新资源列表。

禁止暴露资源正文和 Secret。

## 性能预算

- 侧栏 Pointer Move 使用 `requestAnimationFrame` 合并；
- 拖拽目标 60 FPS；
- 桌面宽度下不得产生整页横向滚动；
- 收起动画 200ms 左右；
- Vite 资源刷新只扫描 `.lfaa` 允许目录的直接子项。

## 验收条件

- Vite Web 启动入口存在；
- `LFAA-Setup.bat → 2 启动 Web` 可一键启动本地 Vite；
- 三栏布局完成；
- 左右栏可拉伸、吸附、收起；
- 中间工作区稳定；
- 水墨风格完成；
- `.lfaa` 本地资源变化能触发 Web 列表刷新；
- Web 开发桥接绑定 `127.0.0.1`；
- Setup workspace 依赖统计不得递归扫描 `node_modules`；
- 不读取 Secret；
- 文档与日志同步。

## 当前状态

`in-progress`


## 统一启动入口

Windows 本地开发只保留一个主入口：

```text
LFAA-Setup.bat
```

其中：

```text
2 → 启动 Web / Vite
3 → 启动 Desktop / Electron
4 → 构建 Web
5 → 构建 Desktop
6 → 构建并生成两端本地发布产物
```

禁止重新创建独立 `LFAA-Web.bat`。

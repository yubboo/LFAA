# #21 Web 工作台 UI

## 主模块

`project-foundation / app-shell`

## 任务目标

实现可通过 Vite 本地启动、可供 Web / Desktop 复用的三栏工作台 UI，作为 Config UI、Agent UI 和 `.lfaa` 热插拔验证壳。

## 视觉要求

- 参考 Codex / ChatGPT 的桌面生产力工具布局；
- 不复制品牌标识，只采用简洁的黑 / 白 / 灰视觉语言；
- 支持浅色和深色；
- 左侧为导航、项目、会话；
- 中间为主要工作区 / 对话；
- 右侧为工具、运行状态和项目资源；
- 高信息密度，但避免装饰性背景和拟物纹理。

## 布局要求

- 左右栏自由拉伸；
- 左栏默认 288px，范围 240px - 640px；
- 右栏默认 360px，范围 300px - 760px；
- 桌面宽度下动态限制左右栏最大值，中央区至少保留约 520px；
- 正常拖动范围从 max 到 min；
- 一旦拖到该侧栏 min，立即自动吸附到 collapsed；
- 不等待 Pointer Up；
- 反向拖回超过 min + 24px 后重新展开，避免边界抖动；
- 双击分隔条收起 / 展开；
- 键盘可调整；
- 状态保存到 `localStorage`；
- 窄窗口侧栏转浮层，不产生整页横向滚动。

## 允许修改

- `packages/ui`
- `packages/app-shell`
- `apps/web`
- Web/Vite 相关 package 配置
- UI 规范、Prompt、Progress、Development Log、CHANGELOG

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

- 侧栏宽度 / 收起状态：UI 本地状态；
- 主题偏好：UI 本地状态；
- `.lfaa` 资源列表：Vite 开发桥接只读快照；
- 正式资源状态 Owner 未来仍属于 Resource Registry。

## 本地热插拔测试

Vite 开发服务器监听：

```text
.lfaa/skills
.lfaa/experts
.lfaa/plugins
.lfaa/extensions
.lfaa/mcp
```

只允许把资源元数据暴露给浏览器，不读取资源正文和 Secret。

## 性能预算

- Pointer Move 使用 `requestAnimationFrame` 合并；
- 拖动期间不通过 React 每帧 setState 重绘整个工作台；
- 拖拽目标 60 FPS；
- 自动吸附动画约 150ms - 180ms；
- 桌面模式中央工作区不得被左右栏挤到不可用；
- 不产生整页横向滚动。

## 验收条件

- `LFAA-Setup.bat → 2` 可启动 Vite；
- 黑白灰浅色 / 深色主题完成；
- 水墨视觉完全移除；
- 三栏布局完成；
- 左右栏可拉伸、最大宽度受控；
- 到达最小宽度立即自动吸附，吸附动画无明显跳变；
- 中央工作区稳定；
- `.lfaa` 本地资源变化能触发 Web 列表刷新；
- Web 开发桥接绑定 `127.0.0.1`；
- 不读取 Secret；
- 文档与日志同步。

## 当前状态

`in-progress`

## 统一启动入口

```text
LFAA-Setup.bat
→ 2 启动 Web
```

禁止重新创建独立 `LFAA-Web.bat`。


## Web 开发端口策略

```text
优先复用已经运行的 LFAA Vite
→ 否则从 5173-5199 选择首个空闲端口
→ 不结束未知进程
```

Vite 实际端口必须由 Setup 明确传入，终端显示地址必须与真实监听端口一致。

# LFAA AI 员工办公室

<a id="lfaa-ai-employee-office-20261026"></a>

## 目标、Owner 与设置

- 用户要求提供一个图形化的 LFAA AI 员工办公室，能看到各 Agent 当前正在处理什么工作，并与 Minecraft 应用维护员工共同交付。
- 运行入口：Web/Desktop 共用 Client 的 `/agent-office`，由 Workbench 提供主导航；页面进入时显示已登记专家待命状态和当前账户实时 Agent Run，包含主 Agent 与通过现有 Agent Loop 委派的子 Agent。
- 数据 Owner：`packages/core/agent-loop` 持有当前进程真实运行快照及父子关系；Agent 扩展目录提供可用员工元数据；`packages/api/session-controller` 通过认证账户查询只读工作视图；Client API 与 `packages/client/ui-workspace` 负责类型适配和呈现。
- 设置：沿用全局 Appearance 的主题、字体、字号、对比度、壁纸/遮罩/模糊与减少动态效果；权限和子任务本身沿用 `permissions.mode` 与 `aiRuntime` 预算。无新增设置，不修改用户偏好或真实任务。

## 修改边界与可观察条件

- 办公室展示真实登记的专家名称/简介、主 Agent、当前 Run 状态、任务标题、最近三项可公开活动及父子层级；活动外部驱动任务由 Subagent Manager 提供，进程内协作从 Agent Loop 显示且不会重复计数。没有运行任务时显示员工待命和明确空状态。不从卡片动画、模型自述或静态假数据推导工作状态。
- 只返回当前认证账户的有界运行摘要和扩展元数据；不返回模型隐藏推理、工具原始参数、凭据、跨账户 Session 或未授权操作入口。办公室只观察，不执行/取消任务。
- 可见运行快照基于当前 Agent Loop；宿主进程重启后未完成 Run 沿现有恢复合同显示中断，不自动重放。办公室不伪造跨重启的活动进度。
- 多 Agent 子任务使用父 Run 已有委派链、工具范围、取消和设置预算；登记员工本身不运行、不消耗模型请求。父子 ID 由 Agent Loop/委派上下文生成，模型不可伪造。
- 桌面、平板、窄栏和短屏都可查看员工卡片与最近活动；使用已有主题/Appearance，键盘可达，减少动态效果生效。前后台请求不重叠，页面隐藏时暂停只读刷新，卸载时清理请求和监听器。

## 验收批次

1. 后端/Client 查询合同：为当前账户返回专家摘要和当前 Agent Runs；给子 Run 加真实员工标签与父 Run 关联。运行 API/Agent Loop 直接回归、类型检查及相关包构建；真实账户数据不修改。
2. 办公室页面：加入 `/agent-office` 导航和响应式员工工作台，使用真实 API 状态展示“工作中/待命/完成/中断”等信息；完成该批后立即运行直接相关检查并用当前源码正式 Web 在 ChatGPT 内置浏览器验收，再进入最终核对。

## 验收边界

- 内置浏览器实测实际路由、交互、桌面与窄分栏/短屏容器并提供页面证据；检查账户 Appearance 设置实际沿用。Web/Desktop 共享 Client 的实页验收不可由构建或静态截图替代。
- 不触发模型请求、运行服务器任务、启动/取消 Agent、改设置、部署、重启现有服务或操作当前暂停会话作为验收。
- 真实 Provider 下的长任务、多 Agent 并行任务、其他登录账户及 Electron 桌面帧时间分别列为未测，除非本轮实际执行。

### 实施与验收

后端/连接/UI：已新增认证只读 `/ai/office`，包含账户隔离的 Agent Loop Run、已登记专家元数据和 Manager 中活动外部驱动任务；进程内 Manager 记录不重复计数。Agent Loop 子 Run 记录真实标签、员工 ID、父 Run 和暂停状态，专家名来自实际加载的扩展，通用委派标签来自已验证 `description`。WorkBench 新增 `/agent-office` 懒加载路由，全局导航可达；页面使用当前账户 Appearance，在容器窄分栏与短屏内滚动显示真实办公室工位。5 秒可见性轮询最多一个请求，隐藏/卸载会取消请求；没有新增设置。

直接回归：`harness-agent-api.test.mjs`、`subagent-background.test.mjs` 和 `client-workbench-responsive.test.mjs` 共 32/32 通过；办公室结构回归同时断言懒加载页注册。TypeScript Client 检查、`ui-workspace` 包构建、Web 构建通过；当时 `runtime-build-state.mjs web` 返回 `[]`。首次实页验收发现懒加载的 `AgentOfficePage.js` 没有登记到 `ui-workspace/src/client/index.ts`，所以页面无法显示；补齐注册并重建后 `/agent-office` 正常显示。

正式 Web 实页：使用当前源码命令启动 `http://127.0.0.1:3100/agent-office`，与原有 3000 服务隔离；账户数据位于系统临时目录的独立 `LFAA_HOME`/`LFAA_DATA_DIR`。ChatGPT 内置浏览器桌面 `1440×900` 能看见 11 名已登记员工，工位三列且无页面横向溢出；短屏窄分栏 `780×560` 可滚动查看全部工位，容器内无横向溢出；手机 `390×560` 下统计信息双列、工位单列、名称区收窄，页面宽度 390px 且无横向溢出。手动刷新能更新真实读取时间。当前临时账户未配置 Provider，实页显示真实的 0 项活动任务和待命状态；真实活动 Run/活动白名单由 API 回归覆盖，实际 Provider 活动在浏览器里的运行态展示尚未测试。界面沿用当前 Appearance（本次显示深色主题）、`general.showServiceStatus` 和全局权限模式；未新增或修改设置。

缺陷与边界：修复前浏览器还记录了首次缺失模块注册错误；修复后的办公室路由没有新增前端异常。隔离账户首次打开 `/work` 时另外记录到 DSH UI `startsWith` 与 `ApplicationWorkspace` `toLocaleLowerCase` 两类运行时错误，来自工作台初始化路径，不阻止办公室页面显示，且不是本轮修改范围，仍待独立排查。Office 每 5 秒至多串行发起一次有界只读请求；页面隐藏/卸载时会取消请求。未做帧时间测量，未在真实 Provider、并行子 Agent、其他账户、Electron 或物理设备上验收。最终复核期间，另一个工作区改动更新了 `packages/client/ui-workspace/src/CanvasWorkspace.tsx`；随后的 Web 构建被该文件第 1462 行起的 JSX/TS 语法错误阻断，`runtime-build-state.mjs web` 当前返回 `["web"]`。办公室所需的上一次成功 Web 产物时间为 2026-10-26 07:19:40 UTC，且在该产物上完成上述内置浏览器验收；当前整个 checkout 的 Web 产物需待该 Canvas 文件修复后重新构建。`check:workspace` 仍受既有缺图 `left-preview-hover-flicker-20261025.md` 两项与 `docs/PROMPTS.md` 两个过期锚点引用阻断。

### 2026-10-26 再次出现模块未装配提示

- 用户截图再次显示 `浏览器模块未装配：lfaa-client-ui-workspace/src/AgentOfficePage.js`。本轮检查确认源码注册仍在 `packages/client/ui-workspace/src/client/index.ts`，正式入口在 `packages/client/web/src/main.tsx` 导入并于 `mountClient` 前应用 `ui_workspace`；回归现增加正式入口装配顺序断言。
- 本轮此前一次成功的 `build:web` 入口 bundle 含该 ID 的注册回调，延迟页面 chunk `AgentOfficePage-BGvy4MD7.js` 存在且列入 Vite 预加载依赖映射。该成功构建后 Client 源码又发生变化；当前源码保留登记，最新 Web 整体构建状态需在源码可编译后重建。
- 当前 `127.0.0.1:3000/api/health` 返回 200，而页面入口返回 503 重启保护响应。先前用户明确拒绝会将默认工作区路径仅大小写不同的规范化值写回账户数据，因此本轮没有重载或重启该真实服务。旧页面中的未装配错误尚未在最新安全运行实例上复验，不记录为已修复；待启动隔离数据实例或先解决该默认路径无变化写回问题后再做实页验收。

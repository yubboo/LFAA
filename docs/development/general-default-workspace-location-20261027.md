# LFAA-GENERAL-DEFAULT-WORKSPACE-LOCATION-20261027

<a id="lfaa-general-default-workspace-location-20261027"></a>

## 用户目标与边界

在“常规”页展示 Codex“项目外聊天文件夹”对应的 LFAA 位置：Workspace Owner 当前登记的默认工作区路径。没有从具体项目发起的新聊天默认归入该工作区；明确从项目发起的聊天继续归入该项目。聊天事件和消息仍由 Session Owner 写入 LFAA Home 下的 `.lfaa/sessions`，本任务不改变该目录、数据格式或既有会话归属，也不迁移历史文件。

“项目外聊天文件夹”展示仍只读，不增加第二份聊天路径设置、不调用初始化或写入 API。`general.taskFolder` 移至“环境”页：留空时，本机未绑定项目的文件操作继承 Workspace Owner 已登记的默认工作区；用户填写的自定义值优先。远端节点终端仍以节点登记目录为根，空设置不传入控制端本机路径。通知控件只由“通知”页展示，不在“常规”重复出现。

## Owner、设置及数据流

- 默认工作区 ID、项目及路径：Workspace Owner；Client 通过 `loadWorkspaceProjects({ appId: "workspace" })` 读取只读列表和 `defaultProjectId`，服务端文件工具通过 `getDefaultWorkspaceProjectPath(userId)` 读取同一已登记路径。
- 新会话默认项目选择：AI Work 按显式项目上下文优先、否则取默认工作区项目；见 `packages/client/ui-chat/src/AiWorkChat.tsx` 及默认项目任务合同。
- 会话事件与消息：Session Owner 按 LFAA Home 写入 `.lfaa/sessions` JSONL；工作区路径不是会话数据根目录。
- 本任务不新增设置中心字段，不更改 Settings Owner schema、默认值或持久化；空 `general.taskFolder` 在本机无项目文件操作中按 Workspace Owner 路径生效，非空自定义值覆盖。常规与环境页直接显示 Workspace Owner 权威数据。
- 验收：设置页不显示虚构/空白路径；实际默认工作区路径正确；加载错误可重试；点击入口抵达 `/work`；既有 `.lfaa` 会话根与会话归属不变。

## Codex 常规参考功能审计

按当前实现记录，不把同名设置控件视为已接通：

| 功能 | 当前状态 | 依据/边界 |
|---|---|---|
| 项目外聊天文件夹 | 本任务补齐展示 | 展示 Workspace Owner 的默认工作区；不是 `.lfaa` 会话存储目录。 |
| 默认任务文件夹 | 保留设置，移至“环境”页 | `general.taskFolder` 有值时作为自定义覆盖；为空时本机无项目文件操作及 AI Work 默认目录选择继承 Workspace Owner 路径。节点终端只使用节点数据目录根。不是聊天归属或会话存储路径。 |
| 默认文件打开位置 | 部分实现 | Settings Owner 有 `general.fileOpenLocation` 持久化控件，但当前没有执行侧消费者。 |
| 智能体环境 | 已有配置、未接运行时 | `general.agentEnvironment` 已持久化，UI 已注明节点运行能力接入后生效。 |
| 集成终端 Shell | 已接通 | `general.integratedShell` 被 Terminal 与 Shell 工具读取。 |
| 语言 | 部分实现 | `general.language` 已保存；当前界面仍仅完整提供简体中文，语音/Workbench 部分路径使用 locale。 |
| 关闭窗口前确认 | 未实现 | 未找到此偏好控件或窗口关闭确认消费者。 |
| 默认使用完整视图 | 仅保存偏好 | 字段已保存，未找到工作区创建/路由读取消费者；当前工作区本身已采用完整视图。 |
| 登录时启动 | 未实现 | 未找到登录启动控件或桌面启动配置。 |
| 底部面板 | 已接通 | `general.showBottomPanelControl` 控制工作区标题栏面板入口。 |
| 默认终端位置 | 部分实现 | `general.terminalPosition` 控制真实任务输出面板底部/右侧位置；没有 Codex 式交互终端标签合同。 |
| 自动归档不活跃的聊天 | 未实现 | 有手动归档，无不活跃定时归档设置或消费者。 |
| 压缩本地保存的聊天历史记录 | 未实现 | `aiRuntime.autoCompaction` 只压缩送入模型的较早上下文，不压缩磁盘历史。 |
| 速度 | 已接通，位于“AI 与模型” | `aiRuntime.speed` 被模型请求路径读取；不在“常规”页。 |
| 首页建议 | 部分实现，位于“AI 与模型” | `aiRuntime.promptSuggestions` 控制欢迎示例提示；未搜索项目文件/连接应用来推荐下一步。 |
| 打开源许可证 | 部分实现 | 有查看弹窗，目前清单不覆盖完整捆绑依赖声明。 |
| 插件 | 已有账户 AI 扩展总开关，位于“插件” | `plugins.enabled` 生效于账户 AI 扩展；不等于所有 Profile 插件统一开关。 |
| 纯文本编辑器 | 仅保存偏好 | `general.plainTextEditor` 有控件/持久化，写作编辑器暂无运行时消费者。 |
| 显示上下文窗口使用情况 | 已接通，位于“AI 与模型” | `aiRuntime.showContextUsage` 控制聊天输入区与侧聊的上下文显示。 |
| 发送快捷键 | 已接通 | `general.sendShortcut` 控制 Enter 发送或换行。 |
| 跟进处理方式 | 已接通 | `general.followupBehavior` 控制运行中消息排队或引导当前运行。 |
| 弹出窗口快捷键 | 仅保存配置 | `general.popupShortcut` 可编辑并持久化，未找到全局快捷键注册消费者。 |
| 默认使用独立聊天 | 兼容字段、当前无效 | `general.defaultStandaloneChat` 继续读写以兼容账户数据；统一 `/work` 路由不再由此字段决定。 |
| 轮次完成通知 | 已接通，入口仅在“通知”页 | `general.completionNotification` 控制始终/未聚焦时/关闭，AI Work 会按状态投递提醒；“常规”不重复展示通知组。 |
| 权限通知 | 已接通 | `general.permissionNotifications` 控制后台权限请求提醒，不会隐藏会话内审批卡。 |
| 问题通知 | 已接通 | `general.questionNotifications` 控制后台澄清问题提醒，不会隐藏会话内问题卡。 |
| Dot 通知 | 未实现 | 未找到 Dot 消息来源、通知分类设置或投递消费者。 |
| 通知提示音 | 已接通 | `general.notificationSound` 控制完成、审批、澄清和会话错误提示音；浏览器/系统仍可限制播放。 |
| 通知总开关与会话错误提醒 | 已接通 | `general.notificationPopupsEnabled` 是总开关；LFAA 另有 `general.sessionIssueNotifications`。 |
| 趣味实验 | 仅保存配置 | `general.confettiEnabled` 有开关，未找到运行时消费者。 |

截图对应项中其他已存在的工作区布局、卡片/弹窗动效和减少动态效果属于 LFAA 增加项，不作为 Codex 对照功能缺失处理。

## 实现与验证记录

| 批次 | 改动/检查 | 结果 |
|---|---|---|
| B1 | 设置页新增只读“项目外聊天文件夹”，读取 Workspace Owner 返回的默认工作区 ID/路径；读取失败可重试，入口前往 `/work`。任务文件夹说明明确区分两种用途。 | 已完成。项目外新聊天默认归属仍由 AI Work 既有 `defaultWorkspaceProjectId` 逻辑保证；会话日志继续保存在 `.lfaa/sessions`，不迁移历史会话。 |
| B2 | 验证数据、构建与实页 | `apps/cli/tests/client-workspace-default-project.test.mjs` 3/3 通过；Settings 包构建通过；`pnpm run build:web` 通过（Vite 3891 modules）。内置浏览器 `/settings?section=general` 桌面 1423×1244 与窄屏 390×640 均显示 `D:\Documents\lfaa\default-workspace`；窄屏路径省略并保留管理按钮，无横向溢出；点击按钮到 `/work`，回到设置并重新加载后未出现旧构建警告。浏览器视口重置为原值。重启期间 Workbench 自动调用默认工作区初始化接口两次（200）；该初始化对现有 `default-workspace` 使用递归确保目录存在，没有保存设置、创建会话或移动会话数据。 |
| B3 | 根据用户指出的重复项复核设置入口：从“常规”移除通知组；将 `general.taskFolder` 控件移到“环境”页，保留原设置与持久化；通知设置只在通知页出现。 | 源码与页面验收已完成；本轮复验结果记于 B4。 |
| B4 | 用户指出“默认任务文件夹”仍显示尚未设置。空设置读取 Workspace Owner 已登记默认工作区作为本机无项目文件操作的有效路径，并在环境页展示此继承路径；自定义 `general.taskFolder` 继续优先，节点终端不接收控制端本机路径。AI Work 项目选择器的默认目录也回退到默认工作区。 | 已完成。Workspace、Tools、Settings 包、Web、Control Plane 构建通过；Web 构建包含 Client TypeScript 检查。`apps/cli/tests/agent-local-workspace.test.mjs` 3/3 通过，覆盖空值继承路径、自定义覆盖、本地信任根及不派发远端节点。最终文案变更后 Settings 包/Web 重建通过；`runtime-build-state.mjs web` 返回 `[]`。端口 3000 按用户此前授权重启，当前 checkout 服务 `/api/health` 与 `/settings?section=environment` 均返回 200。ChatGPT 内置浏览器实显 `D:\Documents\lfaa\default-workspace`，描述明确写出“当前使用默认工作区”；桌面 1423×1244 与窄屏 390×640 已核对，窄屏无横向溢出；路径编辑说明显示继承路径，取消弹窗后设置未改变。常规页仍展示同一默认工作区，通知控件只在通知页。截图/浏览器 AX 已留证；当前 IAB 留在环境页。 |

设置中心配置：未新增设置项，也未改 `general.taskFolder` 的默认值、字段校验或持久化；空值时页面显示并使用 Workspace Owner 当前登记的默认工作区，用户填写的自定义值优先。默认工作区只保留一处权威路径，变更后继承值同步更新。通知仍使用原有 `general` 通知偏好，控件仅在通知页。项目外聊天归入默认工作区，消息/事件继续由 Session Owner 写入 LFAA Home 下 `.lfaa/sessions`。

浏览器验收没有更改账户偏好，也没有保存路径编辑。默认工作区未初始化与 API 失败重试分支未在浏览器人为触发；审计表其他条目依据当前源码、Owner 合同与现有设置映射核对，未逐项执行完整端到端验收。构建仅写根 `dist/`。源码/构建通过不代表实际浏览器通过。

## 改动文件

- `E:\lfaa1\lfaa\packages\client\ui-settings\src\SettingsPage.tsx`：读取并呈现默认工作区路径、错误/重试状态和工作台管理入口。
- `E:\lfaa1\lfaa\packages\client\ui-settings\README.md`：记录默认工作区归属与 `.lfaa/sessions` 持久化路径的 Owner 边界。
- `E:\lfaa1\lfaa\packages\client\ui-chat\src\AiWorkChat.tsx`：空自定义目录时，项目目录选择器使用默认工作区路径。
- `E:\lfaa1\lfaa\packages\client\ui-chat\README.md`：记录新会话默认工作区及本机目录继承说明。
- `E:\lfaa1\lfaa\packages\core\tools\src\project-tools.ts`：本机未绑定项目时使用自定义任务目录或 Workspace Owner 默认路径。
- `E:\lfaa1\lfaa\packages\core\tools\package.json`：声明默认工作区查询所需 Workspace 包依赖。
- `E:\lfaa1\lfaa\packages\core\tools\README.md`：记录默认路径 Owner、节点路径边界及文件操作行为。
- `E:\lfaa1\lfaa\packages\workspace\workspace\src\index.ts`：提供已登记默认工作区路径的只读查询。
- `E:\lfaa1\lfaa\packages\workspace\workspace\README.md`：记录只读查询合同。
- `E:\lfaa1\lfaa\packages\util\values\src\settings-menu-catalog.ts`：同步环境设置入口的继承说明。
- `E:\lfaa1\lfaa\packages\util\values\README.md`：记录菜单描述与设置语义。
- `E:\lfaa1\lfaa\apps\cli\tests\agent-local-workspace.test.mjs`：持久回归覆盖默认路径继承与覆盖边界。
- `E:\lfaa1\lfaa\pnpm-lock.yaml`：登记 Tools 对 Workspace 包的工作区依赖。
- `E:\lfaa1\lfaa\docs\PROMPTS.md`：登记任务完成状态和验收摘要。
- `E:\lfaa1\lfaa\docs\development\general-default-workspace-location-20261027.md`：记录任务合同、参考功能审计和验收证据。

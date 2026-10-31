# Minecraft 实例内部的 Java 环境右侧栏

<a id="lfaa-minecraft-instance-java-runtime-right-sidebar-20261031"></a>

## 用户目标与可观察结果

- 进入指定 Minecraft 实例后，在工作区最右侧菜单显示该实例的 Java 环境信息；实例列表和未选中实例的通用页面不显示实例专属内容。
- 已固定 Java 运行时 ID 时，只显示节点真实上报且与该 ID 匹配的版本、发行商、来源、架构、系统与可执行路径；接口未返回的字段不造值。
- 自动管理实例显示配置的 Java 主版本、节点实际上报的同主版本环境和“启动时由节点自动解析”；候选项标为节点登记环境，不把它误称为已使用运行时。
- PocketMine 显示不适用 Java。节点离线、环境尚在加载或指定运行时未上报时，准确区分这些状态；切换实例或返回列表时不残留上一个实例信息。

## 入口、Owner 与数据

- 运行入口：Minecraft 实例详情 `/games/minecraft/instance/:instanceId/{overview,configuration,terminal,backup}`，以及带实例 ID 的日志页。
- 实例及运行时快照读取归 `packages/client/ui-minecraft`，沿用已存在的实例、节点和 Java 快照，不增加读取入口。
- 右侧菜单布局归 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 与 `src/css/right-menu.css`；只通过窄的实例环境摘要回调接收数据，不复制 Minecraft 规则。
- Java 节点摘要类型归 Client Connection。实际运行时枚举仍由 Minecraft API/Daemon 上报；UI 不从安装目录、环境变量、进程或其他实例推测当前 Java。

## 设置、权限与边界

- 不新增或修改设置。面板沿用现有 Appearance 主题、颜色、字体、字号、对比度和减少动态效果映射；右栏显隐及宽度继续使用现有工作区偏好。
- 不改变认证、权限或数据归属。可执行路径只在现有 API 为当前角色返回时显示；不放宽 API 的路径脱敏合同。
- 不写实例或节点数据，不启停服务端，不更改用户偏好；不增加请求、轮询、订阅、计时器、观察器或动画。
- 只显示已有权威数据。安装时间、独立安装目录、JDK/JRE 类型、环境变量配置状态等无权威字段不显示。

## 验收

- 右侧栏仅在指定实例详情/指定实例日志路由显示且身份对应；服务器列表和通用日志页无实例 Java 信息。切换实例、离开实例、节点离线和数据未加载时无旧信息误显。
- 显式运行时显示真实匹配记录；自动模式只列出当前快照中节点真实上报的同主版本环境，并清楚标记为未固定的登记项；成员路径按 API 返回缺失；PocketMine 不显示 Java 运行时字段。
- 执行直接相关的类型检查、包构建和正式 Web 构建；在 ChatGPT 内置浏览器检查桌面及窄分栏/短屏实页路由、字段和布局，不执行服务器生命周期或配置写入。
- 实页验收记录路由、视口、交互、截图证据与未测范围，并在最终记录列出所有改动文件及其 Owner 职责。

## 实施与验收记录

- 状态：完成。
- 实现文件：`packages/client/connection/src/api.ts` 扩充已有 Java 环境摘要的可选版本/系统/架构字段；`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx` 从已有实例、节点及 Java 快照生成最小上下文并显示真实运行环境；`packages/client/ui-minecraft/src/MinecraftWorkspace.css` 维护面板和环境条目的响应式样式；`packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 仅负责按当前 Minecraft 路由、账户和角色挂载面板。对应 README 已记录各包职责与数据边界。
- 设置与数据：沿用现有 Appearance 外观令牌及右侧栏偏好；未新增/修改设置、API 权限、实例配置或真实数据。Java 8 自动管理展示节点确实上报的 Temurin 1.8.0_504 环境，并明确这是节点登记项；Java 11 固定运行时展示匹配记录的 Temurin 11.0.32.1、托管来源、amd64、Windows 11 与接口允许返回的路径。未将自动模式候选标成当前使用，也未把本机路径写入本合同。
- 类型、构建与指纹：`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；Client Connection、Minecraft UI、共享 Workspace 包构建通过；正式 Web 构建通过，所有构建输出位于仓库根 `dist/`。项目菜单安全重启完成 Control Plane 与 Web 重建后，菜单内首次启动曾报无法读取 Control Plane `build-state.json` 并退出；随后确认文件存在、正式指纹为 `[]`，重跑 `pnpm lfaa web` 成功启动。最终 `node scripts/runtime-build-state.mjs web` 返回 `[]`，`GET /api/health` 返回 `status: ok`。未运行自动化测试。
- 内置浏览器：从实例列表打开 Java 8 实例后，右栏显示真实同版本节点登记项；返回服务器列表后实例专属信息消失；打开 Java 11 实例后右栏刷新为其精确匹配的 Java 11 环境。正式菜单重建并重启后的最终页面在 `http://127.0.0.1:3000/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/overview`、`1750×1243` 实际视口再次显示发行商、完整版本、发行版、来源、架构、系统及真实可执行路径；截图已在内置浏览器工具结果中留存，未另存文件。此前窄分栏 `876×847`、中间约 `430px` 时验证 Java 8 路径换行且未横向溢出。
- 未测范围：手机真机/独立短屏尺寸、非管理员身份的实页、帧时间及桌面安装包；路径脱敏继续由既有 API 按角色执行。

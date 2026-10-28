# LFAA 系统核心能力与业务 App 边界（2026-10-28）

<a id="lfaa-app-boundaries-20261028"></a>

## 目标与当前 Owner

- 用户目标：以 Agent 为统一工作核心；通用聊天可直接承接开发和项目工作，按目标使用适用能力；进入领域 App 后，聊天、画布、手动面板是同一个 App 工作区的三种模式。
- `/work` 是不要求选择业务 App 的全局 Agent 入口，`workspace` 是其兼容作用域和本机项目范围，不是独立 Agent 产品。通用对话、代码开发和项目文件操作都可直接在这里进行；项目目录是可选工作上下文，不等于业务 App 关联。默认工作目录与 Agent Git 项目继续按项目文件 Owner 的受信任目录规则决定可写范围，所有写入沿用统一 Permission Owner。App 关联只提供模型参考，不扩张工具范围或权限。
- 领域 App 的三种模式共用同一稳定 `ApplicationId` 和领域数据 Owner：聊天通过统一 Agent Loop 完成任务；画布使用系统共享 Canvas Runtime/Canvas Owner，并按 App 注册可用节点；手动模式继续调用 App 自己的面板与数据 Owner。切换模式只切换视图，不另建业务数据、会话或审批链。
- Canvas 与 Workflow 是不同能力：Canvas 项目由 Canvas Owner 保存；Workflow 定义与执行由 Workflow Owner 保存。某 App 只有真实登记的节点/工具/工作流才可用，不用通用节点伪装领域自动化。
- 业务 App 负责自己的领域界面、数据生命周期及领域规则：Minecraft 服务端、Steam 游戏服务器、写作空间、AI 漫剧；联机管理是跨业务连接配置与状态能力，继续由 Connectivity Owner 持有自身路由、凭据引用和任务。
- `/games` 是 Minecraft 服务端、Steam 游戏服务器与运行环境的聚合导航，不是新的领域数据 Owner。SteamCMD 是当前实现依赖，不作为业务产品名称。联机管理可被不同游戏服务注册真实目标适配器，但不拥有这些游戏实例。

## 修改范围与边界

- 批次 A：保持此前整理的领域/系统入口命名与 Owner 分类，并让领域 App 的三模式共用工作区模式栏。
- 批次 B：保留业务 App 的聊天路由作用域，不再把 `/apps/<app>/ai-work` 压成全局 `/work`；Minecraft“交给 AI”进入 Minecraft 上下文。画布到聊天/手动面板的切换沿用同一 App ID。
- `/games` 仍只是聚合入口；Minecraft 与 Steam 游戏服务器各自是有独立数据 Owner 的 App。全局 `/work` 保持开放的通用聊天与项目开发入口，未选业务 App 时仍可使用通用项目文件与已登记的本机/节点命令能力。
- 禁止范围：新增业务 App/Agent/Canvas/Workflow/权限/设置 Owner；改变已有权限模式、复制领域规则或数据 Owner；迁移账户、会话、App ID、画布或工作流数据；把项目 App 关联改造成授权。

## 设置、性能与验收

- `general.hiddenApplicationNavigationIds` 默认 `[]`，由 Settings Owner 校验和持久化，只控制入口显隐；`user_preferences.selectedApp/selectedMode` 默认 `steamcmd/normal`，由 Preferences Owner 保存。三模式栏沿用已有 Appearance 共享映射，不增加新设置或样式变量、不重置用户选择。
- 路由切换不增加会话/领域数据请求；进入对应模式后，聊天、Canvas、手动面板仍调用各自唯一 Owner 的既有读取与写入链。避免在工作模式切换时复制本地项目或缓存领域数据。
- 验收：全局 `/work` 保持无业务 App 选择的通用入口，项目上下文可选；从 Minecraft/Steam 等领域 App 的聊天、画布、手动模式来回切换时 App ID 不丢失；游戏 App 的 AI 辅助保留游戏领域上下文；桌面、窄分栏和短屏模式栏清晰可操作。
- 对直接相关包执行构建/类型检查、`git diff --check` 与包职责检查；在 ChatGPT 内置浏览器检查正式 Web 实页及窄分栏。未通过真实页面检查的状态不得记为完成；不通过访问用户数据或改变偏好做验收。

## 实施与验证记录

首批路由与界面已实现：领域 App 保留 App-scoped 聊天，聊天/画布/手动共用同一 App ID；全局 `/work` 无业务 App 选择，通用项目文件与命令能力仍可用。通用聊天允许讨论和编写代码；保存到项目文件继续遵循默认工作目录/Agent Git 绑定及统一权限规则。待办边界：全局聊天目前不会因可选 App 关联而自动获得该 App 的领域工具；Agent Loop、工具目录与统一权限上下文仍需正式多 App 执行合同。画布目录目前也未覆盖每个领域的专用节点（Minecraft/Steam 仍只有通用文本与便签节点）；不能把“按 App 注册节点”的架构目标写成这些领域节点已完成。

- 验证：`pnpm.cmd run build:web` 通过（3897 modules，产物写入 `dist/apps/web`）；构建内含 `tsc --noEmit -p tsconfig.client.json`。构建后 `node scripts/runtime-build-state.mjs web` 返回 `[]`，`/api/health` 返回 200，`git diff --check` 通过。Vite 有既有大 chunk 提示，不影响构建成功。
- ChatGPT 内置浏览器实页：正式 Web `http://127.0.0.1:3000/work`，桌面 1423×1244 与窄分栏 820×720。两种视口均看到通用工作区聊天/画布入口，输入区显示“当前工作区：通用工作区”，项目选择器独立显示已有项目；页面未出现业务 App 选择。另已沿 Minecraft 聊天与 Steam 画布的现有路由核对 App 作用域及三模式切换。未发送模型请求、未创建会话/画布项目、未改用户偏好；未验证真实模型执行代码或写入项目文件。

# LFAA-AI-WORK-DEFAULT-PROJECT-NEW-SESSION-20261027：新会话默认归入默认工作区

## 用户目标

在 AI Work 新建会话时，默认选中当前账户由 Workspace Owner 登记的“默认工作区”项目，使新会话出现在左侧默认工作区项目分组中。同时，“最近”作为跨项目的近期会话入口，也保留这些会话的访问入口。默认工作区的数据仍在现有 `.lfaa` 位置，修复只补齐新会话的项目归属和侧栏索引。

## Owner、入口与边界

- 运行入口：`/work` → `ApplicationWorkspace` → `AiWorkChat` → 新消息请求创建会话。
- 默认项目 ID 由 `packages/workspace/workspace` 持有并通过认证 `GET /workspace/projects` 返回；`ApplicationWorkspace` 已加载并缓存该 ID。`AiWorkChat` 的所选项目 ID 随新会话消息传给 Session Owner，Session Owner 持久化 `projectId`，左侧项目列表据此归组。
- 新会话默认使用当前账户真实的 `defaultProjectId`；用户从具体项目创建新会话时，该项目优先；用户在当前未发送会话中主动选择其他项目或“移出项目”后，不得被默认值异步覆盖。已有会话继续显示 Session Owner 返回的现有归属。
- “最近”列出当前 Session Owner 会话清单中的未置顶、非归档会话，不因 `projectId` 有值而隐藏；项目归组仍保留同一会话的入口，形成有意的双入口。沿用 Owner 当前最多返回 200 条会话的边界；置顶会话仍只由“置顶”分区提供。
- 不改动 `.lfaa` 数据路径、历史 Session/项目记录、账户项目初始化策略、服务端数据格式或授权边界；不自动迁移历史会话，也不为缺失的默认项目创建替代记录。
- 设置中心：无新增或修改项。外观仍使用 Appearance/Workbench 共享令牌；操作权限仍遵循已有 `permissions.mode`，选择项目本身不授予 Agent 权限。

## 实施批次与验收条件

1. **默认项目到新会话选择器**：把当前账户 `defaultProjectId` 沿现有 `ApplicationWorkspace` → `AiWorkChat` 合同传入；新建会话默认采用它，具体项目入口和用户主动选择优先。验证选择器显示默认工作区，消息创建请求携带真实项目 ID。
2. **最近会话索引**：项目会话同时显示在所属项目与“最近”；置顶会话继续显示在置顶区。
3. **回归与交付记录**：补充默认选择、具体项目优先、用户显式移出项目、最近/项目双入口相关回归；执行 Client 类型检查、相关包构建和 Web 构建，再按仓库规则检查 `/work` 内置浏览器页面。记录实际页面/视口、交互、截图和未测项。

性能边界：仅复用已读取的项目 ID 和现有最多 200 条的会话清单，不增加请求、订阅、计时器或轮询；筛选保持线性复杂度。安全边界：Session Owner 仍校验账户和项目归属；不新增授权路径。维护边界：Workspace Owner 继续唯一提供默认项目 ID，Client 不通过路径或项目名称推断身份。

## 实施与验收记录

状态：已完成。

- 新会话在 `AiWorkChat` 中使用 Workspace Owner 返回的默认项目 ID；具体项目入口和用户显式选择仍优先。未给 `Session Owner` 增加存储路径或权限规则。
- “最近”现在包含所有未置顶会话，不再按 `projectId` 排除项目会话；项目分组保持现有归类，置顶会话仍不重复进入最近。
- 设置中心没有与此行为相关的控制项；本次未新增或修改设置。继续使用真实 `defaultProjectId` 和既有 `permissions.mode`。
- 性能与边界：复用已加载的项目 ID 和 Session Owner 最多 200 条会话列表，没有增加请求、订阅或轮询；最近列表对这份有界清单做一次线性筛选。没有测帧时间；本次未改 `.lfaa` 路径、写入账户偏好或发送消息。

### 验证

- `pnpm.cmd --filter @yubboo/lfaa test -- ./tests/client-workspace-default-project.test.mjs`：3/3 通过，覆盖默认值、具体项目/显式移出优先级、项目会话双入口和置顶排除。
- `pnpm.cmd --filter lfaa-client-ui-chat run build`：通过。
- `pnpm.cmd --filter lfaa-client-ui-workspace run build`：通过。
- `pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`：通过。
- `pnpm.cmd run build:web`：通过；输出位于根 `dist/apps/web/`。Web 运行指纹检查返回 `[]`，构建产物与当前源码一致。
- `git diff --check`：通过。
- 按用户同意的仓库正式流程重启 LFAA Web；运行入口 `http://127.0.0.1:3000/work`。ChatGPT 内置浏览器桌面视口 1593×1244 显示新会话输入框标签“默认工作区”，左侧项目分组显示“默认工作区 27”；AX 页面树确认“最近”共 31 条且一条项目会话在两个分区都可见。窄屏短视口 390×640 显示默认工作区选择器，`documentElement.scrollWidth === clientWidth === 390`，无横向溢出。页面截图已在本轮内置浏览器验收输出中采集；未发送消息或创建持久会话。未进行其他设备实测。

### 本次文件

- `packages/client/ui-chat/src/new-session-project-selection.ts`：纯选择规则，保留具体项目及显式选择优先级。
- `packages/client/ui-chat/src/AiWorkChat.tsx`：接收默认项目 ID，新会话缺省选择默认工作区并继续随请求传给 Session Owner。
- `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`：透传 Workspace Owner 的默认项目 ID；最近列表纳入未置顶的项目会话。
- `apps/cli/tests/client-workspace-default-project.test.mjs`：长期回归测试选择优先级、项目请求归属和侧栏双入口。
- `packages/client/ui-chat/README.md`、`packages/client/ui-workspace/README.md`：记录新会话默认项目与最近列表合同。
- `docs/PROMPTS.md`、`docs/development/ai-work-default-project-new-session-20261027.md`：任务索引、实施与验收记录。

`AiWorkChat.tsx`、两个包 README、`docs/PROMPTS.md` 在本轮开始前已有其他未提交修改；本次保留并仅追加或调整本合同相关内容。

### 最后一次运行树核对

浏览器实页验收和 Web 指纹检查通过后，共享工作树中新出现 3 项本任务外的 Agent/LLM 源码改动：`packages/core/agent-loop/README.md`、`packages/llm/llm/README.md`、`packages/llm/llm/src/completion.ts`（文件时间 2026-10-27 15:56）。最终 `node scripts/runtime-build-state.mjs web` 返回 `["host","web"]`，但 `GET /work` 仍返回 200；这些后续改动不在本任务范围，本轮未改写它们，也未再次构建/重启正在运行的 LFAA 会话。最终页面截图所对应的 Web 构建包含本任务全部 UI 修改；要让运行树与之后的共享源码完全一致，需待这些 Agent/LLM 改动完成后按正式启动流程重新构建。

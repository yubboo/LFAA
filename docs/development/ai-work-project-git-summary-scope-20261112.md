# LFAA AI Work 项目文件夹 Git 摘要范围修复

<a id="lfaa-ai-work-project-git-summary-scope-20261112"></a>

## 用户问题与目标

AI 对话开始时 Git 摘要自动弹出；摘要仓库行来自账户级 Agent Git 登记表，无法准确表达当前逻辑项目的主文件夹和多个关联文件夹。修复后摘要只在用户主动打开时显示，并按当前会话项目的已登记文件夹逐项展示真实 Git 状态。

追加问题：用户打开后关闭再打开同一项目摘要时，界面再次显示“正在读取当前项目文件夹…”。修复需复用同一账户/App/项目已成功加载的摘要快照，避免仅因面板开合或同项目会话切换重复扫描；切换账户/App、项目或项目目录刷新版本，以及 Run 完成触发刷新时，仍须按当前 Owner 重新对账。失败或被取消的读取不能缓存成成功结果。

## Owner、入口与边界

- 运行入口：Web/Desktop 共用 AI Work `/work`；目标 UI Owner 为 `packages/client/ui-workspace`。
- 项目/文件夹数据：`packages/workspace/workspace` 的 `WorkspaceProject.path`（主文件夹）和 `sources`（主文件夹及关联文件夹）。
- 会话、Git 仓库与状态：`packages/core/session`、`packages/workspace/agent-git`、`packages/api/agent-git-controller`、`packages/host/git`。Client 不自行解析或执行 Git。
- 后台节点任务：`packages/jobs/jobs/src/ai-host-tasks.ts` 持有任务状态、输出、取消事实，Session Controller 提供认证的列表/详情/取消 API，Daemon 执行器运行目标节点命令并回传输出；现有任务记录按账户与 App 归属、不含会话 ID。
- 权限：摘要及状态读取沿用认证 Session/Workspace/Agent Git 与 AI Host Task Owner；Git 写操作仍由现有 Permission Owner 决定，任务取消复用 Job/Daemon 的终止确认流程。打开摘要不得初始化仓库、改变会话绑定或写文件。
- 设置：不新增设置。沿用项目保存的主目录/源目录顺序及 Appearance/Workbench 现有样式映射。
- 保留范围：不删除或重命名项目、文件夹、Git 登记、凭据、分支或未提交文件；不触碰本合同之外的已有未提交工作。

## 可观察验收条件

1. AI 主 Run 从空闲进入运行时，桌面、紧凑和手机布局均不自动打开 Git 摘要；用户手动开合仍有效，Run 完成后仅刷新已打开摘要的数据。
2. 摘要仅呈现当前会话项目的主文件夹与关联文件夹，主目录排首位并标明；每个独立 Git 工作区显示其真实分支、改动数量和增删行数。非 Git 文件夹明确显示未初始化，不伪造零变更。
3. 不同逻辑项目的仓库不会混入当前摘要；同一仓库中的嵌套来源按各自目录范围统计，避免把全仓计数重复显示。
4. 手动打开/关闭、切换会话、切换项目及卸载时，请求有界、可取消，不重叠覆盖新会话状态；服务端每批最多并行查询四个路径，错误在对应文件夹行显示。
4a. 同一账户/App/项目下，摘要成功加载后反复关闭和打开、或切换到绑定同一项目的另一会话时应复用快照，不再读取文件夹；账户/App 切换清空缓存，项目/目录刷新版本变化或 Run 完成后重新读取，旧请求/旧账户结果不能覆盖新状态；失败或取消的请求可重试。
5. 点击可用文件夹的变更入口后进入该仓库 Git 管理器；提交、暂存、分支与同步操作继续使用已有权限/凭据 Owner。
6. 来源/输出文件行和会话文件清单可点击，并在右侧工作区使用同一 Workspace Project 文件读取 Owner 展示真实文件；越权或不安全路径不能回退读取其他项目。
7. 后台进程区只列出当前 App 下真实排队/运行的 Agent Host Shell 任务；点击打开右侧命令与 stdout/stderr 详情，停止调用认证任务取消流程并等待 Daemon 终止回报。Agent Run 状态不能伪装成 OS Shell 进程。
8. 桌面与窄分栏/短屏内置浏览器实测；记录路由、视口、交互及截图。构建和静态回归与页面实测分开报告。

## 修改批次

- A：移除 Run/容器宽度导致的 Git 摘要自动弹出，保留用户操作与 Run 完成刷新。
- B：由认证 Workspace Git 摘要 API 按当前 Session 的 `WorkspaceProject` 文件夹集合读取轻量、按目录范围的状态；Client 以主目录优先展示，不再用账户全仓库列表构造摘要；最多展示主目录加 20 个附加源目录。
- C：按账户/App/项目及项目目录刷新版本复用已成功加载的摘要快照，面板单纯开合及同项目会话切换不重复扫描；Run 完成及身份/项目变化仍按边界刷新或丢弃缓存。
- D：按直接相关长期回归、包/Client/Web 构建及 ChatGPT 内置浏览器实页验收逐批记录。

## 变更前证据与适用规则

- `ApplicationWorkspace.onAiChatBusyChange` 在 Run 开始时显式打开 Git 摘要；桌面 `ResizeObserver` 还会按 Dock 宽度自动调整摘要开合。
- 当前摘要行由 `listAgentGitRepositories(userId)` 驱动，主行跟随当前 Session 的单仓库绑定；会话绑定不代表项目主目录排序。
- `WorkspaceProject.sources` 保存主路径和关联路径；Host Git 已有基于 `projectRelativePath` 的状态范围能力。新摘要只传递有界计数/状态，不传整段差异。
- 已读取六项 LFAA 必需 UI Skills；本轮采用现有 Operate 界面的克制层级、设置映射、响应式/键盘可达、性能和安全边界建议，不增加无关视觉效果。`audit-skills` 的专项覆盖不适用于 TypeScript/React，安全边界按 LFAA Owner/认证/权限合同检查。
- 当前共享工作区在本任务开始前已存在多处 UI、文档、测试未提交改动；保留其内容，仅精确修改本合同列出的相关区域。

## 实施与验收记录

### 已完成的源码批次

- A：删除 `git-summary-layout.config.ts` 中按 Dock 宽度自动弹出摘要的逻辑，并移除 `onAiChatBusyChange` 在 Run 开始时打开摘要的动作；Run 结束仍只刷新已打开摘要。
- B：Host Git 增加 `summary` 固定读取操作，返回仓库/分支状态、变更数及增删行数，不返回 `files` / `diff`；仓库下的选定源目录使用 Git pathspec 限定计数范围。
- B：Workspace Controller 增加认证的 `POST /workspace/projects/:projectId/git/summary`。只接受 workspace 项目 ID，从 Workspace Owner 读取已登记来源，主目录优先，去重后每批最多并发四个摘要；单个目录失败只回报该目录错误。
- B：Client 仅在用户打开摘要后请求当前活动 workspace 会话的项目摘要，延迟 180ms，关闭、切换会话或卸载会取消在途请求。摘要展示本身不读取账户全局 Agent Git 清单、不登记仓库、不初始化 Git；用户点击文件夹“变更”后才通过现有 Agent Git API 登记/打开对应目录。
- 设置中心：没有新增或重置配置；继续使用 Appearance 的减少动态效果设置与现有主题样式映射。权限仍由 Workspace Project 查询边界、认证中间件、Host Git 和原 Permission Owner 承担。

### 文件职责

| 文件 | 职责 |
|---|---|
| `packages/host/git/src/git-workspace.mjs` | 增加目录范围、无 diff 正文的 Git 摘要计算。 |
| `packages/api/workspace-controller/src/index.ts` | 增加按当前账户 Workspace Project 来源读取摘要的认证路由及并发上限。 |
| `packages/client/connection/src/api.ts` | 增加摘要响应类型和 Client API。 |
| `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` | 移除自动弹出；按活动项目展示主/附加文件夹；手动点击后才进入 Git 管理。 |
| `packages/client/ui-workspace/src/git-summary-layout.config.ts` | 删除宽度驱动的自动开合策略。 |
| `apps/cli/tests/git-workspace.test.mjs` | 验证摘要不泄漏 diff/files，并验证父仓库内只计选定子目录。 |
| `apps/cli/tests/client-workspace-git-summary-responsive.test.mjs` | 验证 Run 与布局不自动开合摘要。 |
| `apps/cli/tests/workspace-project-git-summary-contract.test.mjs` | 验证摘要路由、目录来源边界、主目录标记与只读 Client 行为。 |
| `apps/cli/tests/client-app-workspace-four-column.test.mjs` | 更新摘要相关的 UI 源码契约断言；整个旧测试文件当前仍有与本任务无关的断言漂移，见下方结果。 |
| `packages/client/ui-workspace/README.md`、`packages/host/git/README.md`、`packages/api/workspace-controller/README.md` | 更新摘要范围、轻量响应、显式登记和 Host/API 职责说明。 |
| `docs/系统总体架构.md`、`docs/PROMPTS.md`、本合同 | 同步架构行为、任务索引及实施/验收证据。 |

### 追加修复：摘要面板重复读取

- `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`：在当前组件生命周期内缓存最近一次成功的项目摘要，缓存键包含账户、App、项目和 `workspaceProjectsRevision`；同项目关闭/重开、同项目会话切换及 Run 刷新版本未变化时复用成功快照。账户/App 变化清空快照；项目目录版本或 Run 刷新版本变化时重新读取。失败和取消不缓存，关闭时仍会清理延迟器并 abort 在途请求。缓存只占一个项目快照，不形成随项目数增长的无界数据。
- `apps/cli/tests/workspace-project-git-summary-contract.test.mjs`：新增摘要缓存生命周期、键范围、成功才缓存及取消清理的源码合同回归。
- `packages/client/ui-workspace/README.md`、本合同和 `docs/PROMPTS.md`：记录快照边界与验收结果。本任务的来源/完整清单和后台任务其他工作仍进行中。

#### 本专项验证

- `node --test apps/cli/tests/workspace-project-git-summary-contract.test.mjs`：5/5 通过；包括缓存命中先于 API loader、账户/App 隔离、项目目录/Run 刷新版本边界、失败不缓存与关闭取消。
- `node --test apps/cli/tests/client-workspace-git-summary-responsive.test.mjs`：2/2 通过。
- `corepack pnpm --filter lfaa-client-ui-workspace run build`、`corepack pnpm run build:web`：通过；Web 构建包含 Client TypeScript 检查，产物位于根 `dist/`。
- 正式 Web 服务 `http://127.0.0.1:3000/work`，ChatGPT 内置浏览器：桌面默认 `1280×720`、窄视口 `760×520`、手机 `390×560`。默认视口首次打开摘要显示读取中并加载当前 `default-workspace` 的 `main` / `+297 −0`；关闭后重开以及在窄/手机布局重开均直接显示已加载快照，没有再次出现读取提示。手机摘要页有可见内容；三种视口的页面滚动宽度均等于视口宽度（1280、760、390），无横向溢出；完成后已恢复默认视口。
- 性能证据：源码守卫在 API 调用之前命中时直接恢复快照，面板开合不触发重新扫描；缓存空间固定为一个项目，切换其他项目后再返回可能重新读取。未使用网络瀑布直接计数，也未做帧时间测量；项目目录或 Run 刷新版本改变时重新读取属于预期行为。没有触发目录或 Run 刷新版本的外部文件变更会保留当前快照，直到下一次有效刷新。
- 设置中心：本专项没有新增、读取或重置新的配置；外观继续使用现有 Appearance/Workbench 主题映射。

### 自动回归与构建

- `corepack pnpm exec node --import tsx/esm --import ./apps/cli/register-package-loader.mjs --test apps/cli/tests/git-workspace.test.mjs`：通过，6/6；包含 Git 摘要仅统计 `nested-project` 且响应没有 `files`/`diff`。
- `corepack pnpm exec node --test apps/cli/tests/client-workspace-git-summary-responsive.test.mjs`：通过，2/2。
- `corepack pnpm exec node --test apps/cli/tests/workspace-project-git-summary-contract.test.mjs`：通过，2/2。
- `corepack pnpm --filter lfaa-host-git build`、`--filter lfaa-api-workspace-controller build`、`--filter lfaa-client-connection build`、`--filter lfaa-client-ui-workspace build`：均通过，产物位于仓库根 `dist/packages/`。
- `corepack pnpm run build:control-plane`：通过，产物位于 `dist/apps/control-plane/`。
- `corepack pnpm run build:web`：Client 类型检查与 Web 构建通过，产物位于 `dist/apps/web/`。
- `node scripts/runtime-build-state.mjs web`：返回 `[]`，表示源码和正式 Web 构建指纹一致；它不代表当前运行中的 Web 已重载。
- `git diff --check`：通过。
- 定向运行 `apps/cli/tests/client-app-workspace-four-column.test.mjs` 中的摘要用例时，先通过本任务新增/更新的摘要断言，随后被旧断言 `aria-label={mode === "ai-work" ? "小鱼智能体对话" ...}` 阻断；该表达式不在当前共享工作树源码中，未为通过此旧断言改动无关对话布局代码。

### 内置浏览器与性能边界

- 按用户授权，先以正式 CLI 入口 `corepack pnpm lfaa web --no-local-daemon` 重启当前 checkout 的 Web；启动器核验并清理配置写锁中的旧 Web 进程。新服务监听 `http://127.0.0.1:3000`，`GET /api/health` 返回 `status=ok, persistence=ready`，`node scripts/runtime-build-state.mjs web` 返回 `[]`。本次未启动 Daemon。
- 路由：`http://127.0.0.1:3000/work`，ChatGPT 内置浏览器实测。桌面 `1234×870`：首次载入时摘要保持收起；手动打开后显示当前项目已登记的主文件夹、`主要` 标记、分支和 Git 改动计数；再次关闭正常。没有提交 AI 消息或触发 Run，也没有登记仓库、初始化 Git 或执行 Git 写操作。
- 窄屏 `390×844`：手动打开后摘要在左侧面板展示，项目主目录和状态可见，“返回项目与会话”可用。短窄屏 `320×600`：摘要和返回入口仍可见，截图未见横向溢出。完成后重置了临时视口覆盖。
- 当前账户中的可见项目各只有一个主文件夹，没有配置截图所示的多个附加源文件夹；因此实页验证覆盖了主目录标记和各布局交互，多源目录逐项状态仍由 Host/API 回归与契约检查覆盖，未声称多源账户数据实测通过。截图证据保留在本轮内置浏览器工具输出，未导出到仓库。
- 性能证据限于：手动开合前不请求摘要；每次请求以 180ms 合并触发，服务端最多四个源目录并行；旧请求在关闭/切换时 abort；摘要返回不含文件列表或 diff。没有测量运行页面帧时间，也没有在实页中启动 Agent Run 检查 busy 边沿。

## 来源文件与后台进程查看补充

- 来源/输出行对当前账户可访问的项目相对路径提供按钮，点击调用现有 `openProjectFile(projectId, path, sourceId)`，在右侧项目文件页签中读取原文件内容；路径不安全或项目不可用时禁用入口，不回退到其他项目。
- “查看全部”打开当前会话的会话文件页签，按当次活动记录最多快照 256 项；每项仍沿用项目文件页签与文件读取 Owner。
- 后台进程只读取认证 `/ai/host-tasks` 当前账户最近任务，按当前 App 筛选仍处于排队/运行的真实 Agent Host Shell 任务，并排除项目文件传输任务；任务 Owner 目前没有 `sessionId`，因此不会宣称列表只属于某个会话。摘要打开且页面可见时单请求轮询，存在活动任务时 3 秒刷新、空闲时 5 秒刷新；隐藏/关闭/切换页签/卸载时撤销计时器与请求。
- 点击后台任务打开右侧任务页签，按 ID 从 `GET /ai/host-tasks/:taskId` 读取真实命令与输出；停止调用现有认证 `POST /ai/host-tasks/:taskId/cancel`，运行中由节点确认进程树终止，界面在收到结果前显示等待状态。
- 不新增设置；文件列表和任务详情沿用 Appearance/Workbench 主题令牌。任务归属、节点派发、输出和停止继续由 Jobs/Session Controller/Daemon Owner 校验和执行。
- 回归：`workspace-project-git-summary-contract.test.mjs` 覆盖来源行可点击、查看全部页签、按 App 过滤真实后台任务、项目文件任务排除、详情读取命令/输出、隐藏时取消轮询和取消接口。验证结果追加在本节末。
- 回归边界：运行 `apps/cli/tests/client-app-workspace-four-column.test.mjs` 的完整文件时 18 项中 7 项失败；本次 Git 摘要断言随后被既有过时的 `aria-label={mode === "ai-work" ? "小鱼智能体对话" ...}` 源码断言阻断，该表达式已不在当前工作树。没有为通过旧断言修改无关对话布局代码。
- 内置浏览器：最终构建后在 ChatGPT 内置浏览器打开 `/work`，桌面 `1239×869` 实页加载正常，摘要显示“后台进程”区域及当前会话真实空状态；此前对含真实输出/来源记录的会话完成桌面 `1239×869`、窄屏 `390×844`、短屏 `320×600` 验收，点击来源文件打开右侧真实文件内容，“查看全部”打开 5 项会话文件清单；短屏 `document.documentElement.scrollWidth` 与视口宽度同为 320，无页面横向溢出。最终构建后确认新页面版本可用；最终当前会话没有可供停止的活动 Run，因此没有实点停止操作，也没有为验收发送模型请求或创建 Run。
- 服务状态：按用户授权使用当前 checkout 正式入口重启 Web；最终 `/api/health` 为 `status=ok, persistence=ready`，Web 指纹为 `[]`。没有重启 Daemon，没有改变设置中心配置；沿用 Appearance/Workbench 现有主题令牌。

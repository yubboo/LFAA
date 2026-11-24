# Git 工作树（Worktree）会话隔离开发方案

| 项目 | 内容 |
| --- | --- |
| 状态 | **负责人已确认方案；P0–P2d、P3a/P3b 已实施；自动合并仍待决策** |
| 日期 | 2026-11-22（Asia/Shanghai） |
| 实施级别 | A1：新增功能包、跨包会话契约、运行目录解析与 UI 入口 |
| 评审稿范围 | 负责人已确认目录位置、入口位置与会话关系；按 P0 → P1 → P2 实施，每个阶段独立验收 |

## 1. 要解决的问题

当前会话与项目的绑定关系只有一层：**项目 → 目录**。绑定同一项目的所有会话共享同一个工作目录，因此：

- 两个会话并行修改同一个文件会互相覆盖。本仓 2026-11-21 已真实发生：两个会话同时写 `ChatWorkspace.tsx`，解构语句被压成语法错误；`model-reasoning-options.ts` 被整文件写成乱码。
- 一个会话切分支或执行 `git checkout` 会影响另一个会话正在运行的任务。
- 想同时验证 A/B 两种改法，只能串行或手工复制目录。
- 项目范围锚定（`docs/features/project-scope.md`）只能约束“聊什么”，约束不了“改哪份文件”。

Git 工作树允许同一仓库同时检出多个目录、各自持有分支与 HEAD，共享对象库与提交历史。把“一个会话 = 一个工作树”作为隔离单位，可以从文件层面消除上述互踩。

## 2. 目标与非目标

### 目标

1. 用户可以在项目里为一条新会话创建独立工作树（新分支 + 新目录），会话后续的读写、命令、Git 审查都落在该目录。
2. 会话明确显示自己在哪个目录、哪个分支，避免“以为在改主线，实际在改副本”。
3. 工作树的创建、列出、删除都有 Host 侧校验与安全加固，不执行仓库自带的钩子/过滤器。
4. 未绑定工作树的旧会话行为完全不变。

### 非目标（本期不做）

- 不做自动合并回主分支、自动 rebase、冲突解决。
- 不做跨机器/远端工作树。
- 不做“把主工作区未提交改动带进新工作树”（P3 再评估）。
- 不替换现有的项目目录模型：工作树是会话级覆盖，不是新的项目类型。
- 不做自动清理策略（会话删除不自动删目录），先保证不误删用户改动。

## 3. 用户流程

### 3.1 在项目里开工作树会话

1. 在项目行菜单里点「新建工作树会话」（输入框不塞分支表单，避免误触）。
2. 弹窗填写分支名（默认建议 `lfaa/<日期>-<4位随机>`），可选起点（默认当前 HEAD）。
3. 点「创建工作树」→ Host 立即创建同级目录与分支 → 新会话草稿绑定该工作树，输入框上方显示「分支 · 目录」chip。
4. 发送第一条消息后，Agent、终端、Git 审查都使用工作树目录。
5. 会话头部与侧栏行持续显示分支徽标；chip/徽标可查看完整路径或一键复制。

### 3.2 查看与清理

- 项目详情页新增「工作树」区块：分支、目录、绑定会话数、是否有未提交改动。
- 只有未绑定运行中会话、且工作区干净（或显式勾选强制）时才允许删除。
- 解绑：会话设置里可「解除工作树绑定」，会话回到项目主目录；已有消息与轨迹保留。

### 3.3 失败与边界

- 非 Git 项目：入口置灰，提示「该项目不是 Git 仓库，无法创建工作树」。
- 分支已存在、目录已存在、分支名非法：创建前就地报错，不留下半成品。
- 主工作区有未提交改动：允许创建，但弹窗明确提示「未提交改动不会带到新工作树」。
- 工作树被外部删除或不再是同一仓库：运行前校验失败，明确提示“工作树不可用”，**不静默回退到项目主目录**。

## 4. 包归属与职责

新增包 `packages/workspace/worktree`（`@lfaa/worktree`）：

| 项 | 内容 |
| --- | --- |
| 分组 | `workspace/`：工作区领域已有 `workspace`、`sections`，工作树属于同一领域 |
| Host 入口 | `src/index.ts` 默认导出 Cordis 插件，注册 `worktree` 服务 |
| 公开契约 | `contract/index.ts`：`WorktreeRecord`、`CreateWorktreeInput`、`WorktreeStatus`（无 Node/DOM 依赖） |
| Client | 本期无独立 Client；入口 UI 由 `@lfaa/chat` 的 composer 贡献，工作树列表由 `@lfaa/workspace` 项目详情展示 |
| 依赖 | `@deepseek-ai/cordis`、`@lfaa/workspace`（读取项目根）；不依赖 React |

职责边界：

- `@lfaa/worktree`：只负责 Git 工作树的创建/查询/删除、安全校验与元数据持久化，不碰会话。
- `@lfaa/core/session`：保存会话绑定的工作树快照字段。
- `@lfaa/chat`：新会话入口、会话展示、把工作树 id 传给 Host。
- `@lfaa/agent` / `@lfaa/jobs` / Git 服务：解析“本会话有效根目录”，不直接执行 `git worktree`。

## 5. 数据与公开契约

### 5.1 工作树记录

```ts
export interface WorktreeRecord {
  id: string;
  projectId: string;
  /** 项目主工作区（git rev-parse --show-toplevel）。 */
  repositoryRoot: string;
  /** 工作树目录绝对路径。 */
  path: string;
  branch: string;
  /** 创建时的起点提交，供审计与后续合并参考。 */
  baseCommit: string;
  createdAt: number;
}

export interface CreateWorktreeInput {
  projectId: string;
  branch: string;
  /** 默认 HEAD；只接受本地已有 ref 或提交哈希。 */
  from?: string;
}

export interface WorktreeStatus extends WorktreeRecord {
  exists: boolean;
  dirtyCount: number;
  /** 绑定到该工作树的会话数（由 Host 汇总，不由 Git 推断）。 */
  sessionCount: number;
}
```

存储：`~/.lfaa/worktrees.json`（按 `id` 持久化，和 `projects.json` 同目录）。记录只是索引；真实状态每次以 `git worktree list --porcelain` 与目录存在性为准。

### 5.2 会话绑定

`ChatSessionSummary` 增加**只读摘要字段**，`ChatSessionRecord` 保存完整快照：

```ts
export interface SessionWorktree {
  id: string;
  path: string;
  branch: string;
  repositoryRoot: string;
}

// ChatSessionSummary / ChatSessionRecord
worktree?: SessionWorktree;
```

- 创建会话时接受 `worktreeId?: string`，Host 用记录解析出 `SessionWorktree` 再落库；**不接受客户端直接传路径**。
- 更新会话时允许 `worktreeId: string | null`；置空即解绑，但运行中或有活跃任务时拒绝。
- 分叉会话复制工作树绑定（同一工作树允许多会话仍按 6.3 的默认策略处理）。
- 旧会话没有该字段，行为不变。

### 5.3 HTTP

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/worktrees?projectId=` | 列出项目工作树与状态 |
| `POST` | `/api/worktrees` | 创建，入参 `CreateWorktreeInput`，返回 `WorktreeStatus` |
| `DELETE` | `/api/worktrees/:id?force=1` | 删除；有绑定会话或目录脏时默认拒绝 |
| `GET` | `/api/worktrees/:id/inspect` | 返回工作树目录的 `WorkspaceInspection`，供右栏文件树复用 |
| `POST` | `/api/chat/sessions` | 请求体新增可选 `worktreeId` |
| `PATCH` | `/api/chat/sessions/:id` | 请求体新增可选 `worktreeId`（`null` 解绑） |
| `GET` | `/api/git/*` | 查询新增可选 `sessionId`；传了就用会话有效根，否则沿用项目根 |

所有路由仍走现有本机令牌 + 同源校验；工作树服务不新增鉴权旁路。

### 5.4 会话有效根（唯一事实来源）

新增 Host 侧解析函数 `resolveSessionWorkspace(sessionId)`，返回：

```ts
{ roots: string[]; worktree?: SessionWorktree; projectRoot?: string }
```

规则：

1. 会话未绑定工作树 → 沿用现有项目根解析（含“项目外聊天目录”）。
2. 已绑定 → 校验 `git rev-parse --show-toplevel` 等于 `worktree.path`，且 `git rev-parse --git-common-dir` 与项目根一致；通过后 `roots = [worktree.path]`。
3. 校验失败 → 抛错并提示重新绑定/解绑，**不回退**。

调用方统一改成它：Agent 运行（`beginAgentRun`）、后台任务 cwd、Git 审查、媒体输出目录、右栏文件树/文件读取。禁止各处自己拼 `projectId → rootPath`。

## 6. 关键设计

### 6.1 目录位置

默认放在项目仓库的**同级**目录：

```text
<repo 父目录>/<repo 名>-worktrees/<8位短id>-<branch-slug>/
```

- **不放进项目根**：`tsc` / eslint / Vite / grep / OneDrive 等工具会递归扫描项目目录，工作树里的完整源码和依赖会让它们重复处理甚至爆内存；隐藏目录在 Windows 上也不会真正隐藏。
- **不放进 `~/.lfaa`**：应用私有路径受命令防护拦截，工作树放在那里会导致 Agent 的正常读写被自己的安全规则挡住。
- 目录名用短 id 保证唯一，slug 只保留 40 字符以内的可读提示；真实分支以元数据为准，不从目录名反推。
- 同级目录不可写（如仓库位于 `C:\Program Files`）时直接报错并提示换可写位置，不做静默降级；可配置基础目录放到 P3。
- 工作树路径作为该会话的授权根加入沙箱、媒体目录与文件树，**不是**项目的永久根；会话解绑后即失效。

### 6.2 创建流程与安全加固

1. 校验项目存在、目录存在、是 Git 仓库；取 `repositoryRoot`。
2. `git check-ref-format --branch <branch>`；拒绝已存在分支（`show-ref --verify`）与已存在目录。
3. 拒绝 `repositoryRoot` 嵌套另一个仓库（工作树路径内不允许 `.git` 文件指向别处）。
4. 执行 `git worktree add --no-checkout -b <branch> <path> <baseCommit>`；统一带：
   - `-c core.hooksPath=/dev/null`
   - `-c core.fsmonitor=false`
   - `-c filter.<name>.smudge=`/`clean=` 一律忽略（或 `-c filter.<name>.required=false`）
5. 在该工作树设置 `extensions.worktreeConfig=true` 与 `core.hooksPath=`，防止后续提交/检出触发仓库钩子。
6. `reset --hard <baseCommit>` 检出文件；记录 `baseCommit = rev-parse HEAD`（或指定起点）。
7. 写入 `~/.lfaa/worktrees.json`；任一步失败都回滚目录与分支（`worktree remove --force` + `branch -D` 仅限本次新建的分支）。

删除：

1. 校验没有运行中的会话绑定；`sessionCount > 0` 默认拒绝。
2. 有未提交改动或未跟踪文件时默认拒绝，`force=1` 才允许（删除前在 UI 二次确认，文案写明会丢改动）。
3. 先 `git worktree remove <path>`，再从索引移除；失败时不从索引删除，保持可重试。

### 6.3 会话与工作树的关系

默认 **1 个工作树同一时间只服务 1 条会话**（创建入口一次性完成“建树 + 绑定”）。原因：多会话共享一个工作树等于回到互踩问题。后续如需“复用同一工作树开多条只读讨论会话”，再单独评估，不在本期放开。

- 会话删除：不删工作树，只解除绑定并提示“目录仍保留，可在项目详情里清理”。
- 会话归档：保留绑定，恢复时继续使用。
- 分叉：新会话复制绑定（此时允许两条会话同树，因为分叉的典型用途是同一改动的不同讨论；写操作仍按运行锁串行，后续可加只读约束）。

### 6.4 UI

| 位置 | 内容 |
| --- | --- |
| 项目行菜单 | 「新建工作树会话」：分支名、起点、目标目录预览、创建按钮与错误提示 |
| 输入框上方 | 已绑定时显示「分支 · 目录」chip；点开可复制路径或解除绑定，不再承载创建表单 |
| 会话头部 | 项目名旁显示分支徽标与目录短名；悬停看完整路径；工作树失效时红色警示 |
| 侧栏会话行 | 工作树会话在标题后加分支小标签（窄屏只显示图标） |
| 项目详情页 | 「工作树」区块：分支、目录、会话数、未提交改动数、删除入口 |
| 项目详情右栏 | 当前会话工作树摘要（目录/分支/起点提交） |

全部使用 `@lfaa/ui-theme` 语义变量，深浅色都要验收；窄屏仍走现有四栏折叠契约。

### 6.5 运行环境差异提示

工作树只检出 Git **已跟踪**内容，不是整个工作目录的副本：

- `node_modules`、构建缓存、`.env`、本地数据库、生成物都不会自动带过去。
- 创建成功后提示一次「该目录是干净检出，需要单独安装依赖 / 配置本地环境」，提供「打开目录」入口。
- 不在本期自动复制 `.env` 或安装依赖；P3 再评估可选的“环境准备”步骤。

## 7. 文件级改动清单

### 新增

- `packages/workspace/worktree/package.json`
- `packages/workspace/worktree/tsconfig.json`
- `packages/workspace/worktree/tsdown.config.ts`
- `packages/workspace/worktree/README.md` / `README.zh.md` / `README.i18n.yaml`
- `packages/workspace/worktree/contract/index.ts`
- `packages/workspace/worktree/src/index.ts`（插件 + 服务注册）
- `packages/workspace/worktree/src/worktree-service.ts`（创建/列出/删除/校验）
- `packages/workspace/worktree/src/git-command.ts`（安全调用 `git`，统一超时与加固参数）
- `packages/workspace/worktree/src/store.ts`（`worktrees.json` 读写）
- `packages/workspace/worktree/src/http-handler.ts`
- `packages/workspace/worktree/tests/worktree-service.test.ts`
- `packages/workspace/worktree/tests/http-handler.test.ts`
- `packages/workspace/worktree/tests/worktree-security.test.ts`

### 修改

- `packages/core/session/src/types.ts`、`src/session-store.ts`、`src/index.ts`：`SessionWorktree`、创建/更新/分叉字段。
- `packages/core/session/tests/session.test.ts`：绑定、解绑、分叉、旧会话兼容。
- `packages/core/chat/src/index.ts`、`src/http-handler.ts`：`worktreeId` 透传与 Host 解析。
- `packages/core/chat/src/git-http-handler.ts`：`sessionId` → 有效根。
- `packages/core/chat/client/chat-types.ts`、`chat-session-actions.ts`、`chat-store.ts`：草稿 `draftWorktreeId` 与会话字段。
- `packages/core/chat/client/components/ComposerScopeBar.tsx`、`ChatComposer.tsx`：已绑定分支 chip 与解绑入口。
- `packages/core/chat/client/components/WorktreeDialog.tsx`（新增，P2）：分支名、起点、目录预览与错误提示。
- `packages/workspace/workspace/client/components/ProjectRowActions.tsx`：项目行菜单新增「新建工作树会话」入口。
- `packages/core/chat/client/components/ChatWorkspace.tsx`、`SessionHoverCard.tsx`、`SessionRowActions.tsx`、`ChatWorkspace.module.css`：分支徽标与失效提示。
- `packages/core/chat/client/locales.zh.ts`、`locales.en.ts`、`locales.types.ts`：中英文案。
- `packages/core/agent/src/run-begin.ts`、`src/run-types.ts`：优先使用会话有效根；系统提示写明“当前工作树/分支”。
- `packages/core/agent/src/agent-context.ts`：工作位置提示补充工作树目录与分支。
- `packages/host/web-server/src/handlers.ts`、`src/handlers-chat.ts`、`src/runtime.ts`：注册 `/api/worktrees`、`resolveSessionWorkspace`，后台任务与 Git 路由改用它。
- `packages/bundle/web/src/index.ts`：挂载 `@lfaa/worktree`，联线项目/会话。
- `packages/workspace/workspace/client/components/ProjectWorkspace.tsx`、`ProjectContextPanel.tsx`：工作树区块。
- `pnpm-workspace.yaml`（`packages/*/*` 已覆盖，无需改）、`tsconfig.base.json`、`scripts/check-workspace.mjs` 的导出白名单（由 `pnpm sync` 生成后人工核对）。
- `docs/architecture/README.md`：索引新增本方案。
- `scripts/check-allowlist.json`：只在确有既有超限文件时登记，不新增债务。

### 预计规模

- Host 新增约 900–1200 行（服务、HTTP、测试）。
- 跨包改动约 400–600 行（会话、聊天、Agent、装配、UI）。
- 单个文件守 300/500 行与 250/400 行上限；`worktree-service.ts` 预计超过 300 行，必须拆 `git-command` / `store` / `guard` 三个文件。

## 8. 实施顺序

### P0 服务与安全（可独立验收）

1. 新建包骨架、契约、`worktrees.json` 存储。
2. `create/list/remove` + 分支与目录校验 + 钩子/过滤器加固。
3. HTTP 与单测：成功、重复分支、重复目录、脏目录删除、非 Git 项目、路径逃逸。

### P1 会话绑定与运行目录

1. 会话契约与存储字段。
2. 聊天创建/更新接口接受 `worktreeId`。
3. `resolveSessionWorkspace` 接入 Agent、后台任务、Git 审查、媒体目录。
4. 失效工作树明确报错，不静默回退。
5. 单测：绑定运行使用工作树根；解绑恢复项目根；失效时不越权。

### P2 UI 与会话标识

1. 输入框「分支 + 新建工作树」入口。
2. 会话头/侧栏/右栏工作树徽标与项目详情工作树区块。
3. `/api/worktrees/:id/inspect` 接入右栏文件树。
4. 深/浅色、桌面与窄屏验收。

### P3 收尾能力

1. 删除时的脏检查与强制确认。
2. 工作树与分支的清理建议（不自动删）。
3. 评估“携带未提交改动”“合并回主分支”的独立方案。

每阶段独立可回滚；P0 不改变现有行为，P1 只对显式绑定的会话生效。

## 9. 验收条件

1. 两个会话绑定不同工作树，同时修改同一相对路径文件互不影响；`git status` 各自独立。
2. 会话删除/解绑不影响工作树目录；强制删除前有二次确认且文案写明会丢改动。
3. 创建失败（分支已存在、目录占用、非 Git）不留半成品，错误可读。
4. 仓库内 `core.hooksPath`、`filter.*` 不会在创建/检出时被执行；有安全测试覆盖。
5. 旧会话（无 `worktree`）行为、权限、目录与现在完全一致。
6. 工作树目录失效时运行明确失败，工具不落到项目主目录。
7. 深/浅色主题下入口、徽标、项目详情区块显示正常；内置浏览器实测控制台无新增报错。
8. `pnpm check` / `lint` / `typecheck` / `test` / `build` 全绿；`pnpm probe:loader` 能加载新包。
9. 工作树位于项目同级目录，主项目目录的 `tsc`/eslint/Vite 扫描结果不因工作树增加而改变。
10. 创建成功提示“干净检出、需单独安装依赖”，不复制 `.env`、`node_modules` 与未跟踪文件。

## 10. 风险与回滚

| 风险 | 处置 |
| --- | --- |
| 用户不知道自己在哪个目录，误把副本当主线 | 会话头常驻徽标 + 完整路径 tooltip + 项目详情页目录列表；不靠“提示一次” |
| 工作树目录占磁盘、残留 | 项目详情可见、删除入口显式、文档说明清理方式；不做自动删除 |
| 主工作区未提交改动“消失” | 创建时明确提示未提交改动不会带过去；P3 再评估携带能力 |
| Git 钩子/过滤器执行仓库代码 | 统一禁用 hooksPath/fsmonitor/filter；安全测试覆盖 |
| 工作树路径被外部删除后自动回退导致写错目录 | 失效即失败，绝不回退 |
| 新增包破坏 Loader/包边界 | 按包分类规范归入 `workspace/`，README 三件套、默认导出、`probe:loader` 验收 |

回滚：

- P0 仅新增包与路由，删除插件挂载即可完全回退。
- P1 字段可选；旧会话无字段不受影响。回退时保留已创建目录，由用户自行处理，不自动删。
- P2 UI 入口可单独关闭，不影响 Host 能力。

## 11. 已确认的默认值

以下默认值由负责人确认，按此实施：

1. **位置**：项目仓库同级 `<repo 名>-worktrees/<8位短id>-<branch-slug>`，不使用项目内目录，也不放 `~/.lfaa`。
2. **入口**：项目行菜单「新建工作树会话」；输入框只显示已绑定的分支 chip。
3. **关系**：默认 1 工作树 = 1 会话；分叉会话例外（继承绑定）。
4. **起点**：默认 `HEAD`；允许填本地分支或提交哈希，不允许远端拉取。
5. **分支名**：默认 `lfaa/<日期>-<4位随机>`，可改成任意合法分支名。
6. **主工作区脏**：允许创建，但提示“未提交改动不会带过去”。
7. **删除**：只允许手动；有绑定会话或脏改动默认拒绝，需显式强制。
8. **非 Git 项目**：入口置灰，不提供“自动 init”。

## 12. 评审通过后的第一步

先做 P0：新包 + 服务 + HTTP + 安全测试，不改任何现有会话行为；P0 验收通过、`probe:loader` 能加载后，再进入 P1 绑定与运行目录切换。

## 13. P0 实施记录（2026-11-22）

P0 已完成，未改变任何现有会话行为：

- 新包 `packages/workspace/worktree`（`@lfaa/worktree`）：契约、`WorktreeStore`、安全 Git 调用、服务、HTTP、README 三件套与包内测试。
- 服务：`create / list / get / inspect / remove`；目录为项目仓库同级 `<repo>-worktrees/<8位id>-<slug>`；创建时校验分支与起点、拒绝重复分支/目录、统一禁用 `core.hooksPath` / `fsmonitor` / `filter.*`；失败只回收本次创建的分支与目录。
- 删除：默认拒绝绑定会话（计数器由装配层注入，P1 接线）与未提交改动；`force` 才允许丢弃改动并清理目录。
- HTTP：`GET/POST /api/worktrees`、`DELETE /api/worktrees/:id`、`GET /api/worktrees/:id/inspect`；已在 `web-server` 网关与 `bundle-web` 挂载。
- 测试：7 项（创建/检出、重复与非法输入、非 Git 项目、脏目录与绑定会话保护、钩子禁用、加固参数、HTTP 路由）。
- 实测：启动真实 Host 后通过接口创建同级工作树（`...-worktrees/07b6f7eb-feature-p0-check`）、列出、读取 README、删除，目录随之消失。
- 门禁：`pnpm test` 531 项全过；`pnpm check` 0 错误 / 4 条既有警告；`pnpm lint` 448 文件 0 问题；`pnpm typecheck` 0；`pnpm build` 55 包；`pnpm probe:loader` 13/13。
- 尚未开始：会话绑定字段与创建入口、有效根切换、Git 审查/文件树/终端接入工作树（P1/P2）。

## 14. P1 实施记录（2026-11-22）

P1 完成，现有会话行为在“未绑定工作树”时保持不变：

- 会话契约：新增 `SessionWorktree` 快照（含 projectId / path / branch / repositoryRoot）；摘要与完整记录都可携带；创建/更新输入接受 `worktree`，`null` 表示解绑。
- 存储：会话文件读写校验工作树快照；摘要包含绑定；分叉会话继承绑定；绑定时直接更换项目会被拒绝并提示先解绑。
- HTTP：`POST /api/chat/sessions` 与 `PATCH /api/chat/sessions/:id` 接受 `worktreeId`（`null` 解绑），由 Host 解析为快照；未知或不可用 id 返回 400；客户端提交的路径不采信。
- 运行根：新增 `resolveSessionWorkspace(sessionId)`；绑定工作树的会话在 Agent 运行与后台任务中使用工作树目录，工作树记录/目录/仓库任一不匹配即报错，不回退项目主目录。
- 系统提示：工作位置写明“工作树 <分支>”，并声明所有读写、命令与 Git 操作以该目录为根，项目主目录仅用于对照。
- 删除保护：bundle 联线把会话快照计数注入工作树服务，`DELETE /api/worktrees/:id` 在有绑定会话时拒绝。
- 测试：会话持久化/摘要/分叉/换项目保护 1 项；Agent 工作树运行根与失效不回退 2 项；聊天 HTTP 绑定/解绑/未知 id 2 项；工作树包既有 7 项。
- 实测：真实 Host 上创建项目 → 工作树 → 绑定会话，`sessionCount=1`，删除被 400 拒绝；解绑后删除成功、目录消失。
- 门禁：`pnpm test` **536 项全过**；`pnpm check` 0 错误 / 4 条既有警告；`pnpm lint` 448 文件 0 问题；`pnpm typecheck` 0；`pnpm build` 55 包。
- 尚未开始：Git 审查、媒体输出目录、右栏文件树仍按项目根解析；这些属于 P2，避免在半数调用方未切换时让界面显示错目录。

## 15. P2a 实施记录（2026-11-22）

P2a 完成：用户已经能从项目里创建并绑定工作树，但 Git 审查、媒体与文件树仍按项目根解析（P2b）。

- 入口：项目行「···」菜单新增「新建工作树会话」，弹窗填写分支与可选起点，创建后直接打开绑定该工作树的新会话。
- 展示：输入框上方新增「分支」chip，悬停显示完整路径；已存在会话同样显示，点 × 可解绑（提交 `worktreeId: null`，Host 与存储同步清理）。
- 草稿绑定：新会话草稿记录工作树摘要，发送时只提交 `worktreeId`；会话落库后以服务端快照为准。
- 项目详情：新增「工作树」区块，列出分支、目录、绑定会话数与未提交改动；有绑定会话时删除按钮禁用；缺失目录给出警告。
- 文案与主题：中英文案补齐，深浅色均使用主题语义变量；弹窗、chip、区块在三栏与窄屏下复用现有布局。
- 文件规模：`chat-store` 超过 500 行硬上限，拆出 `chat-store-data-facade.ts`；`ChatComposer` 超过 400 行，拆出 `ComposerTriggers.tsx`。
- 实测（独立 5174 + 沙盒 HOME + 无头 Chrome）：项目 → 新建工作树会话 → 默认分支 `lfaa/20261122-xxxx` → 创建成功 → 输入框显示分支 chip → 发送消息后会话记录带 worktree → 点 × 解绑后会话记录不再带 worktree；深/浅色截图见 `%TEMP%\lfaa-pw\worktree\`；控制台 0 错误。
- 门禁：`pnpm test` **540 项全过**；`pnpm check` 0 错误 / 4 条既有警告；`pnpm lint` 453 文件 0 问题；`pnpm typecheck` 0；`pnpm build` 55 包。
- P2b 待办：Git 审查、媒体输出目录、右栏文件树与文件读取切换到会话工作树；项目视图的再次进入入口当前仍受既有导航限制。

## 16. P2b 实施记录（2026-11-22）

P2b 完成 Git 审查切换，并补上工作树文件读取接口：

- Git 路由：`/api/git/status|diff|stage|unstage|branch|commit-draft|commit|pr-draft|revert-files` 接受可选 `sessionId`；Host 用 `resolveSessionWorkspace` 解析工作树目录，未传时沿用项目根。
- 右栏「变更」与顶栏 Git 摘要按会话工作树显示；主项目目录保持干净，不再把工作树改动混进项目根状态。
- 未跟踪文件预览：`getGitDiff` 在该文件没有 diff 时直接读取文本并返回新增行，避免前端绕道项目根读文件。
- 工作树文件接口：`GET /api/worktrees/:id/file?path=`，带目录边界、256KB 上限与二进制拦截；供 P2c 的文件树/预览接入。
- 实测：同一项目下工作树 `feature/scope` 显示 2 个改动、主目录 0 个；`only-wt.txt` 返回 `+wt`；工作树 README 返回工作树内容。
- 门禁：`pnpm test` **540 项全过**；`pnpm check` 0 错误 / 4 条既有警告；`pnpm lint` 453 文件 0 问题；`pnpm typecheck` 0；`pnpm build` 55 包。
- P2c 待办：右栏文件树与文件预览、媒体输出目录与素材允许根、完整代码审查页切换到工作树；以及项目视图再次进入入口。

## 17. P2c 实施记录（2026-11-22）

P2c 完成文件树/预览与媒体根切换：

- 文件树：`RightFileTreePane` 接受 `worktreeId`，改用 `/api/worktrees/:id/inspect`；展开状态按工作树 id 独立持久化。
- 文件预览：`FileChangePreview`、`CodeBreadcrumbBar`、`WorkspaceFileTabs`、`RightWorkbenchStart` 全部支持工作树；打开的文件 tab 记录 `worktreeId`，读取走 `/api/worktrees/:id/file`。
- 面包屑与侧栏文件树联动同样按工作树目录；工作树检查结果补 `rootPath` 别名兼容既有客户端，并过滤 `.git` 条目。
- 媒体：素材允许根加入所有已登记工作树目录；直连生图/生视频的输出根改用会话工作树（`resolveSessionWorkspaceRoots`）。
- 实测（独立 5174 + 沙盒 HOME + 无头 Chrome，深色）：文件树显示工作树独有的 `wt-only.ts`、不显示主目录的 `main-only.txt`；点击后预览显示 `export const wt = 1;`；控制台 0 错误；截图 `%TEMP%\lfaa-pw\worktree\09d-*`、`10b-*`。
- 门禁：`pnpm test` **540 项全过**；`pnpm check` 0 错误 / 4 条既有警告；`pnpm lint` 453 文件 0 问题；`pnpm typecheck` 0；`pnpm build` 55 包。另修正并发会话新增的 `file-icons.test.tsx` 中仍按旧结构匹配根节点的断言（组件已改为带色调容器）。
- P2d 待办：完整代码审查页（`CodeReviewView`）切换到工作树；项目视图再次进入入口；工作树合并/清理策略仍按 P3 评估。

## 18. P2d 实施记录（2026-11-22）

P2d 完成剩余界面接线：

- 完整代码审查页：`CodeReviewView` 接受 `boundSessionId`，Git 状态/差异/暂存/提交/分支/PR 草案都按会话工作树执行；审查报告服务仍按项目（报告本身是项目级产物）。
- 项目视图入口：项目行双击与「···」菜单「打开项目」都能回到项目详情；工作树列表与清理入口因此可再次进入。
- 分支说明：工作树记录新增 `baseRef`（HEAD 创建时解析成当前分支名）；项目详情显示「基于 main / 基于 xxx」，对话框补充“工作树必须使用独立分支，不能与主工作区共用 main”的说明，避免把新分支误认为起点分支。
- 实测（独立 5174 + 沙盒 HOME + 无头 Chrome，深色）：双击项目行进入项目详情，工作树区块与空态正常，控制台 0 错误；截图 `%TEMP%\lfaa-pw\worktree\11-dark-project-view.png`。
- 门禁：`pnpm test` **540 项全过**；`pnpm check` 0 错误 / 4 条既有警告；`pnpm lint` 453 文件 0 问题；`pnpm typecheck` 0；`pnpm build` 55 包。
- 后续：P3 合并回主分支、清理策略、携带未提交改动；均需单独评估。

## 19. P3a 实施记录（2026-11-22）

P3a 只做“看得见、可撤销”的合并辅助与清理，不做自动合并：

- 状态：`WorktreeStatus` 增加 `ahead` / `behind`（相对 `baseRef...HEAD`），项目详情显示「领先 X / 落后 Y」。
- 合并辅助：项目详情每个工作树提供「复制合并命令」（`git switch <base>` + `git merge --no-ff <branch>`），由用户在主工作区自行执行；不自动切分支、不自动合并。
- 清理：`POST /api/worktrees/prune` 清理目录已不存在的登记记录并执行 `git worktree prune`；项目详情在存在失效记录时显示「清理失效记录」。
- 测试：工作树提交后 `ahead=1/behind=0`；外部删除目录后 `prune()` 返回 1 且列表清空。
- 门禁：`pnpm test` **541 项全过**；`pnpm check` 0 错误 / 4 条既有警告；`pnpm lint` 458 文件 0 问题；`pnpm typecheck` 0；`pnpm build` 通过。
- 未做：自动合并/冲突处理、合并后自动删分支、携带主工作区未提交改动；这些仍属独立决策。

## 20. P3b 实施记录（2026-11-22）

P3b 增加只读合并预演，仍然不自动合并：

- 服务：`previewMerge(id)` 用 `git merge-tree --write-tree --name-only <base> <branch>` 判断能否干净合并；同时读取主工作区当前分支与未提交改动。只读，不切分支、不写索引。
- HTTP：`POST /api/worktrees/:id/merge-preview`，返回 `WorktreeMergePreview`（`clean`、`conflicts`、`upToDate`、`mainDirty`、`baseBranchCheckedOut`）。
- UI：项目详情每个工作树增加「合并预演」按钮，显示「可干净合并 / 有冲突: 文件 / 已包含全部提交」，并提示主工作区脏或不在起点分支。
- 测试：工作树提交后预演 `upToDate=false`、`clean=true`、冲突为空；工作树目录测试 11 项通过。
- 实测（独立 5174 + 沙盒 HOME + 无头 Chrome，深色）：项目详情显示「基于 main · 领先 1 / 落后 0」，点击预演显示「可干净合并」，控制台 0 错误；截图 `%TEMP%\lfaa-pw\worktree\12-dark-merge-preview.png`。
- 门禁：`pnpm test` **541 项全过**；`pnpm check` 0 错误 / 4 条既有警告；`pnpm lint` 458 文件 0 问题；`pnpm typecheck` 0；`pnpm build` 通过。
- 仍未做：自动合并/冲突解决、合并后自动删分支、携带未提交改动。

## 21. P3c 实施记录（2026-11-22）

- 侧栏会话行新增工作树分支小标签（`branchLabel`），悬停显示完整目录；不占用原时间提示位置，窄屏自动截断。
- 实测（独立 5174 + 沙盒 HOME + 无头 Chrome，深色）：绑定 `feature/badge` 的会话在侧栏显示同名分支标签，控制台 0 错误；截图 `%TEMP%\lfaa-pw\worktree\13-dark-session-branch-badge.png`。
- 门禁：`pnpm test` **541 项全过**；`pnpm check` 0 错误 / 4 条既有警告；`pnpm lint` 458 文件 0 问题；`pnpm typecheck` 0；`pnpm build` 通过。

## 22. 安全收尾（2026-11-22）

- 失效记录清理只移除“目录不存在且没有会话绑定”的记录；仍被会话引用的记录保留，让用户看到失效警告并主动解绑。
- 工作树区块的错误文案细分：读取失败、预演失败、复制失败分别提示；未提交改动数改用本地化单位。
- 侧栏分支标签样式拆到独立 CSS module，避开 `SidebarSectionList.module.css` 400 行硬上限。
- 测试：绑定会话的失效记录 `prune()` 不删除，解绑后才清理。
- 门禁：`pnpm test` 541 项全过；`pnpm check` 0 错误 / 4 条既有警告；`pnpm lint` 458 文件 0 问题；`pnpm typecheck` 0；`pnpm build` 通过。

## 24. 创建前提示起点与未提交改动（2026-11-22）

- 服务：`repositoryInfo(projectId)` 返回主工作区仓库根、当前分支与未提交改动数；`GET /api/worktrees/repository?projectId=`。
- UI：创建弹窗显示「基于 main」；主工作区有未提交改动时显示「主工作区有 N 处未提交改动，不会带进新工作树」。
- 测试：未改动时 `dirtyCount=0`，主目录新增文件后为 1。
- 实测（独立 5174 + 沙盒 HOME + 无头 Chrome，深色）：弹窗同时显示「基于 main」与脏改动警告，控制台 0 错误；截图 `%TEMP%\lfaa-pw\worktree\14-dark-dirty-warning.png`。
- 附：并发会话再次把 `FileChangePreview.tsx` 加到 404 行，已在不改行为的前提下压缩注释按钮/提示的排版，回到 397 行，`check` 恢复 0 错误。
- 门禁：`pnpm test` **545 项全过**；`pnpm check` 0 错误 / 4 条既有警告（55 包 471 源文件）；`pnpm lint` 460 文件 0 问题；`pnpm typecheck` 0；`pnpm build` 通过。

## 23. P3d：移除并删除已合并分支（2026-11-22）

- 服务：`removeAndDeleteBranch(id)` 先按既有规则移除工作树，再用 `git branch -d` 安全删除分支；未合并分支由 Git 拒绝并保留，返回原因。
- HTTP：`DELETE /api/worktrees/:id?deleteBranch=1`。
- UI：项目详情仅在「无绑定会话、无领先提交、目录存在」时显示「移除并删分支」，二次确认后执行；未提交改动仍会阻止删除。
- 测试：已合并分支删除成功；未合并分支保留并返回“分支未合并，已保留”。
- 备注：收尾时 `pnpm build` 曾被并发会话正在编辑的 `FileChangePreview.tsx`（编码损坏 + JSX 不平衡）阻塞；该文件已由并发会话修复，随后把行内搜索高亮拆到 `file-search-highlight.tsx`，使其回到 400 行以内，`pnpm check` / `typecheck` / `build` 恢复全绿。
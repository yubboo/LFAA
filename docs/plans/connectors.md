# 连接器（Connectors）：MCP 与 CLI 统一入口方案

状态：**已实施（P0，2026-11-26）**。负责人确认「按推荐来」：MCP 编辑页 P0 并入连接器页、示例用 `gh` / `docker` / `pnpm`、P0 连接器级信任、CLI 默认工作目录跟随项目根。实施结果与偏差见文末 §12；现状说明沉淀在 [features/connectors.md](../features/connectors.md)。
关联：`@lfaa/mcp`（现有 MCP 能力）、`@lfaa/client-ui-connectors`（连接器设置页）、DEV-000511（浏览器设置体系，可复用原生选择器）

## 1. 背景

- 负责人指出 LFAA「没有做连接器」，并明确连接器包含两类：**MCP** 与 **CLI**。
- 现状核对：MCP 其实已经做完，只是入口叫「MCP」、藏在设置中心「集成」里，且没有 CLI 类型，也没有把两者摆在一起的「连接器」概念。空列表页容易被误读成「没做」。
- CLI 一侧完全没有：智能体只能通过 `shell` / 终端工具直接跑命令，没有「声明式 CLI 连接器」——没有动作清单、没有参数 schema、没有逐动作审批、没有健康检查、没有环境变量/凭据引用。

### 1.1 现有 MCP 能力（不重做）

| 能力 | 实现位置 |
|---|---|
| stdio / Streamable HTTP / SSE 三种传输 | `packages/extension/mcp/src/connection.ts` |
| 工具注册 `mcp__<server>__<tool>`、逐工具信任、项目范围 | `mcp-service.ts` |
| 配置持久化 | `~/.lfaa/mcp-servers.json`（`config-store.ts`） |
| 导入 Claude Desktop / Cursor 的 `mcpServers` JSON | `server-config.ts#parseImport` |
| 测试、重连、状态 | `mcp-service.ts` |
| 设置页与编辑弹窗 | `packages/client/ui-mcp/client/**` |
| HTTP 路由 `/api/mcp/servers` | `mcp-routes.ts`，挂载在 `packages/host/web-server/src/runtime.ts` |

### 1.2 参考基座（DSH）的做法

- DSH 没有「connector」抽象：MCP 由 `dsh-mcp-client`（连接 + 注册工具）与 `dsh-mcp-manager`（配置驱动的多实例、状态、重启、探测）组成；CLI 由 `dsh-tool-bash` / `dsh-tool-pwsh` 直接执行，技能（skill）负责写清用法。
- 也就是说，参考基座把「连接」与「命令行」分开治理，没有做我们这次要做的统一目录与声明式 CLI 动作。这决定了本方案是**改造适配 + 自研**，不是照搬。

## 2. 目标与非目标

### 目标（P0）

1. 新增设置中心「集成 → 连接器」页：一个列表同时管理 **MCP 服务器** 与 **CLI 工具**，显示状态、工具数、启停、测试。
2. 新增 **CLI 连接器** 类型：声明可执行文件 + 若干「动作」（argv 模板 + 参数 schema），把每个动作注册成智能体工具。
3. 提供 3 个内置示例模板：`gh`、`docker`、`pnpm`。
4. 安全边界：不经过 shell、参数强类型校验、逐次审批、超时与输出上限、进程树回收。
5. 迁移：`packages/client/ui-mcp` 合并为 `packages/client/ui-connectors`，MCP 功能不回归。

### 非目标（P0）

- 连接器市场 / 远程目录（MCP Registry 导入、在线安装 CLI）。
- 远程 MCP 的 OAuth 授权流程（当前只支持静态 header）。
- CLI 二进制的自动安装与版本管理。
- 重构 `@lfaa/mcp` 的内部实现（只做适配与聚合）。

## 3. 调研与参考

- 问题与关键词：connectors、MCP client tools、CLI as tool、argv template、tool approval、MCP registry server.json。
- 项目内已有实现：
  - `@lfaa/mcp` 的配置校验、工具注册与信任模型（`server-config.ts`、`mcp-service.ts`）可直接复用到 CLI 动作；
  - `@lfaa/tools` 的 `AgentToolDefinition`（`permissionLevel` / `approval` / `parameters` JSON Schema）就是 CLI 动作要落到的契约；
  - 设置中心目录（`packages/ui/layout/client/panels/settings-catalog.ts`）与视图注册（`ctx.workbench.registerView`）决定新页怎么进「集成」；
  - 浏览器设置的目录选择器（`/api/workspace/pick-folder`）可复用到「工作目录」。
- 外部来源（查阅 2026-11-26）：
  - MCP 规范 `tools`：工具由 `name` / `description` / `inputSchema`（JSON Schema）描述，调用走 `tools/call`，并建议调用时给出确认提示——CLI 动作的 schema 与审批直接对齐这一套。<https://modelcontextprotocol.io/specification/2025-11-25/server/tools>
  - MCP Registry 的 `server.json`：用标准化元数据描述「去哪拿、怎么跑、要哪些环境变量」，与我们要写的 CLI 连接器清单同构，可借鉴字段命名。<https://modelcontextprotocol.io/registry/about>
  - Anthropic 连接器文档：目录连接器与自定义连接器本质都是 MCP server，差别在审核、发现与分发；说明「连接器」对用户是统一入口，后端可以是多种实现。<https://claude.com/docs/connectors/building/directory-vs-custom>
  - GitHub CLI `gh pr list` 手册：`--json <fields>`、`--limit`、`--state` 等标志适合作为示例动作的参数来源。<https://cli.github.com/manual/gh_pr_list>
  - 参考基座已装版本（DSH）：`dsh-mcp-client` / `dsh-mcp-manager` / `dsh-tool-bash` 的职责切分，见本机 `dsh-doc` 技能 `references/packages.md`；无「connector」抽象。
- 候选方案与取舍：
  - **A. 维持现状（MCP 页 + shell 工具）**：零成本，但 CLI 无声明、无审批、无工具化，负责人明确否。
  - **B. 只做 CLI 连接器，另开一页**：改动最小，但入口分散、用户仍要记住两个地方；与「统一连接器」的目标冲突。
  - **C. 新增 `@lfaa/connectors` 聚合服务 + CLI 提供者，UI 合并为 `ui-connectors`（采用）**：一处管理、MCP 既有能力复用、CLI 走同一套工具契约。
  - **D. 把一切（含 CLI）都塞进 `@lfaa/mcp`**：语义错位，MCP 是协议不是执行器；后续加第三种连接器（如 HTTP webhook）会再次打架。
  - **E. 用「自由命令行」代替动作模板**：实现最省事，但无法给模型稳定 schema、无法逐动作审批，注入面也更大，否。
- 结论：**C + 动作模板**。MCP 保持原实现，只做适配聚合；CLI 用声明式动作落到 `@lfaa/tools` 契约。
- 许可、维护与安全：无新增第三方依赖；`gh` / `docker` / `pnpm` 仅作为模板数据，不捆绑二进制；执行侧只用 Node 内置 `child_process`，无 shell。

## 4. 概念与数据模型

### 4.1 两类连接器

| 类型 | 后端 | 工具命名 | 配置落盘 |
|---|---|---|---|
| `mcp` | 现有 `@lfaa/mcp`（stdio / http / sse） | `mcp__<server>__<tool>` | `~/.lfaa/mcp-servers.json`（不变） |
| `cli` | 本机可执行文件 + 动作模板 | `cli__<connectorId>__<actionId>` | `~/.lfaa/connectors.json`（新增） |

### 4.2 CLI 连接器配置

```jsonc
{
  "id": "gh",
  "kind": "cli",
  "name": "GitHub CLI",
  "description": "用 gh 查询和操作 GitHub",
  "enabled": true,
  "projectId": null,
  "trust": "ask",
  "executable": "gh",
  "cwd": "",
  "env": { "GH_TOKEN": "${env:GH_TOKEN}" },
  "probeArgs": ["--version"],
  "actions": [
    {
      "id": "pr_list",
      "title": "列出 Pull Request",
      "description": "按状态列出当前仓库的 PR",
      "readOnly": true,
      "argv": ["pr", "list", "--json", "number,title,author,state", "--limit", "{{limit}}", { "arg": "--state", "value": "{{state}}" }],
      "params": {
        "limit": { "type": "number", "description": "最多返回条数", "default": 20 },
        "state": { "type": "string", "description": "PR 状态", "enum": ["open", "closed", "merged", "all"] }
      }
    }
  ]
}
```

- `argv` 每项是字面量或对象：`{ "arg": "--state", "value": "{{state}}" }`；`when`（可选）只能引用布尔参数，用于条件拼接（如 `{"arg": "--draft", "when": "draft"}`）。
- 占位符只能引用已声明参数，保存时校验；未声明的占位符直接拒绝，避免拼错后静默变空。
- 必填参数进 JSON Schema `required`；`enum` 进 `enum`，模型拿到的就是强类型工具。
- `env` 值支持 `${env:NAME}` 引用宿主环境变量，**不明文落盘密钥**；P1 接凭据库后再支持 `${secret:NAME}`。
- `readOnly: true` 的动作注册为 `permissionLevel: "read"`，其余为 `"exec"`；审批级别由连接器 `trust` 决定（`trusted` 才免审批）。

### 4.3 连接器摘要（列表返回）

```ts
interface ConnectorSummary {
  id: string;
  kind: "mcp" | "cli";
  name: string;
  enabled: boolean;
  projectId: string | null;
  trust: "ask" | "trusted";
  status: "disabled" | "connecting" | "ready" | "error";
  detail: string;                    // mcp: 传输/地址摘要；cli: 可执行文件与版本
  tools: Array<{ name: string; title: string; trust: "ask" | "trusted" | "inherit" }>;
}
```

## 5. 架构

### 5.1 包与依赖（P0）

| 动作 | 包路径 | 说明 |
|---|---|---|
| 新增 | `packages/extension/connectors` | 连接器聚合服务 + CLI 连接器实现 + 路由 + 模板 |
| 重命名 | `packages/client/ui-mcp` → `packages/client/ui-connectors` | 合并 MCP 页与新的 CLI 管理；包名与标题改为「连接器」 |
| 修改 | `packages/extension/mcp` | 仅导出/补一个只读适配点（不改变行为） |
| 修改 | `packages/bundle/web` | 装配 `@lfaa/connectors`，全量预设包含它 |
| 修改 | `packages/host/web-server` | 注册 `/api/connectors/*` 路由 |
| 修改 | `packages/ui/layout` | `settings-catalog` 的「集成」项：`settings:mcp` → `settings:connectors` |
| 修改 | 根 `tsconfig.host.json` / `pnpm-workspace.yaml` / 包 README 三件套 | 重命名后跑 `pnpm sync` 与 `pnpm readme:pair`，并改 `scripts/verify-web.mts` 里 MCP 页的选择器 |

依赖方向：`extension/connectors` → `@lfaa/tools`（核心契约）、`@lfaa/mcp`（适配既有服务）；UI 包只走 HTTP，不 import 能力包实现。

### 5.2 Cordis 服务

```ts
// connectorsPlugin.inject = ["tools", "mcp"]
class ConnectorService extends Service {
  list(): ConnectorSummary[];                       // MCP 适配 + CLI 配置合并
  saveCli(id: string, patch: unknown): Promise<void>;
  remove(id: string): Promise<void>;
  test(id: string): Promise<{ ok: boolean; detail: string }>;
  probe(executable: string): Promise<{ path: string; version: string } | { error: string }>;
  dispose(): void;                                  // 注销全部 CLI 工具
}
```

- CLI 连接器启动时按配置注册工具；`ctx.effect` 里统一注销，热重载/卸载不留残余工具。
- MCP 侧只读：状态与工具数来自 `ctx.mcp.list()`；MCP 的增删改仍走原页面与 `/api/mcp/servers`。
- 配置文件写入复用「临时文件 + rename」的原子写法（与 `browser-settings.ts` 同款）。

### 5.3 HTTP

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/connectors` | 列表（MCP + CLI 摘要） |
| GET | `/api/connectors/templates` | 3 个内置模板 |
| POST | `/api/connectors` | 新建 CLI 连接器（可带 `templateId` 预填） |
| PATCH | `/api/connectors/:id` | 修改 CLI 连接器（含动作） |
| DELETE | `/api/connectors/:id` | 删除 CLI 连接器 |
| POST | `/api/connectors/:id/test` | 探测可执行文件并跑 `probeArgs` |
| POST | `/api/connectors/probe` | 添加前探测任意可执行文件 |

### 5.4 执行链路（安全）

1. 参数按 schema 校验（类型、枚举、必填），不合法直接拒绝，不进入 spawn。
2. argv 逐项替换占位符；每个参数始终是**独立 argv 元素**。
3. `spawn(executable, argv, { shell: false, cwd, env: { ...process.env, ...resolvedEnv }, windowsHide: true })`。
4. 超时（默认 60s，动作可配）→ 杀进程树（Windows `taskkill /T /F`，其余进程组信号）。
5. 输出按流截断（各 256 KiB，保留尾部并标注截断）；结果走 `ToolExecutionResult`。
6. 取消（`context.signal`）同样触发进程树回收。

## 6. 界面（设置中心 → 集成 → 连接器）

- **列表**：按类型分两组（MCP 服务器 / 命令行工具）。每行：名称 + 类型标签、状态点、工具数、右侧「测试 / 管理 / 启用开关」。空态一句话：「添加 MCP 服务器或命令行工具，让智能体用上外部能力。」
- **添加连接器**：右上角按钮 → 菜单两项「MCP 服务器」（打开现有 MCP 编辑弹窗）、「命令行工具」（新弹窗）。
- **CLI 编辑弹窗**：
  - 基本信息：名称、可执行文件（带「探测」按钮，显示解析路径与版本）、工作目录（原生目录选择器）、环境变量（键名 + `${env:NAME}` 或值）。
  - 动作：卡片列表，每个动作编辑 id / 标题 / 说明 / 只读 / argv（逐行）/ 参数表（名称、类型、说明、必填、枚举）。
  - 从模板新建时预填动作，用户可删改。
- **MCP 部分**：原 MCP 页内容整体作为连接器页的一个分组/子页，编辑弹窗与导入 JSON 原样保留。
- 深浅色、760px 窄屏、键盘焦点均按设置中心规范；不新增写死颜色。

## 7. 内置示例（3 个模板）

| 模板 | 动作 | 说明 |
|---|---|---|
| `gh` | `pr_list`（只读）、`pr_view`（只读）、`issue_list`（只读）、`repo_view`（只读） | `--json` 输出，`GH_TOKEN` 走 `${env:GH_TOKEN}` |
| `docker` | `ps`（只读）、`images`（只读）、`logs`（只读）、`compose_up`（执行） | `compose_up` 需要信任或逐次审批 |
| `pnpm` | `list`（只读）、`outdated`（只读）、`run_script`（执行） | `run_script` 的 `script` 参数来自 `enum`，避免任意命令 |

模板只预填配置，不安装二进制；探测失败时在弹窗里明确提示「未找到 gh，请先安装或填写完整路径」。

## 8. 分期

- **P0（本方案范围）**：`@lfaa/connectors` + CLI 连接器 + MCP 只读聚合 + 连接器页（`ui-connectors`）+ 3 模板 + 路由 + 测试。
- **P1（已实施 2026-11-26）**：MCP 编辑已随 P0 并入连接器页；CLI 动作级信任；连接器导入/导出 JSON。剩余：`${secret:NAME}` 凭据库、状态轮询与错误详情。
- **P2**：连接器目录（MCP Registry / 远程 index）、远程 MCP OAuth、CLI 一键安装、按工作区共享连接器。

## 9. 验收标准（P0）

1. 设置中心 → 集成 → 连接器：MCP 服务器与命令行工具分组正确，空态与有数据态都正常。
2. 从模板新建 `gh` → 探测到路径与版本 → 保存并启用 → 工具列表出现 4 个 `cli__gh__*`。
3. 会话内调用 `cli__gh__pr_list`：未信任时弹审批；执行后返回 JSON；超长输出被截断并标注。
4. 注入用例：参数值为 `x; rm -rf /` 时按单个 argv 传入，不执行第二条命令（回归测试固化）。
5. 超时用例：动作超过设定时间被终止，进程树无残留。
6. 关闭连接器后工具立即从会话工具表消失，再次调用返回未知工具。
7. MCP 既有服务器仍出现在列表中，状态/工具数与 MCP 页一致，MCP 编辑与导入不回归。
8. 深浅色与 760px 窄屏截图验收；`pnpm lint`、`pnpm typecheck`、`pnpm check`、`pnpm verify:web` 通过（并发会话造成的失败需单列）。

## 10. 风险与回滚

- **命令执行风险**：只允许声明式动作，参数不拼 shell；仍可能执行破坏性命令（如 `docker compose down -v`），靠「默认逐次审批 + 只读动作标记」兜底；连接器级 `trusted` 需用户显式开启。
- **密钥落盘**：P0 只做 `${env:NAME}` 引用，配置文件不存明文；P1 接凭据库。
- **Windows 引用与编码**：`spawn` 使用 argv 数组 + `windowsHide`，不经过 `cmd`；非 UTF-8 输出按流解码并标注乱码可能。
- **回滚**：删除 `@lfaa/connectors` 与 `ui-connectors` 的 CLI 部分，恢复 `ui-mcp` 包名与 `settings:mcp` 目录项即可；`~/.lfaa/connectors.json` 是新增文件，删除不影响既有数据。
- **兼容**：MCP 配置文件与工具命名不变；会话中已保存的 MCP 工具引用不受影响。

## 11. 待负责人确认

1. **MCP 页迁移时机**：P0 就把 MCP 编辑整体并入连接器页（推荐），还是 P0 只做只读聚合、P1 再搬？
2. **示例选型**：`gh` / `docker` / `pnpm` 是否合适？是否需要换成 `ffmpeg`、`az`、`kubectl` 等更贴近你日常的组合？
3. **信任粒度**：P0 先做连接器级信任（推荐，简单），动作级信任放 P1？
4. **工作目录默认值**：默认跟随当前项目根（推荐），还是默认用户主目录、由每个连接器显式指定？
## 12. 实施结果（P0，2026-11-26）

- 交付：`@lfaa/connectors`（聚合服务、CLI 执行、模板、路由、加密配置、5 条回归）、`@lfaa/client-ui-connectors`（连接器页 + CLI 编辑弹窗，原 `ui-mcp` 合并而来）、装配（bundle 预设 / web 插件 / `/api/connectors` 路由）、设置目录与截图任务。
- 与方案的偏差：
  1. 页内用**分段**（MCP 服务器 / 命令行工具）而不是同页两个分组：每个分区各自带「删除」危险组，避免一页出现两个危险组；默认停在 MCP，选择记忆在 `lfaa:settings-connectors-tab`。
  2. 配置**整体加密**落盘（沿用 MCP 的 AES-256-GCM + 本机 `.key`），不只依赖 `${env:NAME}`；环境变量仍支持引用宿主变量。
  3. 新增 `GET /api/connectors/:id`：列表只返回摘要，编辑弹窗需要回填动作与环境变量。
  4. 命令缺失时连接器状态为 `error` 且**注册 0 个工具**，列表不再按动作数虚报工具数。
  5. `${secret:NAME}`、动作级信任、导入导出、目录与 OAuth 仍留在 P1/P2。
- 验证：`@lfaa/connectors` 单测 5/5（含 argv 注入、超时回收、模板新建与 HTTP 全流程）、预设兼容用例 6/6、`pnpm lint` 0 问题、`verify:web` 23/23、设置页嵌入式浏览器实测（模板新建 → 编辑回填 → 删除）0 控制台报错。

## 13. P1 实施结果（2026-11-26）

- 动作级信任：`CliActionConfig.trust` 可覆盖连接器设置（缺省继承）；工具 `approval` 取 `action.trust ?? connector.trust`；列表工具摘要显示动作级信任。
- 导入 / 导出：新增 `POST /api/connectors/import`（单个对象 / 数组 / `{ connectors: [...] }`，导入项强制停用、重名拒绝、单次上限 20 条）；导出在界面侧基于 `GET /api/connectors/:id` 展示 JSON，可复制或下载，并提示内容包含环境变量字面值。
- 界面：动作卡片新增「审批：继承连接器 / 每次确认 / 始终允许」；CLI 分区头部新增「导入」，行内新增「导出」；导入/导出各一个弹窗。
- 验证：连接器单测 7/7（新增动作级审批、导入去重与停用、HTTP 导入路由）、界面实测（导入 → 启用 → 改动作审批 → 导出复制 → 删除）0 控制台报错、`verify:web` 23/23、`pnpm lint` 0 问题。

## 14. 目录改版（2026-11-26，负责人确认）

负责人指出当前「行式列表」不是连接器该有的形态，并给出参考产品截图：连接器页是**卡片目录**（搜索、分类、每张卡带「+」、已连接状态、详情浮层含「试试这样用」和「关于」、点「+」后「正在下载… → 已连接」）。已确认：内置精选 20+ 且真实可连；CLI 支持一键静默安装；行式列表保留为「我的连接器」。

### 14.1 页面结构

- 顶部：标题 + 搜索框 + 「自定义连接器」菜单（MCP 服务器 / 命令行工具 → 复用现有创建弹窗）。
- 一级分段：**目录** / **我的连接器**（记忆在 `lfaa:settings-connectors-view`）。
- 目录：类型筛选（全部 / MCP / CLI）+ 分类（全部 / 热门 / 开发 / 办公 / 数据 / 系统）+ 卡片网格（`auto-fill, minmax(16rem, 1fr)`）；每卡：图标、名称、两行说明、类型标签，右侧「+」或已连接圆点 + `···` 菜单（立即试用 / 设置 / 卸载）。
- 卡片点击打开详情浮层：大图标、名称、说明、「连接」或「已连接 → 去试试 / 解绑」、试试这样用（示例点击复制）、使用的应用（MCP 命令 / CLI 可执行文件）、关于（类别 / 开发者 / 版本 / 网站 / 隐私政策）。
- 我的连接器：保留现有 MCP / CLI 两个分区、导入导出、删除组。

### 14.2 目录数据（内置）

- 新增 `packages/extension/connectors/src/connector-catalog.ts`，条目字段：id、名称、说明、emoji 图标、分类、是否热门、kind（`mcp` / `cli`）、开发者、版本、网站、示例提示、输入项（目录 / 密钥）、连接定义。
- MCP 条目使用官方/公开 npm 包（已核对 npm 版本）：filesystem、memory、sequential-thinking、everything、playwright、chrome-devtools、context7、github、gitlab、brave-search、postgres、slack、google-maps、redis、puppeteer、notion、supabase 等，`npx -y <pkg>` 首次运行即完成下载。
- CLI 条目：git、gh、pnpm、docker、rg、jq、ffmpeg、kubectl、az、uv；动作沿用声明式模型（argv + 参数），安装方式按可用安装器选择。
- 品牌图标不随包分发（商标与体积），首版用 emoji + 主题色块，后续可换包内 SVG。

### 14.3 连接 / 下载

- `POST /api/connectors/catalog/:id/connect`：创建后台任务，返回 `jobId`；客户端轮询 `GET /api/connectors/jobs/:jobId` 展示「正在下载连接器 X…」。
- MCP：写入 `mcp-servers.json`（enabled、`trust: ask`、输入项进 env/args），再轮询 MCP 状态直到 connected / error（超时 180s）；`npx` 首次拉包即「下载」。
- CLI：先探测可执行文件；缺失则按 `winget → choco → scoop → npm` 选可用安装器静默安装（winget 同时检查 PATH 与 `%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe`），安装后重新探测并写连接器。
- 断连：目录条目统一删除对应 MCP 服务器或 CLI 连接器。
- 安全：安装命令只来自内置目录、参数固定，不接受自由输入；连接所需密钥走密码输入框，写入 MCP / 连接器的加密存储。

### 14.4 验收

卡片目录在浅色/深色/760 窄屏正常；搜索与筛选生效；点「+」出现进度提示并最终变为已连接；详情浮层示例可复制；「我的连接器」原功能不回归；`pnpm verify:web` 与内嵌浏览器实测通过。

## 15. 目录改版实施结果（2026-11-26）

- 交付：内置目录 27 条（17 MCP + 10 CLI），`npx -y <pkg>` 首次连接即下载；CLI 缺命令时按 winget → choco → scoop → npm 静默安装（winget 兼容 `%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe` 别名路径），安装参数固定来自目录。
- 页面：目录 / MCP 服务器 / 命令行工具三段页签；目录含搜索、类型与分类筛选、卡片网格、连接中状态、详情浮层（示例复制、使用的应用、关于、卸载）、自定义连接器菜单跳页并自动打开新建。
- 任务：`POST /catalog/:id/connect` 返回 jobId，客户端 0.9s 轮询；MCP 等 connected 最长 180s，安装最长 20 分钟；同一目标只允许一个进行中任务，任务表保留最近 50 条。
- 实测：Git 点 + 直接连上；记忆图谱经 npx 下载后连上；文件系统连接弹窗出现目录选择；自定义连接器切页并打开弹窗；0 控制台报错。
- 与方案的偏差：①目录数据内置而非远程 index（负责人选定）；②分类筛选用 chip 行而不是分区标题，点已选分类取消；③图标用 emoji，不随包分发品牌素材；④任务状态存内存，宿主重启会丢失进行中的进度。
- 未做：远程目录、OAuth、独立凭据库、健康轮询；`${secret:NAME}` 仍由连接弹窗直接写入加密配置替代。

## 16. 会话可见性修复（2026-11-26）

- 现场：旧会话里模型回答「没有 cli__git__status」，但 `/api/tools` 与作用域单测都正常 —— 问题在会话保存的 `sessionModules` 缺 `@lfaa/connectors`。
- 原因：`resolveLegacySessionModules` 只在清单与旧默认值完全一致时才升级，历史版本缺过 crew / mcp / connectors 任一模块就原样返回。
- 修复：清单完全由内置模块组成即补齐 `@lfaa/tool-media`、`@lfaa/mcp`、`@lfaa/connectors`，保留用户去掉的其它模块；CLI 工具描述补「连接器名 + 本机命令」。
- 验证：真实 agent 回合由「没有该工具」变为成功调用并回传 `git status` 输出；presets 单测 7/7、连接器单测 10/10、verify:web 23/23。

### 16.1 真实连接（同日追加）

- CLI 连接前真实执行一次 `probeArgs`（docker `info`、kubectl `version --client`、其余 `--version`），失败不落配置。
- 目录卡片显示真实工具数（MCP 来自服务器 tools/list），详情「测试」重新执行并回显路径与版本；连接成功消息带版本或工具数。

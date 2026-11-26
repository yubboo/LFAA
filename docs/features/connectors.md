# 连接器（MCP + CLI）

状态：**P0/P1 + 目录改版已实施（2026-11-26）**。设置中心「集成 → 连接器」默认是**卡片目录**：内置 27 个连接器，点「+」自动下载 / 安装并连接；「MCP 服务器」「命令行工具」两个页签是已连接项与自定义项的完整管理页。方案见 [plans/connectors.md](../plans/connectors.md) §12–§15。

## 1. 为什么是两类

- **MCP 服务器**：协议客户端，工具由服务器自己声明（`mcp__<server>__<tool>`），能力已经完整（stdio / Streamable HTTP / SSE、逐工具信任、项目范围、导入 JSON）。
- **CLI 工具**：本机可执行文件 + 一组「动作」。每个动作声明 argv 模板与参数 schema，注册为 `cli__<connector>__<action>` 工具。它解决的是「智能体只有裸 shell」的问题：动作可审批、参数有类型、输出有上限。

目录里的每个条目都声明自己属于哪一类，卡片上的 `MCP` / `CLI` 标签就是它连接后的形态。

## 2. CLI 连接器模型

```jsonc
{
  "id": "gh",
  "name": "GitHub CLI",
  "executable": "gh",
  "cwd": "",
  "env": { "GH_TOKEN": "${env:GH_TOKEN}" },
  "trust": "ask",
  "actions": [
    {
      "id": "pr_list",
      "title": "列出 Pull Request",
      "readOnly": true,
      "argv": ["pr", "list", "--json", "number,title,author,state,url", "--limit", "{{limit}}"],
      "params": {
        "limit": { "type": "number", "description": "最多返回条数（1–100）", "default": 20 }
      }
    }
  ]
}
```

- `argv` 每项是字面量，或 `{ "arg": "--state", "value": "{{state}}", "when": "draft" }`；`when` 只能引用布尔参数。
- 参数支持 `string` / `number` / `boolean` 与 `enum`、`default`、`required`，直接映射成工具的 JSON Schema。
- 审批支持两层：连接器级 `trust`，以及动作级 `trust`（缺省继承连接器）。动作级可单独放开只读查询、同时把写动作留在逐次确认。
- 保存时校验：连接器与动作 id 的字符集、占位符必须引用已声明参数、`when` 必须是布尔参数、`cwd` 必须是绝对路径、环境变量名合法。
- `readOnly: true` 的动作注册为 `permissionLevel: "read"`，其余为 `"exec"`。

## 3. 执行与安全

- 进程：`spawn(executable, argv, { shell: false, windowsHide: true })`，参数永远是独立 argv 元素，不经过 shell。
- 截图与回归用例覆盖注入：参数值 `hello; echo pwned && rm -rf /` 会作为单个参数原样传入。
- 超时：默认 60 秒，动作可配 1–300 秒；超时或取消时结束进程树（Windows `taskkill /T /F`，其余平台杀进程组）。
- 输出：stdout / stderr 各保留末尾 256 KiB，超出标注「输出已截断」。
- 环境变量：值支持 `${env:NAME}`，从宿主环境读取，不把密钥写进配置；配置整体用本机独立密钥加密保存在 `~/.lfaa/connectors.json`（`.key` 与 MCP 同款）。
- 命令缺失：连接器状态为 `error`、detail 显示「未找到 xxx」，且不注册任何工具。
- 真实探测：目录连接前会真正执行一次 `probeArgs`（Docker 用 `info` 验证守护进程、kubectl 用 `version --client`，其余默认 `--version`）；失败直接报错且不写入配置，避免「看起来连上、实际跑不动」。
- 真实工具数：目录卡片与详情显示服务器实际声明的工具数；CLI 动作数以注册结果为准，详情里的「测试」会重新执行命令并回显路径与版本。

## 4. 接口

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/connectors` | 列表（MCP + CLI）、内置模板与目录状态 |
| GET | `/api/connectors/:id` | 单个 CLI 连接器的完整配置（编辑回填） |
| POST | `/api/connectors` | 新建（可带 `templateId` 预填） |
| PATCH | `/api/connectors/:id` | 更新 |
| DELETE | `/api/connectors/:id` | 删除 |
| POST | `/api/connectors/:id/test` | 探测可执行文件并运行 `probeArgs` |
| POST | `/api/connectors/probe` | 添加前探测任意可执行文件 |
| POST | `/api/connectors/import` | 导入单个对象、数组或 `{ connectors: [...] }`；导入项一律停用 |
| GET | `/api/connectors/catalog` | 目录条目 + 每个条目的连接状态 |
| POST | `/api/connectors/catalog/:id/connect` | 启动连接任务（安装 / 下载 + 连接），返回 `job` |
| DELETE | `/api/connectors/catalog/:id` | 断开并移除该条目的 MCP 服务器或 CLI 连接器 |
| GET | `/api/connectors/jobs/:jobId` | 查询连接任务进度（running / done / error + message） |

服务在 Host 侧是 `@lfaa/connectors`（Cordis 服务名 `connectors`，注入 `tools` 与 `mcp`）；MCP 的增删改仍走 `/api/mcp/servers`，连接器只做只读聚合。

## 5. 界面

- 页签三段：**目录** / **MCP 服务器** / **命令行工具**，默认停在目录，选择记忆在 `lfaa:settings-connectors-tab`。
- 目录：搜索框 + 「自定义连接器」菜单（跳到对应页签并打开新建弹窗）；类型筛选（全部 / MCP / CLI）与分类筛选（热门 / 开发 / 办公 / 数据 / 系统，点已选项取消）；卡片网格 `auto-fill, minmax(16.5rem, 1fr)`。
- 卡片：emoji 图标、名称、两行说明、类型标签；未连接显示「+」，连接中显示转圈，已连接显示状态点、「N 个工具」与「···」（打开详情）。已连接卡片描边用强调色。
- 详情浮层：名称与说明、连接 / 设置 / 已连接状态、试试这样用（点击复制示例）、使用的应用（MCP 命令或 CLI 可执行文件）、关于（类别 / 开发者 / 版本 / 网站），卸载用危险色。
- 连接弹窗：只渲染条目声明的输入项（目录 → 原生选择器；令牌 / 连接串 → 密码框），提交后关窗并显示「正在下载 / 安装…」提示。
- MCP / CLI 页签：保留完整管理能力（列表、编辑、测试、导出、导入、启用开关、动作级审批、删除组），即「我的连接器」。
- 连接结果：目录顶部一行状态提示；失败时显示后端返回的原因（命令缺失 / 无可用安装器 / 安装失败 / 超时）。

## 6. 内置目录

- 27 条：17 个 MCP（filesystem、memory、sequential-thinking、everything、playwright、chrome-devtools、context7、github、gitlab、brave-search、postgres、redis、slack、google-maps、puppeteer、notion、supabase）与 10 个 CLI（git、gh、pnpm、docker、ripgrep、jq、ffmpeg、kubectl、az、uv），CLI 在前、MCP 交错排列，热门条目优先。
- MCP 条目用 npm 上的真实包（已核对版本），`npx -y <pkg>` 首次连接即完成下载；需要令牌或连接串的条目在连接弹窗收集，写入 MCP 的加密配置。
- CLI 条目复用声明式动作模型（含 `gh` / `docker` / `pnpm` 的完整动作集）；缺命令时按 `winget → choco → scoop → npm` 选择可用安装器静默安装（winget 额外检查 `%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe`），安装后重新探测。
- 安装与连接都是后台任务：`POST /catalog/:id/connect` 返回 `jobId`，客户端每 0.9 秒轮询一次；MCP 最长等 180 秒，安装最长 20 分钟。安装参数固定来自内置目录，不接受自由输入。
- 自定义入口仍在：CLI 模板（`gh` / `docker` / `pnpm` / 空白）、MCP 手动添加与导入 JSON。

## 7. 边界与后续

- 未做：`${secret:NAME}` 独立凭据库、远程目录 index（当前内置）、远程 MCP OAuth、连接器健康轮询与调用统计。
- 品牌图标不随包分发，首版用 emoji + 主题色块；后续可换包内 SVG。
- 设置子页标识由 `settings:mcp` 变为 `settings:connectors`，旧记忆会回退到设置首屏。
- 工具名上限 64 字符；超长或含非法字符时退回带 16 位摘要的短名。
## 8. 会话可见性

- 工具只在「会话模块」包含其 `moduleName` 时对模型可见：MCP 工具属于 `@lfaa/mcp`，CLI 工具属于 `@lfaa/connectors`。
- 标准 / 创造模式的默认会话模块包含这两项，因此新会话连上即可用。
- 旧会话保存的清单来自连接器上线之前；读取时只要清单完全由内置模块组成，就补上 `@lfaa/tool-media`、`@lfaa/mcp`、`@lfaa/connectors`，用户主动去掉的其它模块保持去掉（见 `resolveLegacySessionModules`）。
- 自定义模块组合的会话不会自动补，需要在会话模式里加上这两个模块；这是刻意保留的边界。
- CLI 工具描述格式为「连接器名 · 动作标题：说明（本机命令 xxx）」，便于模型判断是否调用。

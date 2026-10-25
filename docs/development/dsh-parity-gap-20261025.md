# LFAA 与 DeepSeek Harness 能力差距盘点

日期：2026-10-25

> 口径：只读对照，不构建、不启动服务、不联网、不连真实 Provider。LFAA 为 `E:/lfaa1/lfaa`（HEAD `8466733`，提交号 0.0.48，产品版本 0.0.13）；DSH 源码为 `E:/lfaa1/deepseek-harness`（HEAD `687f282e86`，`0.2.1-rc.2`，2026-10-17）。本文不把 DSH 的能力记为 LFAA 已接入；未经运行验收的能力只按源码/文档事实描述。

## 0. 一句话结论

LFAA 与 DSH 的差距不在“工具多少”（LFAA 约 151 个模型可见名，DSH 生成目录 73 个），而在三类可量化缺口：**上游 0.2.1 的 11 项产品增量尚未同步**、**0.2.0 基线内仍有 166 个占位包（真正影响 DSH 对标的是 3.2 列出的十余项）**、**发行形态与工程可核查性落后**。反过来，LFAA 在领域执行、节点 Daemon、中文产品化与设置中心上领先 DSH，不应为了“对齐包名”把它们改掉。

## 1. 先纠正三个对标口径

| 常见误解 | 实测 | 证据 |
|---|---|---|
| LFAA 对标的是 DSH 0.1.x，落后一个大版本 | 基准提交 `639ed015` 的 tag 就是 `dsh-v0.2.0-rc.2`（2026-09-29），当前 DSH 是 `0.2.1-rc.2`（2026-10-17）；真实窗口是 0.2.0-rc.2 → 0.2.1-rc.2 | DSH `git show 639ed015:package.json`、`git tag --list` |
| 0.2.1 只是补丁 | 窗口内 1925 次提交（非 merge 1482）、8431 个文件、+320407/−84704 行，新增 39 个两级包目录、新增 1 个 App | `git log/rev-list`、`git diff --shortstat 639ed015..HEAD` |
| 会话格式 v4、Ralph、terminal、session 检索是 0.2.1 新能力 | 会话格式 base/HEAD 都是 4；Ralph、terminal、session-query、hooks、webhook、badge skill 在基线已存在，10-05 只是被移入 `experimental/` 改成默认关闭的可选 bundle | DSH `packages/core/session/src/types.ts`、`docs/upgrade-guide`、README 对照 |

## 2. 两边家底（量化）

| 维度 | LFAA | DSH |
|---|---|---|
| 两级包目录 | 381 | 342 |
| 可装配真实包（含 `package.json`） | 215 | 351 |
| 纯占位目录 | 166（43.6%） | 0 |
| Apps | `cli`、`web`、`daemon`、`desktop-electron`、`desktop-tauri`，另有空的 `desktop`、`desktop-host` | `cli`、`web`、`desktop`、`desktop-host`、`plugin-market-generator` |
| 模型可见工具 | 静态注册约 151 个（实际按 Run 裁剪） | 生成目录 73 个，默认预设约 30 个 |
| 桌面发行目标 | 仅 Windows x64 NSIS | macOS arm64/x64 DMG + Windows x64 NSIS（签名/公证） |
| 测试资产 | 210 个测试文件 | 7 层测试、378 个快照回放场景、9 条 benchmark 用户路径 |
| 文档/目录生成物 | 手写架构、开发计划、目录清单 | `config-catalog`（155 段）、`persistence-catalog`（648 事件）、`tool-catalog` 生成并门禁 |
| 版本 | 0.0.13 | 0.2.1-rc.2 |

## 3. 差距清单

### 3.1 上游 0.2.1 产品增量（LFAA 未同步）

| 能力 | DSH 现状 | LFAA 现状 | 判断 |
|---|---|---|---|
| DeepSeek Search / Fetch API | `packages/web/web-deepseek-api` 直连 `api.deepseek.com/v1/tools/{search,fetch}`，有设置开关 | 只有基线 `web-search-deepseek` / `web-fetch-http`，无此 provider、无开关 | **真缺**，接入成本低、收益直接 |
| Plugin Market | 索引格式 + Host `pluginMarket` + Web 发现页 + `apps/plugin-market-generator` + `plugin_market` 工具 + 官方 bundle 按需安装 | 设置页明确渲染“市场暂未接入”；有安装器与 AppContainer 插件运行时 | **真缺**（目录/生态层，不是安装能力） |
| 公网部署与远程访问 | `--public-url`、`--trusted-host`、`--tls-cert/--tls-key`；`api/remote-access` 按 principal 做方法级 ACL | Control Plane 只监听本机；无公网/TLS/端点级 ACL；有自建账户角色与节点网关 | **部分缺**，形态不同 |
| 会话工作目录 | `session/working-directory` + `working_directory(cd)` 工具，持久化目录变更 | 无会话级工作目录模型，工具各自接收目录参数 | **真缺** |
| Git worktree 工具 | `experimental/worktree` + `create_worktree`，建分支/检出后切 cwd | 只有 Workspace API 与 Git 服务（`/workspace/.../git/worktrees`），无模型工具 | **部分缺**（差工具层） |
| CUA macOS 原生 | `experimental/cua` + `cua-macos`（Swift 原生 AX/截图/输入） | CUA 仅 Windows `cua-driver` 路线，macOS 桌面本身未发行 | **真缺**（与 macOS 发行绑定） |
| 机器翻译 / 推理翻译 | `translator`（Bing/Google 匿名 + DeepSeek Flash 付费路由）+ `cot-translation` bundle | 无翻译服务；界面仅中文 | **真缺**（与 i18n 绑定） |
| 凭据掩码 | `client/ui-secret-mask` 在消息里遮蔽 API key/token/密码 | 无 | **真缺**（小，安全收益明确） |
| 会话检查器 | `experimental/session-inspector` + 内嵌 DevTools | 无；排查需翻 JSONL | **真缺**（诊断体验） |
| SSH helper 运行时 | `ssh/ssh-helper-runtime` 把 helper + Node 打包，远端零依赖 | 走自建 Daemon 节点模型，无等价物 | **形态不同**，不必照搬 |
| 模型标签徽标（1017） | 临时发布徽标 | 无 | **装饰性**，不建议补 |

另有 0.2.1 的语义变化值得注意：官方 bundle 按需安装、实验/可选/Official 三态治理、内置插件预览、插件身份 Web/Desktop 兼容、桌面更新通道拆分、`engines.dsh` 兼容检查。LFAA 的插件模型是自研快照安装 + AppContainer 受限运行时，二者不能直接互换。

### 3.2 0.2.0 基线内真空白（包目录占位且无替代工具）

| 能力 | DSH 归属 | LFAA 实测 | 影响 |
|---|---|---|---|
| Agent Teams（多智能体团队） | `experimental/agent-team` + `tool-agent-team` + `client-ui-agent-team`：持久 roster、任务 DAG CAS、直接 inbox、`wait_agent`；属 experimental、默认不挂载，但协议与实现完整 | 4 个同名目录全占位；只有 3 类顺序子 Agent 驱动与 `lfaa_*subagent` 工具 | **高**：与 LFAA “按需多 Agent 协作”主线直接冲突 |
| PTC / `run_code` 代码模式 | `ptc-runtime` + `run_code`，模型写程序调用其他工具 | 架构明确“未接入 PTC 隔离执行器，因此不提供 PTC 或混合工具呈现”；`ptc-runtime` 占位 | **高**：上下文效率与复杂编排能力差距 |
| goal（持久目标） | `goal` + `tool-goal` + `goal-round-driver` + `ui-goal` | 4 个包全占位；全仓唯一 goal 代码是一个通知事件名 | **高**：长任务连续性 |
| todo | `todo/tool-todo` + `ui-todo` | `tool-todo` 占位；`packages/` 下 `grep -i todo` 为 0 命中 | **中高**：计划可视化 |
| deliverables / present | `deliverables/tool-present` + `workspace-changes` + UI 卡片 | 两个包占位；`core/tools/src/presentation.ts` 只是 UI 渲染类型 | **中高**：交付物确认 |
| LSP | `lsp` + `lsp-stdio` + `tool-lsp` | 3 个包占位 | 中：代码导航 |
| 扩展自省 | `extensions/tool-cordis`（运行时检查/动态改自身） | 占位 | 低（创造模式） |
| Claude Code mods / hooks 桥 | `claude-code-mods`、`hooks-claude-code`、`hooks-codex` | 仅 `hooks/hook-protocol` 推理钩子；两个桥接包占位 | 中：生态兼容 |
| Web 搜索多 Provider | `web-search-exa`、`web-search-perplexity`、`web-deepseek-api` | `exa`、`perplexity` 占位，只有 1 个搜索 provider | 中 |
| 插件市场 | `boot/plugin-market` 等 | 0 命中 | 高（见 3.1） |
| i18n 界面 | `locale/en.json` 226 条、`zh.json` 224 条，硬编码文案门禁 | `client/locale` 占位；设置页自述“当前界面提供简体中文；其他语言需前端翻译资源接入后生效” | 中高（海外发行前置） |
| 无头入口 | `dsh headless` / `sdk` / `sdk-minimal` / `acp` + Python SDK | 只有 `cli` 与 `daemon`；`acp` 占位；`sdk/sdk-client` 等内部包存在，但没有对外 SDK/ACP 产品入口 | 中高（自动化/集成） |

### 3.3 部分实现或“同名包占位但能力已有”（避免误判）

| DSH 能力 | LFAA 对应实现 | 结论 |
|---|---|---|
| bash / pwsh / terminal（PTY） | `lfaa_terminal` PTY 工具 + `local_execute_command` + Daemon 主机命令；`shell/tool-{bash,pwsh}{,-persistent}` 占位 | 能力已有，入口/命名不同 |
| read/write/edit/glob/grep | `lfaa_read_file`、`lfaa_write_file`、`lfaa_str_replace`、`lfaa_list_directory`、`lfaa_grep_search`、`lfaa_search_files`、`lfaa_read_image` | 已有 |
| session query/search | `session_{search,trace,event_search,event_trace,event_read,storage_info}` 6 个工具 | 已有工具，但每页扫描 JSONL + 哈希链，无持久全文索引（自述） |
| schedule | `schedule_{create,list,update,delete}` 4 个工具，cron/到点回原会话 | 已有 |
| plan mode | `lfaa_enter_plan_mode` / `lfaa_approve_plan_and_execute` 已实现并持久化 `planMode` | **能力有、Owner 包占位、文档未登记**（见第 7 节） |
| subagent | `lfaa_delegate_subagent` 等 + in-process/claude-code/codex 三驱动 | 已有；缺 fork、spawn-in-process、acp、sdk 驱动与并行调度 |
| MCP | `mcp-client` HTTP/stdio、连接池、resources、工具分页 | 已有协议子集；无 OAuth/公共目录 |
| CUA / browser-use | 15 个 `lfaa_browser_*` + 9 个 `computer_use_*` | 已有（Windows 为主，设备验收未完成） |
| 插件管理与隔离运行时 | `boot/plugin-manager`（GitHub/NPM/本机来源、SRI、取消、AppContainer 运行时） | 已有安装与隔离，缺目录/市场 |
| 权限 | 三模式（请求审批/替我审批/完全访问），两次批准自动记忆、撤销递增 generation | **比 DSH 更贴近 LFAA 用户**；不要改成 DSH 的 sandbox×approval 双旋钮 |
| 桌面更新 | `update.json` + 更新流程 6 个模块，退出码 0 才确认 | 已有 Windows 更新链 |
| 设置中心 | 34 个菜单、194 个 `SettingRow`、4315 行页面 | 比 DSH 更宽 |

DSH 侧同名 `client/ui-*` 有 40 个在 LFAA 是占位，但 LFAA 用自研 `ui-chat`、`ui-layout`、`ui-dockkit`、`ui-settings` 等替代；这些占位不等于用户看不到对应交互，具体交互差异需要实页验收，不能在本文直接下结论。

### 3.4 发行形态与生态

| 项 | DSH | LFAA |
|---|---|---|
| 桌面平台 | macOS 签名/公证 + Windows 签名/未签名 | 仅 Windows x64 NSIS |
| 桌面内置运行时 | 随包 Node、pnpm、Python（Office 库）、office-skills，按需离线安装 | 未核实等价内置 Python/Office 运行时 |
| 更新单元 | 壳 + 运行时 + pnpm 一个签名单元，nightly/latest 通道 | Windows 更新链已有，macOS 无 |
| 无头/集成 | headless、stdio SDK、ACP、Python SDK、公网部署 | CLI + Daemon；对外 SDK/ACP 缺 |
| 插件生态 | 官方/可选 bundle 矩阵 + 市场索引 + 生成器 + 治理规则 | 自研安装器，无公共目录 |
| 文档站 | VitePress + 双语配对 + 升级指南 | 仓库内文档，无站点投影 |

### 3.5 工程可核查性（最容易被“只看功能表”低估）

| 项 | DSH | LFAA |
|---|---|---|
| 生成目录 + 门禁 | 配置 155 段、持久事件 648 条、工具 73 个，全部生成并校验新鲜度 | 手写目录，已有 169→166 的陈旧记录 |
| 快照回放 | 378 个 session JSONL 即输入即期望 | 无同类机制 |
| 性能基线 | 9 条用户路径 + cgroup 4G/8G 压测 | 零散单次观测，自述无同条件基线 |
| 覆盖率 | 逐文件 100% 门禁 + 7 层测试 | 210 个测试文件，无覆盖率门禁 |
| CI/发布 | 25 个 GitHub Actions 工作流、签名/上传/feed、npm 隔离通道 | 有 GitHub Actions，无同等发布链证据 |
| 决策记录 | 2540 条 agent notes | 合同/交付文档为主，无同粒度决策库 |

## 4. LFAA 已领先、不应按 DSH 补齐的部分

- 领域执行面：Minecraft 14 工具、SteamCMD 5、运行环境 4、写作 10、AI 漫剧 9，DSH 完全没有。
- 节点/远程执行：Daemon 20 项节点能力、任务通道、远程文件传输、受管实例停机确认，DSH 无同等节点模型。
- 账户/权限：三角色账户、三模式权限与“替我审批”记忆语义，比 DSH 的双旋钮更符合 LFAA 用户。
- 中文产品化与设置中心：34 菜单 / 194 行设置，DSH 设置面更窄。
- 知识库、工作流编辑器、联机路由、Wallpaper Engine 专用适配：均为 LFAA 自有能力。

## 5. 建议优先级（如果目标是 DSH 级产品宽度）

工作量均为估算，不是承诺。

### 第一批：低成本、用户可感知（约 1–2 周）

1. **DeepSeek Search/Fetch provider + 设置开关**：仿 `web-deepseek-api` 加 provider 与设置项，沿用现有 `web_search`/`web_fetch` 工具合同；不需要改工具 schema。
2. **todo + goal + present 三件套**：先把工具与 Session 事件做出来（DSH 语义可直接参考），UI 可后置；这是长任务体验的核心。
3. **secret mask**：纯前端绘制层，安全收益明确、风险低。
4. **文档/版本卫生**：修正架构自述 2 处、登记 plan mode、占位清单 169→166、版本三号对账（见第 7 节）。

### 第二批：代理能力（约 3–6 周）

5. **Agent Teams 最小可用**：复用现有顺序子 Agent + 会话树，先做 roster、任务板、`send_message`/`wait_agent` 与 Lead 工具；并行调度与共享 checkout 可后置。这是 LFAA 自述主线，优先级高于补齐 DSH 实验包。
6. **PTC / `run_code` 评估**：成本最高，涉及工具呈现模式、隔离执行器与权限链；建议先做受限 TS 子集与只读工具桥，不要一次全量。
7. **会话全文索引 + session inspector**：现有 6 个查询工具已可用，补 SQLite FTS 与诊断 UI 收益明确。
8. **worktree 工具 + 会话工作目录**：API 已有，补工具层与持久化目录语义，服务编程 Agent 场景。
9. **i18n 基础**：先做 en 字典与 locale 映射（DSH 的 `locale/en.json` 可作词表参考），再谈翻译服务。

### 第三批：生态与发行（约 6–12 周）

10. **Plugin Market MVP**：索引格式 + 设置页“发现”+ 官方 bundle 清单；可复用现有安装器，不做任意第三方代码。
11. **macOS Electron 打包/签名/公证**：与 CUA macOS、i18n 一起构成海外发行前置。
12. **无头/集成入口**：headless 一次性运行、stdio SDK、ACP、Python SDK，按真实外部需求排序。
13. **公网部署**：反向代理/TLS/`--public-url` 等价物 + 操作员级访问控制；不要直接搬 DSH 的 principal 模型，先对齐 LFAA 账户角色。

### 第四批：工程底座（持续）

14. 配置/持久化/工具目录生成与门禁；15. 快照回放与性能基线；16. 覆盖率门禁与发布链证据。

## 6. 不建议照搬

- 不把 LFAA 改造成 Cordis 全量插件树或 DSH UI 副本；LFAA 的价值在领域产品与自研交互。
- 不为“包名对齐”实现 DSH 全部 `experimental`（auto-review、voice、webworker、inspector-profile 等）；DSH 自己也默认关闭。
- 不替换 LFAA 三模式权限；应写映射表与差异说明，而不是引入第二套审批语义。
- 不放弃 Daemon/节点模型去复制 DSH 的单进程公网部署；两者解决不同问题。
- 不做 1017 徽标之类一次性营销件。

## 7. 本轮发现的文档与版本卫生问题

| # | 问题 | 证据 | 建议 |
|---|---|---|---|
| 1 | 架构仍写“compaction 尚未接入”，实际 `compaction-basic` + `spill-local` 已是 base 的 required 插件 | `系统总体架构.md:479` vs `packages/bundle/base/cordis.patch.yml:274-281` | 改为“已接入，持久索引未接入” |
| 2 | 架构仍写“插件隔离运行时尚未实现”，实际 `WindowsAppContainerPluginRuntime` 已注册 | `系统总体架构.md:314` vs `packages/boot/plugin-manager/src/index.ts:779`、`src/windows-appcontainer-runtime.ts:30` | 改为“LFAA v1 受限运行时已接入” |
| 3 | plan mode 已实现（`agent-loop` 工具 + 会话状态）但 Owner 包占位、文档未登记 | `packages/core/agent-loop/src/execute-turn.ts:50-52,121-122` | 补包或迁移实现并登记 |
| 4 | 占位清单写 169，实际 166 | `docs/development/placeholder-packages.md:177` vs 目录扫描 | 更新 |
| 5 | 版本三号不一致：提交号 0.0.48 / 产品 0.0.13 / 清单 169 | `update.json:5`、各 `apps/*/package.json`、HEAD 提交标题 | 明确版本对账规则 |

## 8. 未核实边界

1. 两侧均未构建、未启动服务、未跑测试、未联网、未连真实 Provider；等价性结论来自源码/文档，不是运行验收。
2. LFAA 工具清单是静态注册名；单次 Run 可见集合还受 `packages/core/tools/src/business-tools.ts:58-80` 的角色/权限/App 裁剪，未实跑。
3. LFAA 40 个 `client/ui-*` 占位与自研 UI 的具体交互差异未做实页对照（审批、问题、计划、子 Agent、交付物等）。
4. macOS 桌面、CUA 真窗口、i18n 界面、公网部署均未实测。
5. 历史 ✅ 子项（`docs/开发计划.md:31-37`）仅作为自述引用，未复验。

## 附：本报告证据来源

- DSH 侧：`git log/diff 639ed015..687f282e86`、`docs/tool-catalog*.md`、`docs/subsystems/*.zh.md`、`docs/user/guide/*.zh.md`、`docs/config-catalog*.md`、`docs/persistence-catalog*.md`、`docs/upgrade-guide/**`、`packages/*/*/README*.md`。
- LFAA 侧：`docs/系统总体架构.md`、`docs/开发计划.md`、`docs/harness-packages.md`、`docs/development/placeholder-packages.md`、`packages/bundle/*/cordis.patch.yml`、`apps/*`、`packages/core/tools/src/*`、`packages/settings/**`、`packages/boot/plugin-manager/**`、`packages/host/daemon/**`。
- 两侧分析原始盘点为本次临时文件，已按仓库清理规则删除；关键证据路径与行号见正文各表。

# LFAA Agent 浏览器层级观察树（2026-10-27）

<a id="lfaa-agent-browser-accessibility-tree-20261027"></a>

## 目标与合同

- 用户目标：让 LFAA 小鱼像用户看到的 ChatGPT 浏览器轨迹一样，能把结构化页面状态交给模型，并由模型选择 JSON Tool 操作页面；补足目前扁平正文/控件清单缺少的层级、角色和状态信息。
- 运行入口：AI Work → Agent Loop 的工具目录与工具循环 → `lfaa_browser_observe` → Browser Owner（LFAA 隔离 Chromium 或已连接的 Tabbit）→ Agent Loop 将当前真实结果发回选定 Provider/model。
- Owner：页面可访问性快照与清洗归 Browser Owner；工具 schema 与权限风险由既有 Browser Tools/Permission Owner 管理；模型输入适配由 Agent Loop 负责。包职责、Bundle 装配与 Provider 选择均沿既有 Browser Owner，不另设浏览器或动作执行链。
- 设置与权限：不新增或修改设置。沿用 `browserUse.enabled`（按账户默认关闭，控制 Agent Browser Tools 可发现性）、`browserUse.enabledProviderIds`（个人 Provider 连接登记）、`browserUse.annotateScreenshots`（截图偏好）及 `permissions.mode`。截图偏好不控制无障碍树；浏览器动作继续由唯一 Permission Owner 决策。
- 数据边界：树只在当前 Tool 调用和 Provider 请求中短暂存在，不写入 Session、活动记录、浏览历史或缓存。保留角色、名称、文本及有限状态；丢弃表单值、URL、几何与未知属性。把页面结果作为不可信资料，不允许网页内容覆盖系统规则、用户目标或权限。
- 有界条件：最多 120 个节点（含截断提示）、8 层、约 8 KB；字段截断并移除控制字符。模型显式请求时才生成。截图仍按现有 `browserUse.annotateScreenshots` 和 `includeScreenshot` 合同处理。
- 动作边界：不把快照中的节点 ID 当成执行授权或句柄。点击、填写、导航与核验仍使用现有角色/名称/同名序号语义工具，遵循现有参数验证和 Permission Owner。
- 验收：Browser Owner 替身回归验证按需行为、文本清洗、截断与敏感字段值不泄露；真实隔离 Chromium 预览回归验证层级/角色/操作控件可用且不返回隐藏动作/输入值；Agent Loop 回归验证树作为不可信 JSON 进入模型消息且超限时不发送原始大对象；Browser 与 Agent Loop 包构建、直接相关 CLI 回归及 `git diff --check`。任何未运行项、集成阻断、真实 Provider/模型质量与正式页面实测均单独记录。
- 允许：修改 Browser Owner 快照、既有 Browser Observe Tool 可选参数、Agent Loop 的瞬时观察序列化、直接长期回归、受影响包 README、系统架构与本合同/索引，以及为已用 Playwright API 更新依赖最低版本。
- 禁止：新增设置或权限门；默认持续采集/保存可访问性树；引入第三套浏览器操作协议；读取/保存输入值、Cookie 或系统浏览器 Profile；通过网页内容扩大工具范围；修改其他已有未提交文件中的无关工作。

## 实施与验证记录

- 实施：新增共享有界清洗器；隔离 Chromium 与 Tabbit Provider 均仅在观察参数要求时读取 `ariaSnapshotJSON`，统一清洗并限制大小；Browser Observe Tool 暴露可选布尔参数；Agent Loop 仅把上限内的树作为不可信 JSON 加入本次模型输入。普通观察、Dock 观察与非页面动作不请求该树。
- Playwright API：依赖最低版本调至 `^1.63.0`，因为 `Locator.ariaSnapshotJSON()` 从 Playwright 1.63 开始提供。锁文件解析版本保持仓库当前安装版本 1.64.1。
- 已运行：`pnpm install --lockfile-only --ignore-scripts` 通过；`pnpm --filter lfaa-browser-use test` 通过 1/1；`pnpm --filter lfaa-browser-use build` 通过；`pnpm --filter lfaa-agent-loop build` 通过。
- CLI 浏览器回归：`pnpm --filter @yubboo/lfaa test -- tests/browser-use.test.mjs` 中新增用例通过；既有真实 Chromium 浏览器操作集成用例未退出，等待后已通过 Ctrl+C 收束，因此该完整文件回归记为未完成，不把它报告为通过。之后用 `pnpm --filter @yubboo/lfaa exec node --import tsx --import ./register-package-loader.mjs --import ./tests/isolated-test-environment.mjs --test --test-concurrency=1 --test-name-pattern="Agent can request a bounded accessibility tree" ./tests/browser-use.test.mjs` 单独运行新增用例，1/1 通过。
- Agent Runtime：用相同隔离加载器和 `--test-name-pattern="浏览器观察把有界无障碍树作为不可信 JSON 交给模型"` 单独运行目标用例，1/1 通过；验证树进入消息 JSON，超限树被替换为 omission 标记。
- 当前页面核对：用户贴出的 AX 记录位于 `/work`，其中是“登录 LFAA”表单，未显示设置中心。当前 ChatGPT 内置浏览器标签清单仍是 `/work`，标题为“无法访问此站点”；读取该 localhost 页面内容被浏览器安全策略拒绝，未尝试绕过，因此不能声称设置页面已实测。
- 尚未完成：当前 Browser/Agent 工作区的 Web 最新构建指纹与 ChatGPT 内置浏览器 `/settings` 实页验收尚未核实；真实模型观察、DeepSeek/其他 Provider 树理解质量、真实 Tabbit 与 Electron 页面未测。
- 性能/安全/维护：默认路径没有额外 DOM 树请求；显式请求与原有正文/控件观察并行，树有节点/层级/字段/体积上限和 4 秒读取超时；页面值/任意属性不跨 Owner 边界，生命周期复用现有 Run 取消与页面清理；真实 Browser 交互延迟和大页面性能未测。

## 变更文件与职责

- `packages/browser-use/browser-use/src/accessibility-tree.ts`：共享清洗、脱敏与结构上限。
- `packages/browser-use/browser-use/src/session-manager.ts`：给 Browser Snapshot 和 Run Adapter 增加按需树读取。
- `packages/browser-use/browser-use/src/browser-tools.ts`：公开可选观察参数并复用既有风险/执行 Owner。
- `packages/browser-use/browser-use/src/tabbit-provider.ts`：固定 Tabbit 观察脚本按需读取同一树，并走共享清洗器。
- `packages/browser-use/browser-use/package.json`、`pnpm-lock.yaml`：最低 Playwright API 版本及锁文件同步；锁文件还含并行工作区既有 Bilibili 包差异，未清理或回退。
- `packages/browser-use/browser-use/test/workspace-preview.test.mjs`、`apps/cli/tests/browser-use.test.mjs`：真实 Chromium 与替身 Provider 的边界回归。
- `packages/core/agent-loop/src/execute-turn.ts`、`apps/cli/tests/agent-runtime.test.mjs`：模型消息中的树投影和限幅回归；文件其余既有差异保持原样。
- `packages/browser-use/browser-use/README.md`、`docs/系统总体架构.md`：当前调用链、数据边界及 API 依赖事实。
- `docs/PROMPTS.md`、`docs/development/browser-accessibility-tree-20261027.md`：索引与本合同。
- 未新增设置配置，未修改用户偏好或权限模式。

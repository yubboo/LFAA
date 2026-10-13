# 本机应用自然语言发现与替我审批记忆

## 目标

让用户可以说“启动 PCL”“打开我的编辑器”或“打开那个 Minecraft 启动器”，由已接入的模型理解目标、推断常见名称/简称/别名，调用统一本机应用搜索工具并根据真实候选结果决定是否启动。用户不必提供 `.exe` 绝对路径或安装目录；明确给出完整 `.exe` 路径时，仍可使用现有精确路径入口。该能力对任意用户应用通用，不增加 PCL 专用分支、应用硬编码目录表或模型生成的 Shell 命令。

## DSH 对照结论

- 检查 `H:\deepseek-harness\packages\host\open-in-app\src\catalog.ts` 与其 resolver：这是编译期固定的工作区目录打开目录，不是任意本机应用发现器。
- 检查 `H:\deepseek-harness\packages\computer-use` 与 `docs/subsystems/computer-use.zh.md`：Computer-Use 通过通用 Agent 调用已登记的 CUA Provider；它提供屏幕/输入能力，不提供通用磁盘应用索引或名称搜索服务。
- 检查 `H:\deepseek-harness\packages\shell\tool-pwsh\src\index.ts`、权限预设与审批说明：通用 Agent 工具由模型按目标选择，真实执行器返回结果；权限合同归 Harness/工具执行层管理。DSH 现有 permission preset 不等于本任务要求的“替我审批”重复批准记忆语义。
- 因此 LFAA 复用 DSH 的责任边界思想——模型理解并选择已登记通用 Tool，专属 Owner 做校验、权限判定、执行与结果回传——而不照搬目录白名单、让 CUA 猜目录，或把本机任意 Shell 当成应用启动器。

## Owner、入口与设置

- 模型意图、查询/消歧/启动后的验证指引：`packages/core/agent-loop/src/execute-turn.ts`。
- 本机 Windows 应用目录、开始菜单、注册应用、PATH、Steam 与便携 EXE 发现/启动：`packages/computer-use/computer-use`。
- 风险和具体目标审批、重复授权记忆、授权撤销：`packages/interaction/permission-presets`；SQLite 审批数据结构迁移由 `packages/storage/storage-sqlite` 持有。
- 审批提示、自动记忆结果和授权列表：`packages/client/ui-settings`；真实授权与读写仍委派给 Settings/Permission API Owner。
- 只在 Windows Electron `desktop` 与仅绑定 loopback 的本机 Windows CLI `web` Profile 装配。远程 Web 或远程 Daemon 不因此获得本机桌面访问。
- 配置中心盘点：复用 `computerControl.enabled`（账户默认关闭）及 `permissions.mode`；不新增配置、不重置用户偏好。现有外观配置继续控制设置页主题和显示效果。

## 发现与启动合同

- 模型从当前用户自然语言中理解产品、类别、使用目的与上下文；可将全名、简称、品牌名等以 `|` 分隔交给同一个搜索 Tool。模型依据真实返回候选和警告继续判断；仅一个明显匹配且用户已要求启动时可直接执行，多个合理候选时才澄清。
- 搜索覆盖开始菜单快捷方式、Windows Apps Folder、卸载项/App Paths、PATH、Steam 已安装清单，以及按查询触发的便携 EXE 有界目录查找。扫描不接受模型路径，ID 由真实执行目标哈希生成；模型只收到显示名、匹配文件夹别名和不透明 ID。
- 便携发现上限：最多 16 个磁盘根、1400 个目录、24000 个目录项、5 层、2.5 秒、80 个 EXE 候选；超过限制返回截断警告。跳过 Windows、WindowsApps、回收站、恢复和系统信息目录，不跟随目录符号链接。搜索和启动复用同一查询；启动时重新发现，校验当前 Run 的 ID 仍指向唯一同一目标。
- 审批累计使用覆盖账户/App/工具/版本/风险/范围/记忆世代/决策模式/操作者/状态的组合索引，查询最多读取两个匹配批准即结束；授权状态每范围至多一行，撤销只递增世代，不清除历史审计记录。
- 应用启动不执行任意命令或模型参数。注册应用、PATH、便携 EXE 使用固定可执行目标、`shell:false` 与空参数；便携应用以真实 EXE 所在目录为工作目录。开始菜单/Apps Folder 复用 Windows Explorer，Steam 仅使用清单数字 AppID 与固定 `-applaunch`。精确路径工具仍只接受用户明确给出的 Windows `.exe` 完整路径。
- 工具回执仅表示 Windows 接收启动请求；模型必须通过已登记观察工具确认画面后再汇报。失败不自动重试进程启动，不将屏幕输入框当作文件路径执行器。

## 三种权限模式

- `ask`（请求审批）：每项危险启动逐项等待用户批准；同范围既有记忆授权不覆盖该模式。
- `approve_remembered`（替我审批）：逐项明确批准按用户、App、工具 ID/版本、风险和不可变目标范围哈希累计。相同范围第二次批准后，在同一事务内写入可撤销授权，后续匹配操作无需逐项等待。拒绝、未决定的过期审批、其他模式下的审批和不同目标范围不累计；撤销授权会增加该范围的记忆世代，旧批准不会让它立刻重新授权，必须重新累计两次。
- `full_access`（完全访问）：当前用户目标范围内不再逐项等待审批；仍遵循本机 Profile、`computerControl.enabled`、工具校验和独立的人类同意边界，不扩大用户目标。
- SQLite v48 在审批行中保存决策时权限模式和记忆世代，使累计逻辑不会将 `ask` 或完全访问下的记录算成用户明确重复批准，也不会在撤销后沿用历史次数。授权沿用现有权限列表和撤销 Owner。
- v47 及更旧审批记录没有保存批准时的模式，升级后保留为非累计历史，避免把以前 `请求审批` 模式下的记录误当成重复记忆授权；新记忆从 v48 下用户在 `替我审批` 模式内的明确批准开始计算。

## 验收

- 定向回归验证自然语言简称命中便携 EXE、搜索输出不泄露路径、本轮候选重验与真实进程参数/工作目录；审批验证第一次不记忆、同范围第二次自动记忆、变更范围不继承、`ask` 继续逐项等待、完全访问无逐项等待。
- 跑本机电脑工具直接回归、相关包构建、类型检查、工作区检查、根构建和 `git diff --check`。静态扫描边界/合成夹具不代表全磁盘真实性能、Provider 的自然语言理解、桌面审批交互或真实窗口验收。
- 运行中 LFAA 服务不在此任务中重启；构建后仍须由产品正常启动流程加载新版本。不得以向真实 PCL 发出启动请求代替测试。

## 文件职责

- `packages/computer-use/computer-use/src/local-apps.ts`：Windows 登记应用、Steam、PATH 和便携应用发现、同轮候选重验及安全启动。
- `packages/computer-use/computer-use/src/index.ts`：模型可用工具 schema、自然语言搜索合同、危险启动的范围审批摘要。
- `packages/core/agent-loop/src/execute-turn.ts`：模型理解用户目标、生成可搜索别名、候选消歧和启动后复核指引。
- `packages/interaction/permission-presets/src/permissions.ts`：权限模式写入、同范围二次批准记忆、可撤销授权。
- `packages/storage/storage-sqlite/src/database.ts`、`packages/storage/storage-domain/src/migration.ts`：SQLite v48 审批模式/记忆世代结构与从旧配置版本的升级路径。
- `packages/client/ui-settings/src/SettingsPage.tsx`：现有权限说明、同范围自动记忆结果与授权管理交互。
- `apps/cli/tests/computer-use.test.mjs`：应用发现/启动与三种权限模式定向回归。
- `apps/cli/tests/file-storage.test.mjs`：旧 SQLite 版本到 v48 的迁移与原有设置/会话保留回归；其他 SQLite 当前版本断言同步到 v48。
- `packages/computer-use/computer-use/README.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：对外能力与当前运行边界。

## 实施与验证记录

- `node --import tsx --import ./apps/cli/register-package-loader.mjs --test apps/cli/tests/computer-use.test.mjs`：1/1 通过，覆盖自然语言“我想启动 PCL 启动器”命中夹具中的便携 EXE、搜索结果不含路径、当轮 ID 校验、同目录无参数启动、两次审批后记忆、撤销重置、不同范围隔离和 `ask` 模式批准不计数。
- `node --import tsx --import ./apps/cli/register-package-loader.mjs --test apps/cli/tests/file-storage.test.mjs`：8/8 通过，覆盖 v46→v48 配置/会话迁移路径和现有用户数据恢复。
- `pnpm --filter lfaa-computer-use --filter lfaa-permission-presets --filter lfaa-storage-sqlite --filter lfaa-storage-domain build`：4 个受影响 Owner 包构建通过。
- `pnpm run typecheck`、`pnpm run build`、`node scripts/check-workspace.mjs`、`node scripts/runtime-build-state.mjs web`（`[]`）和 `git diff --check` 均通过。根构建写入仓库根 `dist/`；Web 仍有既有 501.30 kB C++ chunk 警告。
- 未接入真实 Provider 发出启动请求、未在用户 Windows 桌面启动 PCL、未实测非测试磁盘的扫描耗时/覆盖范围、审批页面真人交互或真实窗口状态；没有重启当前运行服务。源代码与根构建已更新，但运行中的进程仍需按 LFAA 正常流程重启后才加载新工具。

# LFAA 本机电脑任务合同 · 2026-10-09

## 目标

让 AI Work 在受支持的本机 Windows 入口提供类似“本地电脑”Agent 的真实执行链：模型读取屏幕图像理解当前界面，按用户目标查找应用，使用受限键盘/鼠标动作操作界面，并在动作后重新观察、核实结果。用户看到“找不到 PCL”时，不能把固定应用目录为空解释为应用不存在；应继续用 Windows 开始菜单/系统搜索等真实界面查找。应用搜索工具只负责快速枚举登记来源，不替代屏幕操控能力。

## Owner、入口与配置

- 屏幕观察、鼠标/键盘输入、应用枚举和受控启动由 `packages/computer-use/computer-use` 的 `lfaa-computer-use` Owner 提供；Agent 工具循环和模型指引由 `packages/core/agent-loop` 提供；电脑操控的有限开关由 `packages/core/tools` 读取和操作 Settings Owner。
- 支持 Windows Electron `desktop` Profile，以及 `LFAA_LOCAL_MODE=true` 且 HTTP 仅绑定 loopback 的本机 `web` Profile。远程 Web、远程浏览器所在主机和远程 Daemon 节点不能因此获得当前浏览器电脑的屏幕操控能力。
- 沿用设置中心 `computerControl.enabled`（账户默认关闭）与 `permissions.mode`。不开新设置、不重置现有偏好。用户明确要求本机操作而开关关闭时，模型先读取状态；请求审批/替我审批按现有授权链处理，完全权限可以自行开启，再于下一次模型请求使用工具。没有真实登记适配器时明确报告 Profile/主机边界，不把 MCP 安装与适配器可用性混为一谈。
- 本机应用发现来源：Windows `Get-StartApps` 返回的应用目录、当前用户及公共开始菜单 `.lnk`、卸载项 `DisplayIcon`、App Paths 注册和 PATH 中匹配的 `.exe`；另保留 Steam 已安装清单。禁止全盘扫描；不向模型返回本机可执行路径，只返回显示名、来源、不透明候选 ID。

## 执行与安全边界

- 观察工具每次只向当前 Provider 请求临时提供一张屏幕图像；LFAA Session/模型历史不保存图像字节。每个输入动作前必须有未过期且未被其他操作改变的观察；动作执行后失效该观察并要求重新观察。
- 应用目录启动只接受同一账户、同一 Agent Run 本轮搜索/推荐返回的候选 ID；启动前重新枚举目标。开始菜单和 Windows 应用目录通过 Explorer 启动，已登记应用/PATH 程序只能启动解析出的真实 `.exe` 且不传模型参数，Steam 只用固定 `-applaunch <AppID>`。进程均使用 `shell:false`。
- 具体应用搜索无候选时，模型可通过已授权的屏幕观察、热键和文本输入使用 Windows 搜索；不得通过任意 Shell、模型自造路径或全盘文件搜索代替。用户明确指定应用且 UI 结果唯一时可继续；多个匹配项或当前界面无法确认时使用 `lfaa_ask_user` 澄清。启动工具回执不等于应用成功打开，须观察画面后报告。
- 不输入密码、验证码、付款资料、Cookie、令牌或其他秘密。不得擅自发送消息、发布、购买、删除数据或修改安全设置。危险桌面动作及程序启动继续使用现有 `permissions.mode` 与审批摘要。
- 外部 MCP 是可选的能力提供端；不因本任务自动安装宽权限桌面 MCP，也不把 MCP 的 initialize instructions 当作用户授权。LFAA 现有 CUA Driver 足以提供屏幕观察与输入，应由它和真实 Windows UI 完成这里的闭环。

## 验收与性能限制

- Agent 系统指引明确：已登记目录无结果时可走真实 Windows UI 搜索；不能仅因快捷方式缺失就回复“找不到”。目录搜索支持全名、子串和通用首字母缩写（例如 PCL 对 Plain Craft Launcher），而启动仍按唯一真实候选 ID 校验。
- Windows 应用登记查询通过固定 PowerShell 脚本读取，不接受模型构造参数；超时 6 秒、标准输出上限 4 MiB。PATH 只枚举最多 64 个目录和 5000 个目录项，目录查询可取消。没有递归扫描用户目录/磁盘。
- 仅检查直接相关包构建、类型和工作区门禁；不运行一次性测试或探针，除非用户另行要求。源码/替身构建不能代替真实 Windows CUA、当前 Provider 或桌面安装版验收；没有实测的部分须明确列出。

## 本轮验证状态

2026-10-09：`pnpm run typecheck` 通过；`pnpm run build` 通过，生成 110 个能力包、Web、Control Plane 与 CLI 到根目录 `dist/`；`node scripts/check-workspace.mjs` 通过（111 包，0.0.8）；`node scripts/runtime-build-state.mjs web` 返回 `[]`；`git diff --check` 通过。未运行测试。真实 Provider 选择/审批、Windows CUA 输入、桌面安装包与 UI 帧时间未实测；现有 3000 端口服务未重启，当前会话仍加载其已启动时的版本。Vite 构建仍提示既有 501.30 kB C++ 语法块超过 500 kB。

## 本轮文件

- `H:/LFAA1/packages/computer-use/computer-use/src/local-apps.ts`：Windows 应用目录、卸载项/App Paths/PATH 枚举、名称缩写匹配与本轮候选校验。
- `H:/LFAA1/packages/computer-use/computer-use/src/index.ts`：扩展应用工具的目标 ID 与本机 UI 搜索说明。
- `H:/LFAA1/packages/core/agent-loop/src/execute-turn.ts`：本机应用目录无结果时的屏幕观察、Windows 搜索和操作后复核指引。
- `H:/LFAA1/packages/core/tools/src/capability-settings.ts`：提供首轮提示、能力状态回执和工具刷新共用的规则，按当前 Profile 与权限模式引导本机能力启用。
- `H:/LFAA1/packages/computer-use/computer-use/README.md`：记录本机 CUA、应用来源、MCP 可选性及限制。
- `H:/LFAA1/docs/系统总体架构.md`：同步当前 Windows 本机电脑能力及安全边界。
- `H:/LFAA1/docs/开发计划.md`：同步能力范围和未验收边界。
- `H:/LFAA1/docs/PROMPTS.md`：登记并标记本任务状态。
- `H:/LFAA1/docs/development/local-computer-activity-20261009.md`：记录本任务 Owner、范围、验收状态与文件职责。

## 后续补充：用户指定 EXE 绝对路径

本机应用目录不包含某些便携应用。另见 [本机可执行文件路径启动合同](local-executable-path-launch-20261009.md)：用户明确给出完整 Windows `.exe` 绝对路径时，可使用独立路径启动工具；不会接受目录、相对路径、启动参数或模型补造的目标。该工具仍由同一 `lfaa-computer-use` Owner 执行，复用 `computerControl.enabled` 与 `permissions.mode`，按 `shell:false` 启动并在启动后观察。原有搜索候选 ID 校验和 Windows UI 搜索回退保持适用于未给出精确 EXE 路径的情形。

## 后续：通用自然语言应用发现与审批记忆（2026-10-09）

本节更新覆盖上文“未登记应用只能通过 Windows UI 搜索”“没有递归扫描”及“未运行测试”的早期结论。模型现在按用户自然语言推断产品名/类别/别名，通过统一搜索发现已登记应用和有界便携 EXE；不要求绝对路径。便携查询有明确磁盘根、目录数、项目数、深度、耗时和候选上限，不进行无界全盘扫描。权限模式区分请求审批、同范围累计两次批准后自动记忆、完全访问；撤销会重置当前授权范围的批准次数。实现、当前验证和未验收边界见[本机应用意图发现合同](local-app-intent-discovery-20261009.md)。

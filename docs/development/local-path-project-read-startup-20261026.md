# LFAA-LOCAL-PATH-PROJECT-READ-STARTUP-20261026：本机绝对路径项目读取与启动恢复

## 用户目标

用户在 LFAA 对话中给出本机绝对目录并要求查看文件或理解项目时，Agent 应通过现有受限 Project Files Host 读取用户指定目录，即使当前会话绑定了另一个仓库或工作区；模型根据真实、分步读取的文件证据总结项目用途、入口和框架。另修复默认启动下本机工作区能力未提供，以及 Vite 启动门控误把可选 DSH Client 扩展图当成 LFAA 页面前置条件的问题。

## Owner、入口与设置

- 运行入口：Windows 本机开发启动脚本、`apps/web` Vite 页面、Control Plane AI Work Agent。
- 项目读取 Owner：`packages/core/tools/src/project-tools.ts` 负责模型工具合同、目标路径与权限风险；`packages/host/project-files` 继续负责本机实际读文件与路径/符号链接/Data 根围栏。
- 启动能力 Owner：`packages/util/launch-environment` 以既有 `LFAA_LOCAL_MODE` 和 loopback 检查决定 `localHostExecution`；开发启动器只在未显式配置时沿现有本机默认启用。
- Web 装配 Owner：DSH Client Modules 根据当前活动 Client 包组合 `__DSH_BOOT__`。LFAA 的 Vite 外壳对此图做尽力注入；图不可用时返回原始 LFAA 页面，由 `client/ui-renderer` 退回本地 React 根。可选第三方 DSH Client 插件缺失或停用只影响扩展槽，不阻断 LFAA 工作台。
- 设置：不新增设置；保留用户显式设置的 `LFAA_LOCAL_MODE=false`、`SERVER_HOST` 与账户 `permissions.mode`。用户指定的未知目录仍按现有统一 Permission Owner 进入危险读取风险，不设路径白名单或第二套审批。
- 数据与授权：只读范围是用户给出的目标目录，经现有 Project Files Host 执行；不把路径当成授权，不访问 LFAA Data 根，远端 `nodeId` 显式选择继续使用对应 Daemon。

## 修改边界

- 本机绝对路径 `rootDirectory` 必须优先于隐式 Agent Git / Workspace 绑定；无显式 Daemon `nodeId` 时走 LFAA 本机 Project Files Host。只有用户给出的明确本机目标可对未登记目录做只读访问；写入仍沿已登记项目的原有合同。
- 工具说明引导模型按需检查根目录清单、项目说明/清单和相关入口，再用有界搜索/读取补充证据；不无界递归、不把目录列表等同完整阅读，也不声称读取了全部文件。
- 本机启动器未发现进程环境或 `.env` 中的 `LFAA_LOCAL_MODE` 时默认启用；显式 `false`/`0` 保持不变。`localHostExecution` 仍只在桌面或受保护的 loopback 本机 CLI Profile 开启。
- Vite 只做一次最多 1 秒的启动图读取。Control Plane 返回 503、网络失败、超时或图格式异常时，仍原样提供 LFAA HTML；客户端挂载本地 React 根并报告 DSH 扩展不可用，恢复后刷新页面再装载扩展。
- 不改第三方插件安装清单、DSH Profile、用户数据、Provider/模型、权限设置或外观偏好。

## 验收条件

1. 已绑定其他本机项目时，显式绝对路径仍被原样传给本机 Host；未登记路径保持危险读取风险，经 Permission Owner；显式远端 `nodeId` 语义不变；模型工具可基于读取结果总结项目，不宣称全量读完。
2. 默认 Windows 开发启动使受保护的本机 Host 能力就绪；用户显式关闭本机模式时仍关闭。默认工作区初始化不再因缺少 `executeLocalProjectFile` 返回 503。
3. Web 图可用时注入当前 DSH Client 图；图不可用或 Control Plane 未启动时，Vite 不报错、不长时间阻塞页面，LFAA 自身 React 界面可继续挂载；DSH 扩展暂不运行，Host 恢复后刷新页面可加载。
4. 运行直接相关回归、TypeScript/包构建和差异检查。当前 `/work` 实际运行验收记录页面可用性、默认工作区提示和路径工具结果；不能用合成回归代替真实 Provider 项目理解。
5. 记录无新设置接入、路径/权限边界、可选 DSH 扩展的故障隔离和未真实测项目。

## 实施与验证记录

- 本机路径 Owner：`project_file_operation` 将用户明确给出的本机绝对 `rootDirectory` 放在隐式 Agent Git/Workspace 之前；未知根目录只允许只读，并继续经过统一 Permission Owner；执行仍经 LFAA Project Files Host 的路径、符号链接及 Data 根围栏。只读调用现在把 Agent Run 的取消信号传到 Host，文本读取可由 Node 文件 API 中断，目录/搜索遍历在条目边界响应停止。没有扩大写入范围。
- 项目理解提示：工具指引要求先用根目录、README/AGENTS、包清单和架构导航建立概览，只按任务需要追踪主要入口；停止递归逐包读取，标明未覆盖部分，不声称读完所有文件。
- 开发启动：`scripts/start-dev.ps1` 在启动完整服务或仅启动 server 时，若进程环境和 `.env` 都没有配置 `LFAA_LOCAL_MODE`，默认启用本机 Host；显式 `false`/`0` 保持关闭，`SERVER_HOST` 非 loopback 时 Host 仍关闭。`packages/util/launch-environment` 原有认证、权限和节点归属规则没有变化。
- Web 启动（复核后修正）：初版把 Vite 等待扩大至 30 秒，仍会在 DSH 图持续不可用时抛错，阻止原有 LFAA 本地 React 根降级路径；该方案已撤销。现为一次最多 1 秒的尽力读取，失败后返回原始 HTML并以 Vite warning 说明原因；`main.tsx` 与 Renderer 将 DSH 图/Renderer 不可用降为 warning 并挂载 LFAA 自身 React 界面。`@deepseek-ai/dsh-client-modules` 是随 LFAA Profile 装配的基础 Client 图协议包，普通第三方 DSH 插件只按安装/启用状态成为图中的可选条目；第三方插件缺失、卸载或停用不应使基础图失效。截图中的错误说明当时 Vite 未能取得 Control Plane 启动图，不能单凭这条错误判断是插件缺失。即使 Control Plane 整张图暂不可用，LFAA Web 界面也应可启动，扩展槽需等 Host 恢复并刷新后才恢复。
- 实页测试：ChatGPT 内置浏览器打开本机 `/work`（`http://127.0.0.1:5173/work`，Control Plane 已连接）。本轮修复后刷新时页面短暂显示读取中，随后再次目视确认工作台内容已加载，项目列表为 15 项，当前会话文件来源为 11 项；无 Vite 错误遮罩，浏览器控制台没有 warning/error。只读探测 `GET /api/health` 与 `GET /__dsh/index-injections` 均返回 HTTP 200；当前 `__DSH_BOOT__` 图包含 `dsh-client-modules`、`dsh-client-ui-renderer`、`dsh-client-hmr` 三个基础/开发项，没有第三方插件条目。该证据说明当前 Control Plane 可提供动态启动图，但不能证明截图时的历史故障原因，也没有通过卸载插件来验证。
- 实页范围限制与复测：第一次较宽泛的“理解项目框架”Run 在 3 分 55 秒累计显示 1,041,516 输入 tokens（其中缓存命中 952,576），仍继续反复枚举/读取，没有给出最终架构总结；该 Run 已停止且没有写入。之后在新会话中按最多 12 个关键文件、每文件最多 8,000 字符的边界复测，36 秒后给出项目用途、目录/包边界和启动链路，并列出未覆盖范围；该轮显示 472,242 输入 tokens、5,936 输出 tokens（页面估算约 478.2K 总 tokens，缓存命中 91.8%），也没有写入。结果证明有限证据下能完成项目级概览，但调用成本仍高。复测回答自称读取 12 个文件，证据清单实际列出 11 个文件名，数量陈述需视为不精确；摘要包含一项关于 Agent Loop 的说明，并明确注明只依据架构文档、未做源码核验。复测不是全文件读取或源码审计，也没有重启当前 Control Plane，因此新提示词在正式热重载后的普通用户请求中的成本仍需继续优化。
- 直接回归：Agent 本机显式路径覆盖/只读及取消信号、Project Files 取消、Workspace 项目与 DSH Profile 等回归合计 14/14 通过；新增 Vite 启动图不可用仍提供 LFAA 页面、可用时正常动态注入两项回归 2/2 通过；Control Plane 构建和 Web 构建通过，`git diff --check` 通过。Windows 启动脚本 AST/环境行为实测通过（未设置默认 `1`，显式环境值和 `.env` 的 `false`/`0` 保持）。Vite 请求图最多等待 1 秒且不重试；尚未通过实际关闭 Control Plane 或卸载第三方插件做故障注入验收。
- 工作区全检 `check:workspace` 仍被三个既有问题阻断：`docs/development/left-preview-hover-flicker-20261025.md` 引用的两张临时截图缺失，以及既有 `PROMPTS.md` 锚点缺失；均非本任务引入。`git diff --check` 通过。
- 设置：未新增/修改设置中心配置或账户偏好。启动器只在未设置时补本机开发默认值；`permissions.mode`、`plugins.enabled`、Provider、模型和外观配置均未由本任务更改。
- 产物：Control Plane/Web 构建均写入仓库根 `dist/`。未重启或结束用户现有的 Control Plane/监听进程；未对桌面安装包做验收。

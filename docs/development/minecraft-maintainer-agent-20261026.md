# LFAA Minecraft 应用维护员工

<a id="lfaa-minecraft-maintainer-agent-20261026"></a>

## 目标、Owner 与设置

- 用户要求在 LFAA 内提供一个专门维护 Minecraft App 的 AI 员工，能分析和执行 Minecraft 相关问题，处理应用/源码维护与实际游戏服务运维，并在复杂任务中使用多 Agent 协助。
- 现状：`expert.minecraft-hosting` 已由 `packages/preset/domain-experts` 登记，并经 `delegate_domain_expert` 进入独立 Agent Run；现有方法偏向开服顾问，未清楚覆盖 Minecraft App 本身的维护、浏览器来源不可用时的工具恢复和多 Agent 分工。
- 运行入口：AI Work `/work` 的唯一 Agent Loop；模型通过 `lfaa_expert_list` 发现角色、按需读取正文，并使用现有领域专家委派链启动独立子 Agent。保留稳定 ID `expert.minecraft-hosting`，把它升级为“Minecraft 应用维护员工”，不新增第二套 Agent/Session/运行器。
- Owner：专家目录和方法正文归 `packages/preset/domain-experts`；小鱼领域地图归 `packages/preset/persona`；代码文件、Minecraft/Runtime 服务、节点和实际操作分别继续归现有 Project Files、Minecraft、Runtime Manager、Daemon 与 Permission Owner。
- 设置：复用当前账户 `permissions.mode`、`aiRuntime.subagentAccountId`、最大子 Agent 数量/委派深度及每 Agent 模型/工具预算；主/子 Agent 模型仍取设置中心现值。无新增设置、默认值、权限、工具范围或用户数据。

## 范围与边界

- 方法需覆盖：Minecraft App 相关问题诊断和源码维护；核心、构建、Java、模组/插件兼容、实例与节点状态、下载/部署/启停、配置/日志/世界备份等真实领域任务。每轮先依据当前目录、工具合同、目标节点和实际回报作决定。
- 浏览器只是一种取证/导航能力。遇到网站或浏览器不可用时，员工应重新发现本轮登记的核心目录、Runtime Manager、项目文件或其他适用工具，并由模型按实时结果选择；不能把网页列表当可安装工件，不能绕开领域下载校验直接写入运行目录，也不能把未接入能力说成已完成。
- 复杂问题可由员工自主评估是否用本轮提供的 `lfaa_delegate_subagent` 拆分互不冲突的只读诊断、源码定位或验证任务；遵循同一委派预算和父工具范围，汇总并核实真实结果。简单问题不强制多 Agent；不实现平行工作流调度器。
- 写入、删除、下载、安装、部署、启停和许可接受都由现有 Owner、参数校验与三种权限模式执行；子 Agent 不能自行扩大权限或工具范围。权限拒绝、节点离线、来源不可用和结果未知必须如实返回。
- 不修改用户已登记实例、Minecraft 设置、模型/权限偏好或运行中服务来验收；不承诺所有模组加载器、核心来源、网站、节点和平台均可用。

## 可观察验收与实施记录

- `lfaa_expert_list` 能在 Minecraft 及其他 App 的模型发现上下文中返回稳定 ID `expert.minecraft-hosting`，显示名称为“Minecraft 应用维护员工”；正文仍按需加载，不自动注入常规请求。
- 加载的方法明确覆盖 App/源码维护与真实 Minecraft 运维，说明网页不可用时如何转向已登记工具，并支持在复杂且有独立任务时按需委派现有子 Agent；不固定模型业务流程、不虚构可用能力、不扩权。
- 保留既有专家 ID 和通用 Agent Loop；不增加 UI、Agent 身份、会话、执行器、设置或领域副本。
- 验证：直接回归专家目录/正文按需加载；构建 `lfaa-domain-experts`；运行相关类型或工作区检查及 `git diff --check`。真实 Provider、LFAA 中实际委派 Minecraft 员工、目标 Daemon 下载 Java/模组核心、实例开服和多 Agent 并行操作分别记录为未测，除非本轮确实执行。

### 实施与验收

待记录。

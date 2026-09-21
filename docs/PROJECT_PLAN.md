# LFAA Project Plan — current v0.1.16

## 当前里程碑

**v0.1.16 / #22.22 Smart Home / Identity Visual System（implementation complete · pending-user-acceptance）**

本版先完成进入产品前的体验闭环，不提前实现 App Pack Runtime：

- 登录与 First Run 注册页统一到新的 LFAA neutral visual language；
- 登录后第一屏升级为 Smart Home，支持自然语言主入口与手动入口并存；
- 自然语言输入当前只无损带入现有 Workbench Composer，不用关键词规则冒充 AI Router；
- 未实现 App Pack 保持 disabled，不伪造最近项目/Session 数据；
- 共享 Motion token 支持柔和 enter/hover/press，并尊重 reduced-motion；
- v0.1.15 的强制开发规范与根目录 Gate 保持不变。

### v0.1.13 已锁定的 Repository / Product Track 基线

当前 `packages/<capability-family>/<package>` 两层拓扑已经成立，29 个 package 均有真实实现；下一阶段的主要缺口是产品闭环，而不是目录数量。

v0.1.13 已完成：

- 发布 ZIP 不再携带本机 `*.log`；日志目录可保留为空目录，运行日志仍由本机脚本生成；
- 固定现有 capability-family 为当前基线，不创建 `packages/lfaa/*`、`features/`、`modules/` 等第二套平行体系；
- 固定“业务能力插件化、内核稳定化”：Plugin/Capability/App Pack 负责业务扩展，Agent/Session/Identity/Credential/Config/Plugin lifecycle 等内核协议保持稳定；
- 第一个真实 App Pack **锁定为 AI Writing**。AI Writing V1 完整闭环前，不再启动 Minecraft、AI 漫剧、Steam Server 等第二条大型业务线。

## 当前冻结行为

本阶段不主动重做：

- Workbench 三栏布局与 Resize/Canvas Motion（本版只增加产品入口 Motion）；
- Chat / Work / Manual 三模式语义；
- Project / Session 持久化；
- Provider / Account / OAuth / Streaming 已有链路；
- Plugin install / enable / remove 生命周期；
- Identity / RBAC 已有功能；
- 根目录标准配置文件与 4 个 Windows 薄入口 BAT。

只有真实 bug 才允许修改这些区域，禁止借“架构整理”顺手重写。

## 下一阶段顺序

### Phase A — App Pack Runtime + Intent Router 闭环

完成 `Plugin Registry → App Pack Catalog → Identity Permission → Project App Pack Ownership → Agent Capability Scope` 单向链路，并在其上提供真实 Intent Router contract。Smart Home 不再把业务入口写死成产品真值；Core 通用工作台作为内建 fallback 保留。

验收标准：安装/启用一个合法 App Pack 后 Smart Home / App Hub 能发现它；禁用/卸载后入口消失；Project 保存所属 App Pack；Agent Run 的 capability scope 由 Host 从 App Pack + 权限解析，Client 不能伪造；Smart Home 的自然语言入口只消费 Router 返回的结构化决策，不在 UI 复制关键词规则。

### Phase B — AI Writing V1（第一个完整纵向能力）

只做一个可真正长期使用的闭环：

`创建写作项目 → 文档/章节 → AI 生成 → 选区改写/扩写/缩写/润色 → Accept/Reject → 自动保存 → 版本历史 → 重启恢复 → 导出`。

AI Writing 必须复用现有 Agent Runtime、Session、Provider、Credential、Plugin、Permission 与 Workbench 基础设施，不建立第二套 Writing Runtime。

### Phase C — AI Writing 能力插件化完善

在 V1 闭环稳定后，再逐步增加 Writing Skill / Expert / Workflow / Artifact Renderer / 文档工具。新增 package 必须满足“独立生命周期 + 真实 Consumer + 清晰 Owner”，否则留在现有 Owner 内。

### Phase D — 第二个 App Pack

只有 AI Writing 达到用户验收 `delivered` 后，才选择 Minecraft、AI 漫剧或其他 App Pack，用第二个真实 Consumer 验证扩展模型。

## 架构决策原则

1. packages-first；
2. App 薄；
3. Bundle 装配；
4. Native 少；
5. 有 Consumer 才拆包；
6. package name 稳定优先于物理路径稳定；
7. contract test 是重构护栏；
8. 新文档描述当前真相，历史日志只用于追溯。

# LFAA 文档精简与导航调整（2026-11-13）

<a id="lfaa-documentation-clarity-20261113"></a>

## 目标

让用户和开发者能快速找到当前规则、架构、计划和操作入口；用简明语言说明规则，并避免多份文档重复维护同一事实。

## 范围与原则

- 整理根目录指南、`docs/` 文档入口、当前架构/计划、开发流程与任务记录导航。
- 保留许可文本、产品边界、设置/权限约束、验收证据和仍有效事实。
- 按日期记录的实施合同、审计、归档材料与生成清单保持原貌；这些文件是历史证据或机器输出，不是规则入口。
- 不改源码、用户数据、产品设置或发布文件；不运行产品测试或构建。

## 实施记录

- 将根目录 `AGENTS.md` 收敛为仓库入口、实施边界、专项规则和交付要求；`开发规范.md` 按任务、Owner、设置/数据/安全、性能、UI、代码、构建和验收组织细则。
- 精简中英文根 README 和 `docs/` 导航，明确规则、当前实现、待办、单次合同、包清单和发行版本的入口。
- 重写系统架构为当前入口、组件职责、AI/权限/数据边界、运行平台和权威文档图；重写开发计划为当前主线、已知缺口和排序方法。
- 缩短开发手册及中英文指南；为包职责规范增加按任务阅读路径；将 `design-qa.md` 的三份历史验收按结果、视口和未测范围重排，保留实际证据；压缩第三方项目说明，保留来源和许可证文本。
- `docs/development` 中的 229 份 dated contracts/feature reports、`docs/archive` 中的审计和历史合同、以及生成的包清单未批量改写，以免把历史事实改成当前规则或破坏验收证据。

## 文件职责与改动

- `AGENTS.md`：仓库级协作入口与不可越过的 Owner、权限、设置、UI、路径、构建及交付边界。
- `开发规范.md`：开发流程与性能、安全、维护、设置、UI、精准修改、构建和发布要求。
- `README.md`、`README.en.md`：中英文产品入口、快速开始、能力边界、构建、数据/权限与文档导航。
- `THIRD_PARTY_NOTICES.md`：第三方项目来源与许可说明；保留完整 MIT 文本及依赖归属。
- `design-qa.md`：三份历史视觉验收结果，按状态、视口、交互、验证和未测项组织。
- `docs/README.md`、`docs/README.zh.md`：按用户目标查找文档，并定义事实来源。
- `docs/系统总体架构.md`：当前系统入口、运行组件、权限/数据链与部署边界。
- `docs/开发计划.md`：当前主线、已知缺口及优先级原则。
- `docs/PROMPTS.md`：任务合同索引的使用说明及本任务登记。
- `docs/development/README.md`、`README.zh.md`：中英文开发文档导航与历史记录说明。
- `docs/development/handbook.md`、`handbook.zh.md`：中英文开发手册、权威来源和合同简表。
- `docs/development/guide.md`、`guide.zh.md`：中英文开发、验证和交付流程。
- `docs/development/package-responsibilities.md`、`package-responsibilities.zh.md`：英文速览和中文包职责权威规范的使用路径。
- `docs/development/documentation-clarity-20261113.md`：本次目标、范围、改动和验收证据。

## 设置与验证

- 设置中心：未新增、修改或重置任何配置；本轮只整理说明文档。
- `git diff --check`：通过。
- `pnpm run check:workspace`：通过，检查 226 个包、版本 0.0.15、类型映射/依赖/文档一致性。
- 未运行产品测试或构建；本次为文档变更，不涉及浏览器、Provider、Daemon、桌面或设备验收。

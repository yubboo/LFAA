<a id="lfaa-repo-discoverability-20261026"></a>

# LFAA GitHub 项目发现度优化（2026-10-26）

## 目标、Owner 与边界

- 目标：提升 LFAA GitHub 仓库及中英文 README 对搜索引擎、问答系统和生成式搜索系统的可理解性；让读者能快速确认产品是什么、适合什么工作、如何运行以及当前能力边界。
- 入口/Owner：公开仓库的简介与 Topics 由 GitHub repository metadata 持有；项目定位、运行方式、能力事实和边界由仓库根目录的 `README.md` 与 `README.en.md` 面向读者说明。`apps/web/index.html` 属于登录工作台，不是公开产品官网。
- 设置、数据和权限：不涉及设置中心、产品用户数据、账户权限或运行服务；仅编辑公开项目说明文本及 GitHub 仓库 metadata。
- 现状证据：当前公开仓库简介是早期项目骨架描述，Topics 仅有 `lfaa-plugin`；仓库没有独立官网和许可证文件。公开 README 已有双语内容、运行说明、能力表和架构链接，但项目定义与 FAQ 可更直接地回答用户常见问题。

## 允许与禁止范围

- 允许：更新 GitHub 仓库简介和与当前能力相符的 Topics；改进中英文根 README 的标题、首屏定位、项目概览及精简 FAQ；更新本合同和 `docs/PROMPTS.md` 索引。
- 禁止：新增营销网站或修改登录工作台的索引/分享元数据；声称项目拥有许可证、搜索排名、用户数量、供应商兼容范围或未交付能力；编造案例、评分、数据与产品状态；更改代码运行行为、设置、用户数据或服务。
- 不把 GitHub Markdown README 伪装成可控制的 Web 页面，不添加无真实页面内容支撑的结构化数据。

## 验收条件

1. 仓库简介不再包含早期开发请求文本，准确说明 LFAA 产品定位；Topics 使用与现有代码能力直接相关的标签。
2. 中文和英文 README 首屏各用一段话直接定义产品及其运行方式，FAQ 与能力表覆盖相同的已交付事实，链接继续指向权威安装指南、开发计划和架构说明。
3. 不加入许可证/开源、公开托管服务、搜索排名、未验证 Provider 清单或超出现有代码的产品能力声明。
4. 执行 Markdown 差异空白检查、锚点/相对链接检查及中英文关键信息核对。产品构建、设置检查和浏览器验收不适用；仓库公开 metadata 如完成更新，须回读确认。

## 实施与验收记录

- `README.md` 与 `README.en.md`：首屏以自然语言回答 LFAA 是什么，包含 AI Agent 工作台/应用平台、自托管、模型服务商解耦、本机与远程主机等产品检索概念；新增中英对照 FAQ，直接说明是否依赖 DeepSeek Harness、系统共享 Provider/API Key、工具和 Daemon 执行边界及能力现状。
- README 的首次使用、工作流和数据说明同步更正为系统共享模型配置：管理员维护 Provider、API Key、模型与活动项；账户级 `aiRuntime` 等偏好仍按账户保存。事实依据为当前 Settings Owner 及 [系统模型配置记录](system-model-config-scope-20261025.md)。
- 设置中心配置：未新增、未使用或修改设置项。产品 UI、账户数据、权限、运行服务、robots、sitemap 与网页结构化数据均未改动；仓库没有独立官网，Web 入口是登录工作台。
- GitHub 公共 metadata 只读核对：原简介仍包含早期“项目骨架/第一个包”的请求文本，Topics 仅为 `lfaa-plugin`，homepage 指向仓库自身；API 返回 `license: null`，且仓库没有根许可证文件。建议简介（227 字符）：`小鱼（LFAA）是一款可自托管、与模型服务商解耦的 AI Agent 工作台与应用平台，组合 Skills、Tools 和领域应用，支持本机与认证远程节点执行。 | A self-hosted, model-provider-agnostic AI agent workspace with reusable skills, tools, domain apps, and authenticated local or remote execution.` 建议 Topics：`ai-agent`、`ai-agent-platform`、`agent-workspace`、`self-hosted-ai`、`llm-agents`、`typescript`、`mcp`、`minecraft-server`；移除不再准确的 `lfaa-plugin`，不设置不存在的官网地址，也不加 `open-source`（无已声明许可证）。
- GitHub metadata 未实际写入：本轮 GitHub 连接提供仓库只读信息，没有 repository description/topics 更新操作；本机没有 GitHub CLI，Edge 设置页控制在读取阶段超时。README 改动仅在本地工作树，未提交或推送；故远端简介与 Topics 仍未修复，本任务保持未完成。
- 实际验证：`git diff --check` 通过；对两个 README 的所有相对 Markdown 文件链接逐项检查通过；中英文 `common-questions` 锚点及 `docs/PROMPTS.md` 合同文件/锚点引用检查通过。未运行产品构建或产品测试（本任务仅修改公开文档）；未进行真实搜索引擎收录、SERP、知识面板或生成式答案效果测量，也未更改任何远端仓库设置。

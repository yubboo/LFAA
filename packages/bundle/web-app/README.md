# `lfaa-web-app`

Web 与桌面共用的服务端应用装配包，负责加载认证 API、AI 漫剧项目 Owner 和工作区所需服务。LFAA 本地模型核心、MOSS-Image / MiniMax-H3 原生系列适配器、本地模型认证 API 与 AI Video 项目 Owner 通过 Cordis 服务组合；模型权重始终位于 LFAA Data，不进入包或构建产物。模型下载只接受已登记的固定来源和模型 ID，最终生成素材仍由 AI Video Owner 写入账户项目。AI 漫剧模型工具通过 `lfaa-video-tool-ai-video` 接入，范围限定为 `aivideo`；工具调用仍由共享 Agent Loop、Tools 与 Permission Owner 处理。

构建输出由工作区脚本写入仓库根目录 `dist/packages/bundle/web-app/`。

## 小鱼共享工作入口（2026-10-14）

小鱼共用原服务装配；Webserver 显式依赖 skills，能力目录随服务生命周期撤销，不增加运行系统。

`lfaa-api-github-connection-controller` 向 Web API Gateway 登记认证 GitHub 连接路由，并注入基础组合中的 GitHub Integration Owner。控制器不持有 OAuth 或 REST 业务规则、客户端密钥或账户 token。

构建只写仓库根 dist/packages/bundle/web-app/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。
## 系统级画布装配（2026-10-25）

`lfaa-canvas` 与 `lfaa-api-canvas-controller` 提供账户 + App 作用域的画布项目/素材 Owner 与认证 API；`lfaa-canvas-generation` 只编排既有 `lfaa-llm`、`lfaa-settings`、`lfaa-credentials` 的图片/视频生成并把结果写回画布素材；`lfaa-canvas-tool-canvas` 通过 `lfaa-tools` 向小鱼登记 `canvas_*` 工具。画布是系统级能力，不新增 ApplicationId、权限模式或第二套 Provider 协议；真实 Provider/浏览器/桌面验收另行记录。构建输出仍在根 `dist/`。

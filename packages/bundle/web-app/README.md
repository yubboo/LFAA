# `lfaa-web-app`

Web 与桌面共用的服务端应用装配包，负责加载认证 API、AI 漫剧项目 Owner 和工作区所需服务。AI 漫剧模型工具通过 `lfaa-video-tool-ai-video` 接入，范围限定为 `aivideo`；工具调用仍由共享 Agent Loop、Tools 与 Permission Owner 处理。

构建输出由工作区脚本写入仓库根目录 `dist/packages/bundle/web-app/`。

## 小鱼共享工作入口（2026-10-14）

小鱼共用原服务装配；Webserver 显式依赖 skills，能力目录随服务生命周期撤销，不增加运行系统。

构建只写仓库根 dist/packages/bundle/web-app/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

# host/webserver

## 小鱼共享工作入口（2026-10-14）

承载原认证 API/静态页面和共享 Agent 服务；显式注入 skills 供真实摘要发现。没有测试路由、第二套运行系统或认证旁路。

正式 Web 启动时捕获控制端与 Web 构建指纹。若服务运行期间构建输出被替换，文档请求和 General Settings 写入会返回重启提示，避免新前端与旧控制端混用；普通 API 读取和后台轮询不额外读取指纹文件。

构建只写仓库根 dist/packages/host/webserver/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

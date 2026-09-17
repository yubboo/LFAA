# Little Fish AI Agent

**中文名称：小鱼 AI 智能体**  
**简称：LFAA**  
**当前包：LFAA-v0.0.14**

> 一个属于用户、与大模型厂商解耦的 AI Agent 平台，通过工作区、技能、工具、记忆和插件构建不同领域的专业智能体。

## 产品原则

LFAA 不把用户绑定到某一家模型厂商，也不把 Agent 能力绑定到单一模型 API。

核心能力围绕：

- Workspace：工作区与项目上下文
- Agent Runtime：持续执行任务的 Agent Harness
- Tools：受控工具执行
- Skills：按需加载的专业技能
- Memory：可控、可追溯的记忆与知识
- Plugins：原生插件、MCP、DeepSeek Harness/Cordis 兼容
- Model Platform：多模型、多账号、本地模型、官方允许的认证方式
- Permission：请求审批 / 自动审批 / 完全权限
- Knowledge：本地知识库与 Hybrid Retrieval
- Desktop + Web：共用 React UI 与 Agent Protocol

## 当前阶段

`v0.0.14` 是项目的**源码更新远程差异读取修复版本**。

本版本重点不是业务功能，而是先建立：

- 唯一有效的当前架构
- 开发规范
- 项目骨架
- 模块边界
- Prompt 制度
- Plan / Progress 制度
- 更新日志制度
- 版本制度
- AI 开发入口
- Web / Desktop / Runtime / Rust 的依赖方向

## AI / 开发者开始工作前

必须先读：

1. `AGENTS.md`
2. `DEVELOPMENT.md`
3. `ARCHITECTURE.md`
4. `PROJECT_PLAN.md`
5. `CHANGELOG.md`

未经上述流程，不应直接修改业务代码。


## Git 源码更新

首次 clone 后，不需要重复 clone。

后续直接运行：

```text
LFAA-Update.bat
```

安全检查并拉取远程最新源码。

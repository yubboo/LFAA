# Little Fish AI Agent

**中文名称：小鱼 AI 智能体**  
**简称：LFAA**  
**作者：二鱼**  
**当前包：LFAA-v0.0.20**

> 一个属于用户、与大模型厂商解耦的 AI Agent 平台，通过工作区、技能、工具、记忆和插件构建不同领域的专业智能体。

## 产品原则

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

`v0.0.20` 完成中文文档命名和 docs 目录整理，并将 #20 更新为 #20.2。

当前主业务模块仍是：

```text
config-system
```

下一步进入：

```text
config-schema
```

## Node.js 包管理器

LFAA 只允许使用：

```text
pnpm
```

允许：

```text
pnpm install
pnpm add
pnpm remove
pnpm run
pnpm exec
pnpm --filter
pnpm -r
```

禁止使用 npm、npx、yarn、bun 替代 pnpm 管理本项目依赖或 workspace 命令。

## Git 源码更新

首次 clone 后不需要重复 clone。后续运行：

```text
LFAA-Update.bat
```

## 开发环境与依赖

Windows 下运行：

```text
LFAA-Setup.bat
```

Skills、Experts、Plugins、Extensions、MCP 均跟随项目安装，不使用用户级全局目录。


## 项目资源目录

LFAA 项目级可热插拔资源统一放在：

```text
.lfaa/
├── skills/
├── experts/
├── plugins/
├── extensions/
└── mcp/
```

根目录不再使用 `/skills`、`/plugins` 作为第二套资源目录。

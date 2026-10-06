---
name: lfaa-owner-navigation
description: 在 LFAA 中需要追踪功能入口、包职责、设置或数据归属、权限及 Daemon 执行链时使用。用于先找到真实 Owner 再决定修改边界。
---

# LFAA Owner 与包职责定位

先读 `docs/系统总体架构.md` 和 `开发规范.md` 的当前规则，再根据目标行为沿实际调用链确认 Owner。`docs/harness-packages.md` 用来对照完整上游包树和目录状态；它不能替代当前代码核实。

## 导航线索

- `apps/*`：CLI、Web、Daemon 和桌面启动/封装入口；不是业务规则的默认 Owner。
- `packages/client/**`：共享 Web/桌面界面、交互、状态与 API 调用。
- `packages/boot/**`、`packages/bundle/**`：应用装配、Profile 和组合补丁。
- `packages/api/**`：认证后的控制端接口与 Controller 路由。
- `packages/core/**`：身份、Agent Loop、Tools、Session 等共享核心能力。
- `packages/settings/**`、`packages/storage/**`、`packages/identity/**`、`packages/credentials/**`：各自设置、持久化、身份和凭据 Owner。
- `packages/games/**`、`packages/document/writing/**`：Minecraft、SteamCMD、写作等领域规则；具体路径以当前实际包树和入口为准。
- `packages/host/daemon/**` 与 `apps/daemon/**`：节点能力及受控的主机任务执行；LLM 推理由 Harness Runtime 所在 Owner 承担。
- `data/`：运行数据。`dist/`：唯一构建输出根目录。两者都不是源码模块。

这些是查找线索，不是穷举清单。修改前搜索 API、服务、Agent Tool、装配注册和调用方，确认数据究竟由哪个服务持久化、权限由哪个 Owner 校验、任务由哪个 Host 执行。多个模块协作时，每项事实和业务规则仍只保留一个权威实现。

## 设置与能力检查

- 新功能或界面改动前，盘点相关设置项、默认值、持久化、服务端校验和前端共享映射；优先复用已有设置和 Owner。
- Provider 能力、模型参数、MCP/Plugin/Skill 可用性、节点状态和 Minecraft 实例状态必须来自实际目录或运行结果，不按名称、文件存在或 UI 状态推断。
- 写入、安装、部署、删除、进程控制等副作用沿用目标领域服务、节点身份和现有审批/权限合同；不把文件路径或模型提示当授权。
- 技能、Prompt、Tool、MCP、插件/模组是不同类型。文本说明不变成可执行能力；只有真实 Owner 完成登记和核验后，才报告已接入或可用。

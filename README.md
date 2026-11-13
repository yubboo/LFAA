<a id="readme-top"></a>

# LFAA-Harness：AI Agent 工作台与应用平台

[English](README.en.md) · [文档总目录](docs/README.zh.md) · [开发文档索引](docs/development/README.zh.md)

**LFAA 是可自托管的 AI Agent 工作台与应用平台。** 用户描述目标后，已配置模型按需选择当前可用的工具、Skill 和领域能力；对应服务负责校验、执行并返回真实结果。LFAA 使用自己的 Runtime、能力包和应用服务，无需另装 DeepSeek Harness。

## 快速开始

```sh
git clone https://github.com/yubboo/LFAA.git lfaa
cd lfaa
pnpm install
pnpm run build
pnpm lfaa web
```

打开 `http://127.0.0.1:3000`。首次使用按页面提示创建管理员账户；管理员可在“设置中心 → AI 与模型”配置 Provider、API Key 和活动模型。Provider 请求可能计费。详细安装、数据目录和部署选项见 [CLI 指南](docs/user/cli.zh.md)。

## 产品如何工作

- `/work` 是通用聊天与项目开发入口。
- `/canvas` 是系统画布入口；选择 App 后，画布按该 App 已登记的节点能力工作。
- 领域 App 提供自己的手动操作界面。手动操作与 Agent 共用相应的领域服务、数据和权限 Owner。
- 需要操作主机时，经认证的 Daemon 在目标节点执行并回报结果。

模型和工具是否可用取决于 Profile、账户配置、权限、Provider 与节点状态。源码目录存在不代表能力已装配或可运行。当前状态及缺口见[开发计划](docs/开发计划.md)；包级状态见[能力包清单](docs/harness-packages.md)。

## 当前能力范围

| 领域 | 说明 |
|---|---|
| 通用 Agent | 在 `/work` 处理对话和项目任务；工具按需发现，执行结果由真实 Owner 返回。 |
| 游戏与运行环境 | Minecraft 管理及 Java 等运行环境；游戏库和 SteamCMD 的整合状态见当前开发计划。 |
| 写作与 AI 漫剧 | 通过各自领域服务管理项目和内容；生成能力取决于已配置且可用的模型服务。 |
| 跨游戏联机 | 现有组网与节点能力仍在完善；完整邀请、语音、协作和跨网验收尚未交付。 |

## 构建命令

从仓库根目录执行：

| 目标 | 命令 | 产物 |
|---|---|---|
| Web 前端 | `pnpm run build:web` | `dist/apps/web/`；不包含独立 Control Plane |
| Control Plane | `pnpm run build:control-plane` | `dist/apps/control-plane/` |
| 完整 Web 运行树 | `pnpm run build` | Harness、Web、Control Plane 和 CLI；之后运行 `pnpm lfaa web` |
| Windows 桌面安装包 | `pnpm run build:desktop:win` | Windows x64 Electron NSIS，位于 `dist/apps/desktop-electron/` |

Windows 桌面主线为 Electron；macOS/Linux 桌面和 Android 尚未交付。Tauri 命令是兼容入口。桌面构建、更新和平台边界见[Electron 说明](apps/desktop-electron/README.md)。所有构建产物只写根目录 `dist/`。

开发模式使用 `pnpm dev`。运行前要求 Node.js `>=24.15.0` 和 pnpm `11.17.0`；Windows 桌面构建另需 Rust stable MSVC 工具链。Web 构建无需 Rust。

## 数据与权限

- Provider、模型及 API Key 由管理员在设置中心配置并由后端保护；密钥不会发给浏览器。账户级运行偏好仍按账户保存。
- 用户、会话和领域数据由各自 Owner 保存。更换数据目录不会自动搬迁旧数据；操作前阅读[存储说明](docs/subsystems/storage.zh.md)。
- 工具操作使用设置中心统一权限模式，并在执行端继续校验身份、参数、数据范围和目标节点。完全访问不代表操作系统沙盒。
- 公网部署前配置强 `JWT_SECRET` 和持久化数据目录，详见 [CLI 配置说明](docs/user/cli.zh.md#配置与数据)。

## 文档怎么找

| 需要了解 | 文档 |
|---|---|
| 安装、启动、配置和数据目录 | [CLI 指南](docs/user/cli.zh.md) |
| 当前系统结构与 Owner | [系统架构](docs/系统总体架构.md) |
| 已实现能力、缺口和优先级 | [当前开发计划](docs/开发计划.md) |
| 仓库修改与交付规则 | [开发规范](开发规范.md) · [AGENTS](AGENTS.md) |
| 包职责与应用装配 | [包职责规范](docs/development/package-responsibilities.zh.md) · [入口装配图](docs/workspace-entry-map.md) |
| 一次任务的目标与验收记录 | [任务合同索引](docs/PROMPTS.md) |
| 产品版本与发行说明 | [更新日志](docs/updata-log.md) |

[返回顶部](#readme-top)

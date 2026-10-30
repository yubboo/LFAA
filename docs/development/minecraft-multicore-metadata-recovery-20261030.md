# LFAA-MINECRAFT-MULTICORE-METADATA-RECOVERY-20261030

## 目标

修复 Minecraft 手动部署中 Paper 以外的核心依赖 Mojang `piston-meta` 查询 Java 要求、导致来源不可达时无法完成部署的问题。使用 Mojang 官方旧元数据域名作为同源备用地址；来源都不可用时明确显示失败、支持重试，并且不猜 Java 版本或创建部署数据。

## Owner 与边界

- `packages/games/minecraft/src/core-sources.ts` 是核心工件与 Java 要求的唯一领域 Owner；只允许请求固定的 Mojang HTTPS 元数据域名，保留版本、工件、摘要和核心身份校验。Paper 继续使用 PaperMC 官方 Java 元数据，不增加核心专属硬编码 Java 版本。
- 入口为 `/games/minecraft/deployment`：Minecraft Client → 认证后的 `/minecraft/runtime-requirement` 与 `/minecraft/provision` → Minecraft Deployment Service → 目标 Daemon。服务端权限、节点能力、EULA、路径、端口和事务合同不变。
- 使用现有 `minecraftRuntime` 默认核心/内存/端口/执行方式及各超时，不增设设置、不重置偏好；写操作继续使用管理员角色、现有 Permission Owner、目标节点身份与实例数据 Owner。界面继续遵循账户 Appearance 设置。
- 只修改本合同登记的核心元数据恢复、Java 核验反馈、直接长期回归和交付文档。不得伪造目录/Java 要求、静默换版本或跳过 Java/工件核验，不修改已有实例、部署记录或无关工作树改动。

## 分批验收

1. **领域来源恢复：** 隔离回归验证 `piston-meta` 请求失败后，Mojang 官方备用域名可分别提供版本清单和版本详情；解析到的 Java 主版本来自真实元数据。双域名失败时仍返回可诊断错误，事务前无实例、部署或节点任务写入。随后运行 Minecraft 定向回归和领域包构建。
2. **部署页恢复：** Java 核验加载、失败、重试与成功状态显示在运行环境区域；未核验时不显示为仍在加载。已选核心/版本/构建/节点草稿可交给 AI Work 继续核查，但提示不得宣称未核实的 Java；最终提交必须等真实核验成功。运行直接 Client 回归、类型与入口构建，再在当前源码工作区的正式 Web 页面检查桌面和相关窄视口。

## 性能、安全与数据

- 备用请求仅在 Mojang 主域名失败时发生，仍使用现有有界 HTTP 重试和超时；不并发重复读取、不写文件、不新增定时器或订阅。
- 若主、备用来源都不可用，部署保持未开始；服务端继续负责最终 Java 和工件验证，不能由 UI 或 AI 提示绕过。
- 浏览器验收只读目录和部署草稿，不接受 EULA、不提交真实部署、不安装环境、不修改设置或实例数据。

## 实施记录

- `packages/games/minecraft/src/core-sources.ts` 为 Mojang `piston-meta` 连接/暂时性 HTTP 错误加入同路径的 `launchermeta.mojang.com` 重试；备用也不可用时给出两个官方来源的诊断。核心版本详情缺失 Java 主版本时不再猜测 Java 8，返回不可核验错误并保持部署未开始。
- `MinecraftDeploymentPanel.tsx` 把 Java 要求结果按核心、版本、构建、节点和重试序号隔离；输入变化会撤销旧请求。失败显示局部错误与重试，失败后可把同一草稿交给 AI Work 检查来源；目录状态没有伪装成持续加载，最终部署仍要求真实 Java 要求核验成功。无需 Java 的 PHP 核心继续不受该要求阻断。
- 定向回归 20/20、`pnpm run typecheck`、`pnpm run build:web`、`pnpm run build:control-plane`、`git diff --check` 通过。构建输出位于根目录 `dist/apps/web` 与 `dist/apps/control-plane`；Impeccable 检测结果 `[]`。
- ChatGPT 内置浏览器在 `http://127.0.0.1:5173/games/minecraft/deployment` 实际加载核心目录，显示 5 类核心与 Paper 版本目录。Java 失败/重试状态本轮未能在实页触发；窄分栏/手机视口未测。
- Windows 当前环境可取得 Mojang 1.16.5 版本清单，但直连备用域名的该版本详情请求在 20 秒内超时；所以备用路径的 Java 来源行为由固定主机/路径的模拟回归覆盖，不能据此宣称当前机器的实时备用请求成功。未提交部署、接受 EULA、安装 Java 或修改实例/设置。

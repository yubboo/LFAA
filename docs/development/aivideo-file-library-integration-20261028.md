# AI 漫剧项目媒体与系统文件管理联动（2026-10-28）

## 目标

把已有系统文件管理接入 AI 漫剧当前项目媒体库，让用户能从漫剧项目直达同一批本机素材，也能从 `/files` 浏览这些项目媒体。不得复制媒体文件或在 Canvas、AI 漫剧、文件管理之间建立第二份资产清单。

## 唯一 Owner 与数据边界

- 项目、媒体清单、媒体二进制、引用检查和删除生命周期仍由 `packages/video/ai-video` 持有。项目媒体实际存于当前漫剧存储根下的账户哈希/项目 UUID 子目录；`project.json` 中的媒体记录及 Owner 的认证媒体读取 API 是权威来源。
- `packages/api/ai-video-controller` 作为适配器把 AI Video Owner 注册为 `SystemFileLibrary` 的只读来源；只投影当前通过认证的账户自己的项目与已登记媒体。禁止通用文件服务直接遍历 `users/`、接受磁盘路径、修改 `project.json`、覆盖素材或绕过引用/删除校验。
- 文件来源只提供项目列表、媒体列表、受限图片预览和流式下载；上传、移动、改名、编辑、回收站及删除继续由 AI 漫剧媒体库 Owner 提供。缺失媒体如实显示，不创建空目录或伪造素材。
- 从当前 AI 漫剧项目媒体库打开 `/files` 时，只通过当前账户限定的一次性路由状态定位稳定项目 ID；服务端仍逐请求检查超级管理员、`permissions.mode=full_access`、认证账户与项目归属。该路由状态不是权限。
- 通用 Canvas 项目媒体与 AI 漫剧领域项目媒体仍属于不同 Owner。已有素材不得自动复制/迁移；本任务不把旧 Workspace Canvas 资产改写为漫剧项目资产。

## 设置、权限与性能

- 沿用 Settings Owner 既有项目内容存储位置（AI 漫剧按当前存储根读取）和 `permissions.mode`。系统文件管理仍要求超级管理员与完全访问；应用内文件管理快捷入口只在同样的 UI 条件满足时显示，服务端校验不变。
- 不新增、重置或修改设置、账户、凭据、Provider 或权限；不触发生图/生视频。
- 列表只读项目清单与 Owner 的有界媒体摘要，不递归扫描磁盘；预览只允许 Owner 已登记且不超过文件管理现有 3 MiB 预览上限的图片；下载沿认证流读取并保留 AI Video Owner 的文件大小、账户/项目和素材引用校验。
- UI 使用现有 Appearance 主题映射并适配窄分栏/短屏，不增加 CSS 变量或动效。

## 修改范围与验收

- 目标入口：Web/Desktop 共用 `/files` 与 AI 漫剧项目的“媒体与时间线”页。
- 允许：AI Video API 注册 FileMount 适配器、SystemFileLibrary 的只读流下载委派、共享文件管理对流下载/不可预览媒体的操作呈现、当前项目媒体页的受权限约束导航、必要包依赖/README/架构和本合同记录。
- 禁止：创建新存储根/文件接口、访问其他账户项目、文件管理直接 CRUD AI 漫剧媒体、改变生成流程或设置、迁移/删除/复制现有资产、触发计费 Provider。
- 验收：受影响 API/Client 包构建、客户端与 Host 类型检查、包职责检查及 `git diff --check`；ChatGPT 内置浏览器实页确认系统文件管理的漫剧项目入口、当前账户项目媒体读取、图片受限预览、文件下载入口和从当前项目直达后返回原 App。至少检查桌面与一处窄分栏/短屏；不改账户偏好或素材数据。构建/源码证据与浏览器证据分开记录；未触发真实文件下载或无法选定已有媒体时不得声称对应动作已实测。

## 实施记录

- 已接入：`lfaa-api-ai-video-controller` 将认证账户的项目/媒体清单以只读 `aivideo-projects` 来源注册给 `SystemFileLibrary`；预览限定 Owner 已登记的 3 MiB 以内图片，原始下载通过同源认证路由流式委派回 AI Video Owner。
- 已接入：系统文件管理在目录导航展示“AI 漫剧项目”，支持只读列出/搜索、受限图片预览与浏览器流下载；不可预览的大媒体显示下载入口。项目层级面包屑隐藏 UUID。素材库面板增加受现有完全访问权限控制的“在文件管理中查看”，只把当前用户/当前项目 ID 作为一次性路由状态。
- 包与文档：更新 API/Client/FS/Values/Workspace/AI Video 包公开依赖或 README、`pnpm-lock.yaml`、系统架构与文件资源边界；没有新设置、数据根或副本。
- 源码检查：Client TypeScript 与 Host TypeScript 通过；`node scripts/package-responsibilities.mjs` 通过；`git diff --check` 通过。Web (`pnpm run build:web`) 与 Control Plane (`pnpm run build:control-plane`) 构建通过，正式 `runtime-build-state.mjs web/host` 均无过期输出。没有运行测试。
- 内置浏览器：当前源码 Web `http://127.0.0.1:3000`，漫剧手动工作区 `/apps/aivideo/normal` 显示当前账户 0 个 AI 漫剧项目；系统文件管理 `/files` 的“AI 漫剧项目”挂载能打开并显示同账户项目空列表。实际检查了默认视口约 1392×838 与窄分栏 760×820，导航、只读空态及禁用新建/上传入口正常；截图已在本轮内置浏览器检查输出中观察。随后恢复浏览器原路由 `/apps/aivideo/canvas` 并重置临时视口。
- 边界：账户当前没有 AI 漫剧领域项目，所以不能实测从现有项目按钮携带路由状态进入、项目媒体图片预览、真实流下载及返回原 App。未创建测试项目/素材，也未触发生图或生视频；上述项目媒体动作不标记为通过。

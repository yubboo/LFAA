# LFAA 外观区域独立效果合同（2026-10-27）

<a id="lfaa-appearance-area-overrides-20261027"></a>

## 用户目标

- 用户确认继续优化 Appearance：登录页、工作区与设置中心应可独立调整外观效果，且不改变已有默认值/账户偏好；需要支持只恢复当前区域。
- 本轮范围：登录页与现有五种 Workbench 区域（小鱼智能体、SteamCMD、Minecraft、写作、设置中心）可分别覆盖背景遮罩；五种 Workbench 区域可分别覆盖玻璃模糊。空覆盖继承现有全局 `appearance.overlay` / `appearance.blur`。登录页遮罩无覆盖时继续使用既有 40% 映射；显式登录遮罩覆盖按用户设置值直接呈现。登录页当前为不透明表单，没有有效的玻璃模糊面，因此不新增无效登录模糊控制。
- 目标运行入口：Web 与 Web/Desktop 共用 Client；`/` 登录页、`/work` 小鱼工作区、各专业 Workbench 路由及 `/settings?section=appearance`。

## Owner、设置与数据边界

- `packages/util/values` 唯一提供外观类型与默认值；既有全局遮罩默认 65%、玻璃模糊默认 14px 和范围不变。新增逐区域覆盖默认为空/继承，不回写或迁移已有用户偏好。
- `packages/settings/settings` 唯一执行严格校验、旧账户补默认与账户持久化；旧客户端省略新覆盖字段时必须保留服务端已有值。Agent 设置目录沿用同一 Owner/Schema。
- `packages/client/ui-settings` 提供逐区域控件和只重置当前区域的动作；沿用 Appearance 自动保存和错误回滚。
- `packages/client/ui-layout` 按现有唯一背景槽映射目标区域并设置 Workbench 主题令牌；`packages/client/ui-theme` 负责共享解析、登录页安全缓存与首帧遮罩缓存；`ui-settings-account/AuthView` 与 `auth.css` 负责登录页呈现。
- 登录缓存只保存按用户名校验的公开视觉设置，不保存账户私有背景、凭据或秘密。认证、权限和背景素材的账户隔离合同不变。Wallpaper Engine 拥有画布时继续由其 Profile 逐面样式接管；LFAA 区域覆盖仅作账户 Appearance 层。

## 修改边界与验收

- 保留全局设置作为未覆盖区域的回退；新用户和旧用户仍得到与当前相同的默认视觉。服务端 schema 缺失登录背景时须与共享默认值一致。
- 不增加新页面槽位、不开放登录页自定义上传、不改变全局主题/强调色/字体/对比度/动效语义、不修改真实用户设置值。
- 每个区域可以设置自己的遮罩；五个 Workbench 区域可以设置自己的玻璃模糊；“恢复本区域默认”只清除当前区域覆盖，系统工具栏“恢复默认”仍代表整个 Appearance 分类。
- 验证逐区域覆盖、全局继承、旧客户端省略字段保留、登录 40% 回退/显式覆盖、服务端范围拒绝、缓存账户隔离和首帧遮罩一致。
- 每个可见批次运行直接回归/构建，并在 ChatGPT 内置浏览器的实际源码服务检查登录、`/work` 与设置页；覆盖桌面及相关窄/短视口。记录实际路由、视口、交互、截图与未测范围。不得触碰 3000 端口用户服务或写入真实账户偏好。

## 实施与验收记录（2026-10-27）

- 设置 Owner 新增 `appearance.areaEffects`：登录页与五个 Workbench 区域分别保存可空遮罩覆盖；五个 Workbench 区域再分别保存可空模糊覆盖。全局遮罩 65%、模糊 14px 与范围保持原样；空值继承，全区域重置只清当前区域。旧客户端省略新字段时，Settings Owner 保留服务端原有逐区域值。
- 登录页无覆盖继续按全局遮罩 40% 呈现（本轮实页显示全局 65% → 登录页 26%）；显式覆盖直接使用账户值。登录缓存按用户名隔离，仅保存允许的公开视觉值；登录不新增无效模糊控件。
- Appearance UI 的目标选择器覆盖“登录页（当前设备）/小鱼智能体/SteamCMD/Minecraft/写作/设置中心”。实页确认 SteamCMD 与设置中心均显示区域遮罩和区域模糊，并标明继承/自定义状态、只重置本区域；登录页只显示遮罩。实际浏览器中只切换目标选择器，未改动任何 Appearance 数值、图片、主题或真实账户偏好。
- 实际运行入口：隔离源码服务 `http://127.0.0.1:3002/settings?section=appearance`；桌面视口实测 `1513×1244`（另在 `1280×720` 查看设置页首屏），窄屏 `390×844`，窄短屏 `360×640`。三个尺寸均可见分区控件；窄屏设置导航收为图标栏，内容可纵向滚动。DOM 测量：390px 视口的文档宽 380px，360px 视口宽 350px（预留滚动条）；均无水平溢出。浏览器实页截图在本轮验收会话中捕获，登录继承 26% 与全局 65%/14px、设置中心区域继承 65%/14px 均有画面证据。
- `/work` 已登录到隔离验收会话并打开设置中心；随后登录页以纯色默认背景显示，因此未对森林壁纸做真实视觉比较。**未实测**带壁纸登录页的最终像素效果，以及真实账户/桌面端效果。初始化 `/work` 时记录到三条此前运行错误（`dsh-ui-primitives` 两条 `startsWith`、`ApplicationWorkspace` 一条 `toLocaleLowerCase`）；Appearance 页面交互期间没有新增错误。本任务没有扩展修复范围去改这些其他调用链。
- 验收副作用说明：隔离登录日志出现 `POST /workspace/projects/initialize-default`（201）；该 Owner 会按产品流程确保系统“文档”下的 `lfaa/default-workspace` 目录存在（只建目录，不复制或写入项目内容），界面曾显示路径 `D:\Documents\lfaa\default-workspace`。无法确认它在本轮前是否已存在，因此没有检查内容或删除。服务退出日志还记录了 `/api/settings/ai/probe`、`/test-model`、`/accounts` 与两次 `PUT /ai-runtime`；这些请求不属于 Appearance 操作，触发方与目标账户无法从当前日志确定。本轮没有尝试回滚或清理未知 AI 配置；已停止 3002 临时服务，未触碰 3000 用户服务。
- 验证：Client/Host TypeScript 检查通过；Appearance 定向回归 6/6 通过；Web 与 Control Plane 构建通过，`runtime-build-state.mjs web` 返回 `[]`；`git diff --check` 通过。Web 构建产物位于 `dist/apps/web/`，Control Plane 位于 `dist/apps/control-plane/`。未测桌面封装、真实壁纸登录像素与帧时间。
- 涉及源码/验证文件：`packages/util/values/src/settings-contract.ts`、`packages/settings/settings/src/{validation.ts,service.ts,agent-settings.ts}`、`packages/client/ui-theme/src/{appearance-area-effects.ts,login-appearance.ts}`、`packages/client/ui-settings-account/src/AuthView.tsx`、`packages/client/ui-layout/src/Workbench.tsx`、`packages/client/ui-settings/src/SettingsPage.tsx`、`apps/cli/tests/{client-login-appearance-bootstrap.test.mjs,file-storage.test.mjs,agent-settings-tools.test.mjs}`。对应包 README 与 `docs/系统总体架构.md` 已同步。

# LFAA 登录背景泛白修复合同（2026-10-27）

<a id="lfaa-login-background-washout-20261027"></a>

## 用户问题与目标

- 用户反馈登录页整体泛白，并附上 `http://127.0.0.1:3000/` 登录页截图。截图中登录卡片清晰，森林壁纸却被明显的白色雾层冲淡；没有提供报错。复现方式为打开 Web 登录入口并观察已选择的内置背景。
- 目标是让登录壁纸恢复清晰、可辨的色彩，同时保留主题、登录背景与设置中心 `appearance.overlay` 的联动。零遮罩仍必须是零遮罩，浅色主题继续使用白色遮罩，深色主题继续使用中性深灰遮罩。
- Owner：`packages/settings/settings` 校验、持久化账户 Appearance；`packages/client/ui-theme/src/login-appearance.ts` 校验按用户名隔离的登录安全外观缓存；`packages/client/ui-settings-account/src/AuthView.tsx` 将当前有效外观映射到登录页；`packages/client/ui-settings-account/src/auth.css` 绘制登录页背景。正式 Web 入口为 `apps/web`，未认证根路由 `/` 呈现登录页。

## 设置、数据与权限边界

- 使用现有 `appearance.theme`、`appearance.backgrounds.login` 和 `appearance.overlay`。设置中心的 `appearance.overlay` 默认值为 65，范围 0–75，按账户校验和持久化；登录页缓存仅读取服务端确认的白名单字段，账号不匹配时回到共享默认值。设置本身及其持久化合同不变。
- 本修复只降低 `appearance.overlay` 对登录壁纸的视觉作用强度（乘以 0.4）；该设置仍是唯一强度来源，且各个值保持单调、0 保持完全无遮罩。没有新增设置、没有写账户偏好、没有变更登录凭据、认证/授权或恢复流程。
- 允许修改登录外观映射、其定向回归、受影响包 README 与本合同/索引；禁止改动工作区遮罩、全局设置默认/范围、认证和转场行为，以及无关 UI。

## 分批实施与验收

### B1：登录壁纸遮罩修复

- 将登录页遮罩强度映射为设置值的 40%，浅/深色遮罩色相仍按主题选择；沿用既有 CSS 自定义属性，不新增变量。
- 增加针对默认值 65、边界 0/75、浅/深主题的定向回归；运行登录外观回归、Client 类型检查、受影响包构建及 Web 构建。
- 验收应确认：65 映射成 26% 壁纸遮罩，0 映射成 0%，75 映射成 30%；背景不再呈整屏白雾，表单、恢复入口与服务状态仍清晰可用。

### B2：正式 Web 实页

- 从当前源码工作区构建并启动正式 Web 服务，使用 ChatGPT 内置浏览器打开 `/`；隔离运行数据，不登录、不保存任何设置。
- 至少目视检查桌面和窄短屏，记录真实视口、背景/表单效果、滚动与横向溢出、截图证据及未测边界。构建和回归不能替代此验收。

## 实施与验证记录

- 开始状态：`main` 分支，工作树干净。源码和任务索引修改前已登记合同。
- 根因：`AuthView.tsx` 原先将 `appearance.overlay / 100` 直接作为全屏浅色登录壁纸的白色 alpha。全局默认 65 因而把登录壁纸覆盖 65%；该比例远强于登录场景需要的遮罩，形成截图中的泛白效果。这不是图片重复绘制或服务端错误。
- B1 实施：`ui-theme/login-appearance.ts` 新增登录壁纸遮罩映射：把有效 `appearance.overlay` 限定在 0–75 后缩放为 40%，并按主题输出白色或中性深灰；AuthView 继续通过已有 `--settings-background-overlay` 消费结果，定义旁的中文注释说明当前用途。没有新增 CSS 变量或设置项。
- B1 源码验证：`node --import tsx --import ./register-package-loader.mjs --test tests/client-login-appearance-bootstrap.test.mjs`（`apps/cli`）3/3 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；`pnpm --filter lfaa-client-ui-theme build`、`pnpm --filter lfaa-client-ui-settings-account build`、`pnpm run build:web` 通过；最终 `node scripts/runtime-build-state.mjs web` 返回 `[]`，`git diff --check` 通过。
- B1 直接回归覆盖默认 65 浅/深主题均为 26% alpha、0 为 0%、75 为 30%。
- B2 实页：以隔离 Home/Data 从当前源码工作区运行 `pnpm lfaa web --home <隔离 Home> --no-local-daemon`，loopback `http://127.0.0.1:31367/` 的 `/api/health` 返回 200。ChatGPT 内置浏览器实际打开根路由，桌面截图视口 1270×714，登录标题、表单、登录按钮、服务器状态与恢复入口均可见；截图留在本轮内置浏览器工具输出，未写入仓库。系统主题为深色，隔离账户没有登录背景缓存，故本轮未直接看到用户截图中的森林壁纸，也不能声称照片对比已实页通过。当前 CUA 内置浏览器没有视口覆盖能力，窄短屏未实测。
- 隔离环境边界：Web 重建后旧进程提示需要重启，按指纹规则只重启本轮隔离服务。随后浏览器自动进入 `/work`，日志记录了一次自动登录、默认工作区初始化和 Appearance 写入；没有继续页面交互，立即关闭标签、停止本轮服务，并删除创建于本轮的 `dist/.tmp/login-washout-validation/{home,data}`。用户的 3000 端口服务与浏览器页面未访问/未重启。帧时间未测。
- `pnpm run check:workspace` 未通过，错误为 `docs/development/left-preview-hover-flicker-20261025.md` 的两条既有截图链接 `../../dist/.tmp/hover-flicker-desktop.png`、`../../dist/.tmp/hover-flicker-narrow.png` 不存在；这些无关截图未伪造或修改。
- 交付时的共享工作区状态：在上述 Web 构建成功后，其他并行改动更新了 `packages/storage`、`packages/workspace` 与 `packages/core` 等源码；最终 `node scripts/runtime-build-state.mjs web` 返回 `["host","web"]`。随后 `pnpm run build:control-plane` 成功，但源文件再次变化；后续 `pnpm run build:web` 被 Vite 的指纹守卫中止，没有登记当前 Web 指纹。未继续构建，以免覆盖并行任务的工作状态；因此不声称当前正式 Web/Control Plane 产物已与共享工作区全部源码对齐。登录包/Web 构建此前通过，且 3000 端口的运行服务未重启。

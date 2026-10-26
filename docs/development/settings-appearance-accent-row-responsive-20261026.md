<a id="lfaa-settings-appearance-accent-row-horizontal-first-20261026"></a>

## LFAA-SETTINGS-ACCENT-ROW-HORIZONTAL-FIRST-20261026：强调色设置横向优先响应式布局

### 目标、Owner 与边界

- 用户目标：整理截图红框中的“强调色”设置行，遵循“横平竖直，能一行就一行，不能一行就多行，先左右后上下”；将该口诀写入仓库开发规范，供后续响应式界面实现遵循。
- 当前表现与目标：窄容器下标签/说明与调色板被整体纵向分开，空白较多。标签与说明在左、颜色选项在右；仅当实际可用宽度放不下可读说明和调色板时再换到上下行，调色板可继续自然换行，页面不横向溢出。
- 运行入口：Web/Desktop 共用设置中心 Client，`/settings?section=appearance`。
- Owner：外观设置行语义结构与容器专属布局归 `packages/client/ui-settings`；复用基础 `SettingRow`，不改变 `ui-primitives` 通用组件合同。强调色值和每模式偏好仍由 Settings Owner 持有。
- 设置盘点：使用现有 `appearance.accentColor` 与 `appearance.advanced.separateModes` 决定所显示的强调色控制；颜色、字体/字号、主题、壁纸、遮罩、模糊及减少动态效果继续使用现有 Appearance 配置和共享令牌，不新增配置、不改默认值/持久化、不写入用户偏好。
- 性能、安全与维护性：只修改设置行结构标记、容器样式、回归、包说明和开发规范；不增加请求、订阅、计时器、观察器、动效、权限或数据操作。CSS 按实际布局容器自然调整，单一 Owner 管理样式。

### 允许范围与验收

- 允许修改：`SettingsPage.tsx`、同包 `SettingsPage.css` 和 README、直接相关响应式回归、`开发规范.md`、本合同及 `docs/PROMPTS.md` 索引。
- 保留现有未提交工作及相邻设置行行为；不清理、不暂存、不更改账户偏好。
- 验收：可容纳说明和完整色盘时两者横向排列；容器过窄时文字与色盘换到多行，色盘本身可换行；对照桌面和 390px 窄视口时无横向溢出；主题、字号、状态文案和颜色选择行为不回归。
- 源码验证：设置页响应式定向回归、ui-settings 构建、Client 类型检查、正式 Web 构建、Web/Host 指纹与 `git diff --check`。
- 实页验收：正式 Web 的 `/settings?section=appearance` 至少检查宽屏与 390px 容器，记录截图、布局方向、溢出与交互；不点击色盘、不保存或改动账户设置。
- 帧时间与实体手机/Electron-WebView 未测时照实记录；本任务仅是静态布局调整，不宣称帧时间测量。

### 实施与验证记录

- 实施：在外观内容区增加专属样式边界，并给强调色 SettingRow 添加稳定标记；两列使用按内容最小宽度自动适配的 Grid，实际容器可容纳时标题/说明在左、色盘在右，窄容器自动转为上下排列，色盘允许折行；更窄时色盘与状态文案靠左。没有改变颜色选取逻辑或其他外观分组。
- 规范：在 `开发规范.md` 加入响应式布局口诀及可执行解释：按真实容器宽度优先左右，空间不足时换行/上下；保留可读性和操作尺寸，不强制窄视口断点，不用 `inline-block` 承担布局。
- 设置：沿用 `appearance.accentColor`、`appearance.advanced.separateModes` 和现有 Appearance 主题/字号/强调色令牌；未新增设置、未保存或改写用户偏好。
- 文件职责：`packages/client/ui-settings/src/SettingsPage.tsx` 标记外观容器和强调色行；同包 `SettingsPage.css` 只负责该设置行的横向优先与折行；`packages/client/ui-settings/README.md` 记录可见布局合同；`apps/cli/tests/client-settings-responsive-toolbar.test.mjs` 覆盖自动双列/窄容器折行结构；根 `开发规范.md` 保存全仓口诀；本合同与 `docs/PROMPTS.md` 登记任务边界和证据。
- 源码验证：`node --test tests/client-settings-responsive-toolbar.test.mjs`（`apps/cli`）4/4 通过；`pnpm --filter lfaa-client-ui-settings run build` 通过；`pnpm run build:web` 中 Client TSC 通过、Vite 转换 3879 个模块，但两次均检测到编译期间工作区源码变化，拒绝登记产物；`pnpm run build:control-plane` 因本轮未改动的 `packages/core/agent-loop/src/execute-turn.ts:981` 与 `pi-runtime.ts:141-142` 类型错误失败；`node scripts/runtime-build-state.mjs web` 为 `["host","web"]`，`host` 为 `["host"]`；`git diff --check` 通过。
- 实页验收：目标路由 `/settings?section=appearance`。重载当前内置浏览器页时出现 `ERR_CONNECTION_REFUSED`；本机随后观察到 3000 端口由 PID 24224 的 Node 进程监听，命令行为 tsx 运行 `src/index.ts`，无法确认其归属，`/api/health` 8 秒超时。没有结束该未知进程，也没有取得改动后的截图，因此桌面/390px 布局、页面溢出及相邻区域仍未实测；未点击色盘或修改账户设置。
- 性能与未测范围：仅静态 Grid/容器样式和文档，无新增请求、订阅、计时器、观察器、动效或写入；未测帧时间、实体手机和 Electron/WebView。

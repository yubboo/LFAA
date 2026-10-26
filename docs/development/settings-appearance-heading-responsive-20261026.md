<a id="lfaa-settings-appearance-heading-responsive-20261026"></a>

## LFAA-SETTINGS-APPEARANCE-HEADING-RESPONSIVE-20261026：窄屏外观标题与 LFAA 标识并排

### 目标、Owner 与边界

- 用户目标：在响应式窄视口中，将外观页的 LFAA 标识移到“外观”标题右侧，与标题左右排列，避免标识独占标题下方一行。
- 运行入口：正式 Web 设置中心，路由 `/settings?section=appearance`；共享页面由 `packages/client/ui-settings` 提供。
- Owner：标题和预览标识归 `packages/client/ui-settings/src/SettingsPage.tsx`；容器响应式样式归同包 `SettingsPage.css`；包 README 记录可见布局事实。既有账户偏好、类型、默认值、校验与持久化仍分别归 Settings Owner 和 `util/values`，本次不改变。
- 设置盘点：页面继续消费 `appearance.theme`、`appearance.accentColor`、`appearance.advanced` 字体/字号和减少动态效果，以及共享壁纸、遮罩与模糊映射；不新增配置、不改默认值/持久化、不写用户偏好。LFAA 标识仍沿用当前强调色令牌。
- UI Skill：`baseline-ui`，用于小范围标题层级、间距和响应式布局检查。
- 性能、安全、可维护性：只调整静态 DOM 组织与 CSS；不增加请求、订阅、观察器、计时器、动效、权限或数据操作；样式限定在外观页标题容器，其他设置分区保持原布局。

### 允许范围与验收

- 允许修改：外观页标题 JSX/CSS、`packages/client/ui-settings/README.md`、直接相关响应式回归、此合同与 `docs/PROMPTS.md` 索引。
- 保留工作树中已有的 `SettingsPage.tsx` 写作光线设置行及其他所有无关未提交改动；不覆盖、不清理、不暂存。
- 验收：桌面标题区保持原有层级和标识定位；窄屏中“界面显示”在上，“外观”在左且 LFAA 标识在右，两者对齐；说明文字位于标题行下方且可换行；设置分组、保存工具栏和相邻页面无布局回归；无横向溢出。
- 源码验证：运行新增/扩展的设置页响应式直接回归、ui-settings 构建、Client 类型检查与 Web 构建，并核对构建产物在根 `dist/`。
- 实页验收：从当前 checkout 启动正式 Web，在 ChatGPT 内置浏览器打开 `/settings?section=appearance`；至少检查桌面与 390px 窄视口，记录页面截图、视口、无溢出和设置偏好未变。不得通过保存控件改变真实账户设置。
- 帧时间、真实手机触屏及 Electron/WebView 未覆盖时单独注明；静态布局调整不声称有实测帧时间。

### 实施与验证记录

- 实施：外观页 JSX 将标题与 LFAA 标识放入同一标题行；`settings-main` 容器不宽于 620px 时标识回到标题行右侧，标题说明仍位于下一行。桌面仍在标题区右侧显示标识。没有新增 CSS 自定义属性或动效。
- 设置：继续消费主题、强调色、字体/字号、壁纸、遮罩、模糊与减少动态效果映射；本次没有修改设置合同、默认值、服务端校验、持久化或账户偏好。
- 文件职责：`packages/client/ui-settings/src/SettingsPage.tsx` 提供外观标题与标识语义结构；`packages/client/ui-settings/src/SettingsPage.css` 仅按 `settings-main` 容器宽度重排该标题区域；`packages/client/ui-settings/README.md` 记录桌面与窄容器行为；`apps/cli/tests/client-settings-responsive-toolbar.test.mjs` 覆盖标题与标识的结构、断点和定位；`docs/PROMPTS.md` 与本合同登记范围和证据。
- 源码验证：`node --test tests/client-settings-responsive-toolbar.test.mjs`（`apps/cli`）3/3 通过；`pnpm --filter lfaa-client-ui-settings run build` 通过；`pnpm run build:web` 通过（Client TypeScript 检查、Vite 3879 modules）；`node scripts/runtime-build-state.mjs web` 返回 `[]`，`node scripts/runtime-build-state.mjs host` 返回 `[]`；`git diff --check` 通过。Vite 报告部分 chunk 超过 500 kB，为既有构建提示。
- 实页环境：当前正式 Web 由 checkout 启动在 `http://127.0.0.1:3000`，`/api/health` 本机返回 200，Web/Host 指纹均匹配。ChatGPT 内置浏览器尝试打开 `/settings?section=appearance` 返回 `ERR_CONNECTION_REFUSED`；改用 `host.docker.internal` 仍返回 `ERR_HTTP_RESPONSE_CODE_FAILURE`。内置浏览器未能渲染目标页，因此没有实页通过截图；没有改账户设置。
- 未验边界：桌面与 390px 窄视口的实际页面排布、内容溢出、滚动及相邻区块尚未在内置浏览器实测；真实手机触屏、Electron/WebView 和帧时间未测。改动只涉及静态 DOM/CSS，不新增请求、订阅、计时器或观察器。

<a id="lfaa-writing-light-rays-background-20261026"></a>

## LFAA-WRITING-LIGHT-RAYS-BACKGROUND-20261026：写作光线背景与独立开关

### 目标、Owner 与边界

- 用户目标：在 `http://127.0.0.1:3000/apps/writing/normal` 的普通写作工作区增加类似 React Bits LightRays 的柔和光线背景，并可独立开灯/关灯。
- 运行入口：正式同源 Web；页面路由 `/apps/writing/normal`；共享 Client 宿主 `packages/client/ui-workspace` 装配 `packages/client/ui-writing`。
- Owner：写作编辑器与其工具栏归 `packages/client/ui-writing`；复用的 WebGL 光线组件归 `packages/client/ui-primitives`；账户外观配置、默认值、校验与持久化归 `packages/settings/settings`，共享类型/默认值归 `packages/util/values`，设置中心界面归 `packages/client/ui-settings`。
- 设置盘点：现有 `appearance.backgrounds.writing` 管理写作壁纸，`appearance.overlay`、`appearance.blur` 管理统一背景表面，`appearance.advanced.reducedMotion` 管理减少动态效果；此前没有光线背景开关。新增 `appearance.advanced.writingLightRaysEnabled`，默认开启，账户级保存；设置中心与写作工具栏共用这一字段。保留现有背景图、遮罩、模糊和其他账户偏好。
- 视觉来源：React Bits `LightRays`，JavaScript + CSS 变体，适配 LFAA React/TSX 与现有 CSS、主题令牌、减少动态效果和资源清理。上游代码来自用户附件；官方页面与 `LICENSE.md` 已核对。组件源码保留版权/许可声明，并在所属包 README 与本合同记录来源、许可及适用范围。
- 性能/安全/可维护性：此装饰层不接收或写入作品内容，不改变认证、权限或 Writing Owner；画布不截获指针/键盘，限制像素预算；未启用时卸载并释放 WebGL 资源，离屏/隐藏暂停，减少动态效果时显示静态光线并停止逐帧动画。未提供浏览器 WebGL 时显示主题驱动 CSS 后备。
- UI Skills：`ui-motion`（小型开关反馈、减少动态效果与动画清理）；`ui-ux-pro-max`（可访问开关、减少动态效果）。选用现有工具栏控制样式，不新增动效依赖或全站视觉改造。

### 允许范围与验收

- 允许修改：设置共享合同/默认值与 Settings Owner 校验归一化、设置中心开关、Writing UI 设置传递与快捷开关、`ui-primitives` LightRays 组件、受影响包 README、直接相关长期回归、此合同与 `docs/PROMPTS.md`。
- 禁止范围：不改 DSH，不安装或配置 MCP/插件，不修改其他 App 的背景、真实写作作品/章节/资料、账号凭据、权限模式或已有未提交画布/沙箱工作；验收不写入用户真实设置；不提交、发布或重启未知归属的既有服务。
- 批次 A（账户外观设置）：增加带默认值、服务端校验/兼容归一化和设置中心控件的账户级 `writingLightRaysEnabled`；运行 Settings/Client 类型及构建和相关回归；在正式 Web 设置页实页检查控件、标签、键盘焦点和桌面/窄视口，不切换真实账户的偏好。
- 批次 B（背景和快捷开关）：增加共享 LightRays 与 CSS 后备，将同一账户设置绑定到 `/apps/writing/normal` 的工具栏灯光开关；运行相关包构建/回归；在正式 Web 实页检查开/关、无作品空状态、已有作品布局、主题/减少动态效果映射及桌面/窄屏/短屏。需要写设置值时仅使用隔离账户或受控回归。
- 每批记录：源码/回归/类型/构建结果、页面路由、浏览器视口、交互与截图证据、未测范围。检查开关状态同步及保存失败反馈；观察卸载、隐藏、离屏和减少动态效果路径，不以构建代替浏览器/帧时间验收。

### 实施与验证记录

- 批次 A 已完成：在账户级 Appearance 合同增加 `appearance.advanced.writingLightRaysEnabled`（默认开启）；设置服务校验新值、将旧账户缺失值归一化为默认值，设置中心提供“写作光线背景”开关，并注明写作工具栏也可快捷控制。保留现有外观偏好。
- 批次 B 已完成：`ui-primitives` 提供 MIT + Commons Clause 的 React Bits LightRays 适配，读取外观强调色/主题；编辑器背景启用时按已有表面遮罩透出光线，工具栏灯光开关写入同一账户设置。空作品页保留开关。画布不接收指针；显式关闭时卸载组件；隐藏/离屏时暂停；减少动态效果时停止 RAF 并保留静态帧；WebGL 不可用时使用主题强调色 CSS 后备。像素预算 1.25 MP，帧时间未测。
- 许可证与分发：React Bits 官方 LightRays 源码按 MIT + Commons Clause 使用；版权、许可及来源随组件文件、`ui-primitives/THIRD-PARTY-NOTICES.md` 和 Web 发行产物 `dist/apps/web/THIRD-PARTY-NOTICES.md` 一并保留。组件集成在 LFAA 产品中，不单独销售/再分发。
- 定向回归：`pnpm.cmd --filter @yubboo/lfaa test -- tests/client-writing-light-rays.test.mjs tests/settings-contract.test.mjs`，4/4 通过。覆盖同一账户开关/设置入口、服务默认值/布尔校验/旧账户归一化/保存后重载，以及资源清理、减少动态效果和背景层合同。
- 类型与包构建：`pnpm exec tsc --noEmit -p tsconfig.client.json` 曾通过；`lfaa-client-ui-primitives`、`lfaa-client-ui-settings`、`lfaa-client-ui-writing`、`lfaa-util-values`、`lfaa-settings` 的相关包构建曾通过。正式 Control Plane/Web 构建也曾通过，且 Web 发行产物含许可证声明；随后共享工作区源码继续变化，故这些成功记录不代表当前 HEAD 的产物状态。Vite 有现存大块体积提示。
- 最终复核阻塞：最新 `pnpm.cmd run build:control-plane` 因共享工作区火山方舟 Plan 改动而失败，报错位于 `packages/api/settings-controller/src/index.ts:277` 和 `packages/settings/settings/src/service.ts:1058-1059,1384`（调用参数及 Provider 连接类型）；这些行不是本任务添加的光线设置代码，本轮保留其未提交改动，未代为修改。最新 `pnpm.cmd run build:web` 完成了 Vite 产物输出并包含 `THIRD-PARTY-NOTICES.md`，但源码在构建期间变化时有一次构建被指纹保护拒绝；重试的 Vite 阶段完成后，随即复核仍返回 `node scripts/runtime-build-state.mjs web` 为 `["host","web"]`、`node scripts/runtime-build-state.mjs host` 为 `["host"]`。因此当前正式产物未能确认与 HEAD 同步，正式菜单安全启动会先尝试重建。
- 内置浏览器实页（最终构建前）：实际路由 `http://127.0.0.1:3000/apps/writing/normal`。桌面 1655×1188 下空作品页显示顶部光线，开关 `aria-checked=true`、单个背景 canvas，页面宽度无溢出；短屏 900×480 下开关仍为开启且可见，编辑区无横向溢出。390×845 下文档宽度仍为 390px；当时右侧“作品信息”栏按当前布局偏好以抽屉覆盖正文区并提供关闭入口，开关在抽屉后不可见。没有为验收收起该面板，以免写入工作区布局偏好。截图证据由本轮 ChatGPT 内置浏览器实页捕获。
- 最终浏览器状态：构建产物在正式服务运行时更新后，内置浏览器显示“LFAA 需要重新启动”；健康接口仍返回 `status=ok`、`persistence=ready`。因 Control Plane 当前源码构建被前述并行修改阻断，未绕过指纹检查或强制重启服务；因此最新正式运行中的实际路由需要在 Host 构建恢复后重新验收。
- 为避免修改真实账户偏好，未点击真实写作工具栏/设置中心开关；关闭后的实时画面与浏览器内保存反馈未实测。隔离设置回归覆盖旧值迁移和 false 保存/重载；WebGL/减少动态效果分支由源码/回归合同检查，实际 GPU 帧时间、真实手机/平板设备和 Electron/WebView 未测。未新建或修改真实作品。
- `git diff --check` 通过。其他已有 Canvas、Sandbox 与设置响应式工作保持原样。

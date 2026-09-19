## v0.0.71 / #2.11 工作台 / 设置左栏宽度单一事实源

- `test/settings-shell.test.mjs`：锁定 App Shell 的单一 `leftPaneWidth` 同时注入主 Workbench 与 Settings；Settings 禁止独立宽度 state；
- `test/workbench-snap-animation.test.mjs`：锁定 `ResizableWorkbench` 受控 `leftWidth` 契约，原 snap/release 行为继续回归；
- Windows/Web 实机验收：先在工作台把左栏拖到明显宽度，进入 Settings 必须第一帧同宽；再在 Settings 调整宽度，返回工作台必须保持同宽；
- 首次升级应保留旧版本保存的工作台宽度，通过 `lfaa.workbench.layout.v5.leftWidth → lfaa.shell.left-pane-width.v1` 迁移。

## v0.0.68 / #2.8 Vite Native Config 兼容修复

- `node --test test/ai-web-host.test.mjs`：7/7 PASS；新增 Vite config/dev bridge 本地 ESM import 必须显式 `.ts`，并锁定 `allowImportingTsExtensions: true`；
- 禁止以 `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` 作为修复；
- Windows 实机验收：菜单 2 启动 Web 后，不再出现本任务对应的 `configLoader: native` extensionless import warning；
- `Re-optimizing dependencies because lockfile has changed` 若发生在真实 lockfile 变化后属于 Vite 正常行为。

## v0.0.67 / #2.7 Web API-Key Account 真实闭环

- `packages/config-system/test/*.test.mjs`：26/26 PASS；覆盖六家 Provider、Config Schema、Account Service、Secret 引用、重测/删除/回滚、Qwen 模型解析与 ChatGPT 套餐边界；
- `node --test test/ai-web-host.test.mjs`：6/6 PASS；锁定 Windows Credential Manager、Secret stdin、账户 JSON 无明文、同源 Host、错误脱敏、UI 不直连 Provider/浏览器存储；
- Config System `tsc --noEmit`：PASS；UI/App Shell 使用容器临时 React 类型 Stub 的补充 TypeScript：PASS；
- Settings/Profile/Theme、Workbench Snap、Dependency Setup、Node Dependency Health、Release Environment/Gates 全量回归；
- folder-boundary / import / governance / docs / comment / Windows BOM / config-schema / ui-contract 全部回归；
- Windows 实机验收：用真实 API Key 测试连接与模型列表；保存后检查 `.lfaa/state/ai-accounts.json` 不含 Secret；刷新后账户仍在；重启 Vite 后用 Credential Manager 重测；切模与删除真实生效。
- 当前制作容器不满足正式 Windows Node24 + pnpm11.17.0 + Cargo 环境，不声称 `release:full` 与 Credential Manager 动态实机通过。

## v0.0.66 / #2.6 Workbench 吸附反向展开动效

- `node --test test/workbench-snap-animation.test.mjs`：锁定 Pointer 未松手可反向释放、150ms release 状态、左右/Bottom 一致性与 reduced-motion。
- 用户实机重点：吸附收起后不松鼠标反向拉出，观察 `0 -> min` 是否连续，且继续拖拽是否立即恢复跟手。

## v0.0.64 / #2.4 Settings 与个人中心 UI

- `node --test test/settings-shell.test.mjs`：独立 Settings Surface、模糊聚焦个人菜单、三态主题、更新/主题顺序、AI Settings 分类 5 项静态契约；
- UI/App Shell 补充 TypeScript `--noEmit`；
- Config System 17/17 Provider/Schema 回归；
- folder/import/ui-contract/config-schema/governance 与 Windows BOM 回归。

## v0.0.63 / #2.3 配置系统目录边界与 AI Provider 插件体系验证

- `packages/config-system/test/*.test.mjs`：17/17 PASS；其中 Provider Registry / 六家插件契约 9 项，Config Schema 回归 8 项；
- `tsc -p packages/config-system/tsconfig.json --noEmit`：PASS；
- UI/App Shell 使用本容器临时 React 类型 Stub 的补充 TypeScript 检查：PASS，仅用于发现本次跨包类型错误，不替代项目锁定 pnpm 工具链；
- `node scripts/folder-boundary-check.mjs`：必须强制六个 Provider 子插件入口存在，并禁止 AI Core 厂商 Endpoint/分支、UI 直连网络/业务、App 包含厂商 API；
- governance / import / dev-log / docs / comment / Windows BOM / config-schema / release-gates / UI contract / release consistency / prompt lifecycle：全部回归；
- Web 实机验收重点：设置按钮打开共享 AI 设置页，六家 Provider 与认证/配置字段可切换；本版本不得把 Secret 明文写入 UI/localStorage/普通 Config。
- 当前容器无法联网取得 pnpm 11.17.0，故未执行并不冒充 `pnpm run build:web` / `pnpm run release:full` PASS。

## v0.0.62 / #20.16 pnpm 控制台直连原生输出修复验证

- `Install-NodeDependencies` 必须把交互式 install 交给 `Invoke-PnpmConsole`；
- Windows 原生路径必须使用 `cmd.exe` + `pnpm.cmd`、`Start-Process -NoNewWindow -Wait -PassThru`；
- 该路径禁止 stdout/stderr 重定向、捕获与 `Out-Null`；
- frozen/no-frozen、真实依赖、Store、菜单精简与发布 frozen 全部回归；
- Windows 实机：确认 Y 后必须出现 pnpm 原生 Scope / Packages / Progress / Done。

## v0.0.61 / #20.15 pnpm CMD 原生终端输出与菜单精简验证

- 静态契约：Windows 交互式 pnpm 写操作优先版本匹配的 `pnpm.cmd`；安装输出不得进入捕获/重定向链。
- 菜单 1：默认仅输出关键环境、node_modules / pnpm Store / Cargo / Rust toolchains 四类路径、状态摘要和必要确认；不得恢复大段依赖明细与实现说明。
- 菜单 7：完整 PNPM_HOME / 全局配置 / Store 来源 / lockfile / 状态缓存诊断保留。
- Windows 实机：需要安装时确认 Y 后必须出现 pnpm 原生 Scope / Progress / Packages / Done；第二次无变化时不得重复安装。

## v0.0.60 / #20.14 pnpm 原生安装输出恢复验证

- dependency-setup 必须确认菜单 1 的交互式 install 不包含任何 `--reporter=*`；
- `Invoke-Pnpm -> Invoke-ProjectCommand` 必须前台直接调用当前 pnpm runner，不能捕获/重定向 install stdout/stderr；
- #20.13 的 lockfile 落后 `--no-frozen-lockfile`、lockfile 完整修复 `--frozen-lockfile` 与正式发布 frozen 全部回归；
- Windows 实机：确认 Y 后必须直接出现 pnpm 原生终端安装信息；安装成功后二次运行菜单 1 不应重复安装。

## v0.0.59 / #20.13 开发期依赖同步与实时输出修复验证

- dependency-setup 必须覆盖 lockfile 落后使用 `--no-frozen-lockfile`、lockfile 完整修复使用 `--frozen-lockfile`、append-only reporter 与发布 frozen 不变。
- Windows 实机：在 lockfile 未覆盖声明时确认同步，必须立即看到 pnpm 实时输出；成功后再次运行菜单 1 不应重复安装。

# LFAA 测试与验收规范

## v0.0.58 / #20.12 PowerShell 自动变量冲突修复验证

- Windows 实机菜单 1 不得再出现“无法覆盖变量 HOME”；
- `Test-PnpmHomeInPath` 不得对 `$HOME`（含大小写变体）赋值；
- 所有 `scripts/windows/*.ps1` 扫描常见 PowerShell 自动/只读变量赋值冲突；
- #20.11 的 PNPM_HOME、active Store、Store 来源显示与 #20.10 真实依赖健康检查必须全部回归；
- PowerShell UTF-8 BOM 必须继续通过。

## v0.0.57 / #20.11 pnpm 实时环境事实与 Store 来源修复验证

验证重点是“机器级路径每次实时读取，缓存永远不能冒充环境事实”：

- `Get-PnpmStorePath` 必须每次调用当前 pnpm runner，并固定从项目根执行 `pnpm store path`；
- Store 路径不得来自 `.lfaa/state`、固定盘符、固定用户名或旧项目目录；
- 菜单 1 / 7 必须展示 pnpm executable、PNPM_HOME、全局配置文件、active Store 路径与 Store 来源；
- 仓库 `pnpm-workspace.yaml` 不允许出现 `storeDir`；
- 全局/项目 `storeDir` 均不存在时来源显示为 pnpm 默认；若存在项目配置则显示项目配置，存在全局配置则显示用户全局配置；
- v0.0.56 的真实 Node resolve、Store 缺失/为空、offline lockfile probe 全部回归。

Windows 实机重点：先确认 `pnpm store path` 当前返回值，再执行菜单 1；二者必须完全一致。之后修改/删除全局 `storeDir`，无需删除 `.lfaa/state`，重新运行菜单 1 必须立即显示新的 active Store。

已执行：dependency-setup 14/14 PASS；node-dependency-health 3/3 PASS；release-gates 5/5 PASS；release-environment 8/8 PASS；Config Schema 8/8 PASS；Node 治理链全部 PASS。当前容器没有 PowerShell，Windows 动态来源显示仍由用户实机验收。

## v0.0.56 / #20.10 真实依赖健康检测与 Store 状态修复验证

验证重点是“不再用缓存和 package.json 外壳冒充真实依赖健康”：

- 新增跨平台 Node 依赖健康检查测试，健康 fixture 必须通过；保留 package manifest 但删除真实入口文件时必须失败；
- `Get-NodeDependencyPlan` 在 unchanged 快速返回前必须消费真实解析结果，不能只看 fingerprint / `.modules.yaml` / package.json；
- `Get-PnpmStoreHealth` 必须检查 `pnpm store path` 对应真实路径，目录不存在或为空时状态不得为 Healthy；
- Store 缺失但项目真实解析通过时必须显示降级状态，不得输出“当前依赖均已就绪”；
- Store 修复使用 lockfile 定向 fetch / 同步，不允许 `pnpm update` 或清空 node_modules；
- node-pty 真实加载检查在 unchanged 路径同样执行；
- v0.0.55 的路径展示与提示去重、v0.0.54 的零安装/Yes-No 语义全部回归。

Windows 实机重点：先在完整环境运行菜单 1；再删除 `pnpm store path` 显示的 Store 后重跑，必须出现 Store 缺失/为空提示。若项目依赖仍能解析，应显示“项目当前可用但缓存缺失”；选择修复后再次运行应恢复为全部健康。

已执行：node-dependency-health 3/3 PASS；dependency-setup 11/11 PASS；release-gates 5/5 PASS；release-environment 8/8 PASS；Config Schema 8/8 PASS；Config System TypeScript `--noEmit` PASS；治理链全部 PASS。当前容器 Node 22.16.0、无 Cargo、无 PowerShell，因此 Windows PowerShell 动态 Store 删除/恢复仍必须由用户实机验收，且不声称 `release:full` PASS。

## v0.0.55 / #20.9 依赖提示去重与路径可见性验证

验证重点是“同一事实只提示一次，并能直接看到依赖在哪里”：

- `test/dependency-setup.test.mjs` 保留 #20.8 原 6 项契约，并新增路径可见性、重复提示禁止两项测试；
- 菜单 1 不允许再出现 Node/pnpm/workspace 的 `【预检】` 三行，也不允许结尾恢复独立 `Node/pnpm` 与 `Rust/Cargo` 两条完成摘要；
- `Show-DependencyLocations` 必须覆盖 Node `node_modules`、pnpm 虚拟仓库、运行时 pnpm Store、Node lockfile、本机状态缓存、Cargo registry/git、Rust toolchains、Cargo.lock；
- `pnpm Store` 必须由 `pnpm store path` 动态读取，禁止固定盘符/用户名；
- 菜单 7 环境检查复用同一位置函数；
- release gates / environment、Config Schema、Windows BOM 与治理链继续回归。

Windows 实机验收重点：菜单 1 在 unchanged 状态下应表现为“一组环境信息 + 路径 + Node/Rust 状态 + 一个总完成提示”，不再重复；所有路径应与当前机器真实目录一致。

已执行结果：dependency-setup 8/8 PASS；release-gates 5/5 PASS；release-environment 8/8 PASS；Config Schema 8/8 PASS；仓库 Node 治理链全部 PASS；Config System TypeScript `--noEmit` PASS。当前容器无 PowerShell，Windows 动态菜单仍由用户实机验收；当前 Node 22.16.0 / 无 Cargo，不声称 `release:full` PASS。

## v0.0.54 / #20.8 按需依赖增量检测与复用验证

验证重点是“依赖不变就不安装，真实变化才提示同步”：

- `test/dependency-setup.test.mjs`：依赖指纹不读取产品版本；unchanged 路径在 `Invoke-Pnpm install` 前直接返回；新增 / 删除 / 版本变化具备摘要；禁止自动升级与 store 清理；本机状态位于被忽略的 `.lfaa/state/`；Rust toolchain / Cargo fetch 具备复用门禁；
- `test/release-gates.test.mjs`、`test/release-environment.test.mjs` 与 Config Schema 单测继续回归；
- `scripts/release-gates-check.mjs` 必须锁定增量依赖关键 token，防止菜单 1 回退为无条件 install；
- Windows PowerShell 必须保持 UTF-8 with BOM；
- 当前 Linux 制作容器无法执行 Windows PowerShell 交互，因此 PS1 动态行为仍需用户 Windows 实机验收：第一次真实同步后，第二次再选菜单 1 应直接报告依赖已就绪，不再下载。

已执行结果：增量依赖 6/6 PASS；release-gates 5/5 PASS；release-environment 8/8 PASS；Config Schema 8/8 PASS；governance / import / dev-log / docs / comment / Windows BOM / release consistency / prompt lifecycle / config-schema / UI contract 全部 PASS；Config System TypeScript `--noEmit` PASS。当前容器 Node 22.16.0 且无 Cargo，正式发布环境/Rust 门禁按设计拒绝，未伪造 `release:full` 成功。

实机重点：先在依赖已完整的同一项目目录连续执行两次菜单 1；第二次不得出现 pnpm install / cargo fetch / rustup toolchain install。随后使用真正改变依赖声明/lockfile 的新版本时，应显示差异并询问 Yes/No。

## v0.0.53 / #20.7 Setup 菜单与发布门禁解耦验证

验证重点是“严格结果、不绑死入口”：

- `test/release-gates.test.mjs`：5/5 PASS；确认 quick 不 install/build/Rust，full 只增加 build，release:full 才拥有环境 + frozen install + Rust；并确认 Setup 的 1 为按需依赖、10 为三档检查中心；
- `test/release-environment.test.mjs`：8/8 PASS；
- Config Schema 回归：8/8 PASS；
- `scripts/release-gates-check.mjs`、`scripts/config-schema-check.mjs`：PASS；
- `scripts/windows/lfaa-setup.ps1` BOM：PASS；
- governance / import / dev-log / docs / comment / Windows BOM / release consistency / config-schema / release-gates / UI contract：全部 PASS；
- Config System 使用当前容器全局 TypeScript 5.8.3 的补充 `--noEmit`：PASS；该结果不替代项目锁定 pnpm/TypeScript 工具链；
- 当前制作容器仍不满足 Node 24 / pnpm 11.17.0 / Cargo，因此 `release:environment` 与 Rust 发布检查按设计 FAIL；没有伪造 `release:full` 成功结果。

最终候选 ZIP 仍需执行根目录、Unicode 路径、文件 Hash 与 PowerShell BOM Round-trip；结果由本次交付说明记录。

## v0.0.52 / #20.6 发布环境与质量门禁闭环验证

本版本验证重点不是新增业务功能，而是保证“不满足正式工具链时一定失败、满足时只有一条统一发布链”。

已执行：

- `test/release-environment.test.mjs`：8/8 PASS；覆盖 Node 24 正确 / Node 22 拒绝、pnpm 11.17.0 正确 / 错版本拒绝、lockfile 缺失拒绝、packageManager 与 engines 漂移拒绝，以及 preinstall 对正确/错误包管理器版本的行为；
- `packages/config-system/test/*.test.mjs`：8/8 PASS，确认本治理任务未破坏 Config Schema；
- `tsc -p packages/config-system/tsconfig.json --noEmit`：PASS（当前容器全局 TypeScript 5.8.3，仅作为补充检查，不冒充项目锁定 pnpm 工具链）；
- import / dev-log / docs / comment / Windows BOM / config-schema / release-gates / UI contract：PASS；
- 当前容器执行 `node scripts/release-environment-check.mjs`：按设计 FAIL，明确指出 Node 22.16.0 不满足 Node 24.x；
- 当前容器执行 `node scripts/release-rust-check.mjs`：按设计 FAIL，明确指出 Cargo 不存在；
- Corepack 尝试准备 `pnpm@11.17.0` 时因当前容器不能访问 npm registry 而失败，因此没有伪造 `pnpm install --frozen-lockfile` / Web build / `release:full` 成功结果。

### v0.0.52 自举规则

本版本本身用于把正式发布门禁固化进仓库，因此记录上述环境阻断事实并交由用户验收。从 **v0.0.52 之后的下一递增版本开始**，正式 `LFAA-vX.Y.Z.zip` 生成前必须在满足 Node 24.x + pnpm 11.17.0 + Rust/Cargo 的环境真实执行：

```text
pnpm run release:full
```

只有该命令完整通过，才允许记录“完整发布门禁 PASS”。

## v0.0.51 / #2.2 Config Schema 基线验证

- TypeScript `--noEmit`：PASS；
- Config Schema 单元测试：8/8 PASS；
- `scripts/config-schema-check.mjs`：PASS；
- `governance:check` 所含 10 个实际 Node 门禁逐项执行：全部 PASS；
- Windows PowerShell BOM：PASS，且 v0.0.50 → v0.0.51 四个 `.ps1` SHA-256 完全一致；
- 性能：100 Provider + 100 Account + 100 Model，1000 次纯内存校验，P95 约 0.61ms，低于 10ms 预算；
- 当前执行环境无法联网取得项目锁定的 pnpm 11.17.0，因此没有伪造 `pnpm run governance:check` 包装命令执行结果；用户环境仍应通过 `LFAA-Setup.bat` 后执行一次正式 pnpm 入口复验。


> 所有测试策略、Web UI 验收矩阵和 Definition of Done 测试要求统一维护在本文件。

## v0.0.51 / #2.2 Config Schema 基线

本版本只验收 Config Schema，不把 Storage / Migration / UI 测试提前算入通过。

必须执行：

```text
pnpm --filter @lfaa/config-system exec tsc -p tsconfig.json --noEmit
pnpm --filter @lfaa/config-system test
node scripts/config-schema-check.mjs
pnpm run governance:check
```

核心用例：默认配置通过；错误 Schema Version 拒绝；Provider / Model / Account 重复 ID 拒绝；悬空 Provider / Account 引用拒绝；Model 与 Account Provider 不一致拒绝；remote mode 缺 Endpoint 或非 http/https 拒绝；API Key / Token / Secret / Password 等明文字段拒绝；`credentialRef` 合法引用通过。

性能边界：校验为纯内存 O(n)，Provider / Model / Account 各 100 项时目标 P95 < 10ms；不得进行磁盘、数据库、网络或进程 I/O。


> 迁移来源：`docs/testing/WEB_UI_TEST.md`

## Web 工作台本地测试

### v0.0.49 / #21.17 Composer 底部安全间距重点

本版本在 v0.0.48 基础上只验证 Composer 垂直落点：

1. 1600x900 / 1280x800 等桌面尺寸下，输入框下方留白明显比 v0.0.48 舒适；
2. Composer 不贴窗口底边，也不能悬得过高；
3. Compact 下底部留白应自动减小；
4. Mobile 下保持较小留白并尊重 safe-area；
5. 打开 Bottom Terminal 后，Composer 与终端上沿之间仍保持自然距离；
6. 不允许出现横向溢出或对话区被异常压缩。

### v0.0.47 / #21.15 容器响应式与布局变量化重点

本版本优先验证：

1. 小窗口不再同时被固定 280 / 360 侧栏挤压；
2. LayoutMode 根据 Workbench 容器实际可用宽度计算，而不是 window 固定断点；
3. 1024 左右可在空间允许时保持合理双 Dock；
4. 950 / 820 / 760 左右自动进入左 Dock + 右 Overlay；
5. 更窄容器进入双 Overlay；
6. 大屏保存的侧栏宽度切到小窗后自动重新 clamp；
7. 左 / 右 / Bottom 到动态 min 后吸附收起；
8. Pointer 不松手时仍能从 snap preview 反向拖回；
9. CSS 变量 / clamp / calc 不产生横向溢出；
10. Tooltip / Header / Composer 保持可用。

### 前置

```text
Node 24.x
pnpm 11.17.0
```

### 启动

```text
LFAA-Setup.bat
→ 2 启动 Web
```

浏览器：

```text
http://127.0.0.1:5173
```

### 1. 响应式矩阵

依次把“浏览器内容区 / 工作台容器”调到接近：

```text
1600x900
1280x800
1100x800
1024x768
950x800
820x900
760x900
680x800
640x800
390x844
```

不要只看浏览器外框像素；最终以页面内容区实际宽度为准。

#### 期望

- 1600 / 1280 / 1100 / 1024：通常能进入 Desktop 双 Dock；
- 950 / 820 / 760 / 680：通常为 Compact（左 Dock + 右 Overlay）；
- 640 / 390：Mobile（双 Overlay）；
- 实际 Mode 由计算公式决定，边界附近允许因容器高度/宽度计算产生少量差异。

### 2. Desktop 双 Dock

1. 左 / 中 / 右三栏均参与布局；
2. 左 / 右默认宽度随容器变化，不是固定 300 / 400；
3. 中央区不得被压成细条；
4. Right Header 与 Center Header 底边连续；
5. 收起右栏后 Shell Actions 回到 Center Header；
6. 页面无水平滚动。

### 3. Compact：左 Dock + 右 Overlay

1. 左栏参与布局；
2. 右栏打开后覆盖在主区右侧，但不改变 Center 宽度；
3. 右 Overlay 大约为容器 34%，并受 15rem~20rem clamp 约束；
4. Overlay 从 Header 下方开始；
5. 终端 / 右栏按钮始终在 Center Header；
6. 关闭右 Overlay 后中央区几何不能跳动；
7. 从 1280 缩到 900 时，历史左栏宽度不能原样过大保留。

### 4. Mobile：双 Overlay

1. Center 占满可用宽度；
2. 左右栏默认收起；
3. 点击左栏 / 右栏按钮分别出现 Overlay；
4. Overlay 不参与 Center 几何；
5. Header 核心三个控制入口保留；
6. Tooltip 可隐藏；
7. Composer 不超出页面；
8. 不产生整页横向滚动。

### 5. 动态侧栏最小宽度

不要用“必须正好 280 / 360”验收。

当前公式输出大致：

```text
左 min：196~232
右 min：228~288
Bottom min：136~176
```

验证：

- 左栏在 min 时导航文字仍可读；
- 右栏在 min 时“审查 / 终端 / 浏览器 / 文件 + 快捷键”仍可正常排布；
- 如果容器不足以让右栏 Dock 后保持可用 Center，应切 Compact，而不是继续缩 Center。

### 6. 左侧 Resize / Snap

Desktop / Compact：

1. 向内拖左 separator；
2. 到本次动态 min 后进入 snap preview，视觉吸到 0；
3. 不松手，反向拖；
4. 超过 `min + snapHysteresis` 后恢复到 min；
5. 继续向外正常拉宽；
6. 再拖到 min 并松手，正式 collapsed；
7. collapsed 后 separator 不能拉开；
8. 用按钮 / `Ctrl+B` 恢复。

### 7. 右侧 Resize / Snap

仅 Desktop Dock：

步骤同左侧。Compact / Mobile 的右栏是 Overlay，不显示右 resize separator。

正式收起后用按钮 / `Ctrl+Alt+B` 恢复。

### 8. Bottom Resize / Snap

1. 打开 Terminal Dock；
2. 向下拖；
3. 到动态 bottom min 后 snap preview 收到 0；
4. 不松手向上反拖，超过 hysteresis 后恢复；
5. 松手确认收起后底边不能直接拉出；
6. 用 Header / `Ctrl+J` / 右栏“终端”入口恢复。

### 9. Tooltip

Desktop / Compact：

- 只出现一层自定义 Tooltip；
- 左栏提示向右展开；
- 终端 / 右栏提示向左展开；
- `Ctrl+B / Ctrl+J / Ctrl+Alt+B` 正确；
- 等待数秒不能再出现浏览器原生 `title`；
- Tooltip 不拦截 Click。

### 10. 左栏 Hover Preview

Desktop / Compact：

1. 正式 collapsed 左栏；
2. Hover 左栏按钮；
3. Preview 淡入但不改变 `leftCollapsed`；
4. 鼠标移动到 Preview 不闪退；
5. 离开后淡出；
6. Click / `Ctrl+B` 才正式展开。

### 11. 动画手感

慢速拖拽确认：

- 普通 Resize 直接跟手；
- 没到 min 前无 Grid transition 追鼠标；
- 到 min 才有短磁吸收起；
- 反向解锁不会卡住；
- 正式开合使用 ease-out；
- Drawer 打开 / 关闭不会推挤 Center。

### 12. 基础设施回归

保持原有验收：

- xterm + node-pty 可交互；
- Resize 后 FitAddon 正常；
- `.lfaa` 资源热刷新；
- Sync / GitHub / Setup / Update 行为不变化；
- Windows PowerShell BOM 保留。

### 12. Hover / Click 左栏宽度一致性

1. 记录正式左栏宽度；2. 收起；3. Hover 左栏按钮；4. Preview 宽度应与记录一致；5. 点击展开，宽度不得跳变；6. 手动 resize 后重复一次；7. 缩窄窗口触发 clamp 后再重复一次。

### 13. Composer 底部留白验收

分别测试 Desktop / Compact / Mobile：

- Composer Wrap 实际底部留白来自 `--agent-composer-bottom-gap`；
- Desktop 约为 1rem~1.75rem，随可用高度变化；
- Compact 比 Desktop 更紧凑；
- Mobile 不小于 `.75rem`，有 safe area 时取更大值；
- 不存在额外 `margin-bottom` / `transform: translateY()` 叠加位移；
- 缩放窗口时留白变化连续，不突然跳动。

> 迁移来源：`docs/testing/TEST_STRATEGY.md`

## LFAA 测试策略

### TypeScript

- Unit
- Integration
- Protocol contract
- Fake Model
- Event replay

### React

- Component
- Feature
- Web E2E
- Desktop smoke E2E

### Rust

- Unit
- Broker integration
- Path boundary
- Process cancellation
- Secret redaction

### Agent

- Fixture
- Repeated run
- Verifier
- Cost
- Latency
- Pass rate
- Regression baseline

### Durable Run

必须覆盖：

- model stream 中断
- tool 执行中断
- tool 已完成但下一步未执行
- runtime 重启
- UI reload


## #2.9 设置中心共享可伸缩侧栏

- `node --test test/settings-shell.test.mjs`：检查 Settings 直接复用 ResizableWorkbench、无固定侧栏宽度、支持收起/展开与单侧 Surface；
- `node --test test/workbench-snap-animation.test.mjs`：保证共享 snap capture / hysteresis / 反向 release 动效没有回归；
- 用户实机：拖动 Settings 左栏改变宽度；拖到最小吸附收起；Pointer 不松手反向拉出；松手收起后点击展开按钮恢复；关闭重开设置后宽度持久化。

## v0.0.70 / #2.10 UI Workspace 运行时导入解析

- `node --test test/runtime-import-resolution.test.mjs`：验证 Settings 使用 `@lfaa/ui/workbench`、package exports 目标存在、从真实 Settings importer scope 可由 Node package resolver 解析。
- `node scripts/runtime-import-resolution-check.mjs`：扫描 workspace `@lfaa/*` 公共子路径与 packages 私有 alias，防止 TypeScript-only 假通过。
- Windows 用户验收：菜单 2 启动 Vite，确认不再出现 `@/workbench` import-analysis 错误，并实测 Settings 左栏 resize/snap/release。

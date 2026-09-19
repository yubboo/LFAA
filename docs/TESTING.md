# LFAA 测试与验收规范

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

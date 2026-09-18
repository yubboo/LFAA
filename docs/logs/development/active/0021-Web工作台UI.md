# #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.15
- **状态：** active
- **关键词：** Web、容器响应式、Dock、Overlay、Resize、Snap、Layout Tokens、Terminal
- **当前文件：** `docs/logs/development/active/0021-Web工作台UI.md`

## 当前结论

v0.0.47 不再使用 `1240 / 760` 这类固定 viewport 断点，也不再由 App Shell 写死 `左 280 / 右 360` 的面板尺寸。

当前几何事实统一为：

```text
工作台容器尺寸
→ resolveWorkbenchLayoutMetrics(width, height)
→ 计算 left/right/bottom 的 min / initial / max
→ 计算 minCenterWidth / snapHysteresis
→ 自动选择 Desktop / Compact / Mobile
→ ResizableWorkbench + CSS data-layout-mode 执行布局
```

响应式依据是 `agent-workbench-stage` 自身尺寸，由 `ResizeObserver` 监听；不依赖整个浏览器窗口宽度。

## #21.15 容器响应式与布局变量化

### 问题来源

用户 Windows 实机验证 v0.0.46 后发现：

1. 固定 `280px / 360px` 最小宽度在小窗口中过大，会把中央区挤成窄条；
2. Desktop / Compact / Mobile 使用固定 viewport 断点，不能根据左右栏、中央区实际可用空间决定布局；
3. CSS 与 TS 分别维护固定尺寸，后续调整容易漂移；
4. Compact 虽把右栏改成 Overlay，但左栏仍可能保留大屏持久化宽度，继续压缩中央区；
5. ChatGPT / Codex 类布局的核心不是“某个固定 px”，而是根据容器空间决定 Dock / Overlay，并保持主区优先。

### 当前实现

新增统一布局计算器：

`packages/ui/src/workbench/workbench-layout.config.ts`

它集中保存：

- 左栏、右栏、底部面板的 `ratio / floor / ceiling`；
- 中央区舒适宽度规则；
- separator 预算；
- snap hysteresis 规则；
- Desktop / Compact / Mobile 的自动判定公式。

当前参考计算结果：

```text
1600px → Desktop，左 initial≈288，右 initial≈360
1280px → Desktop，左 initial≈243，右 initial≈307
1024px → Desktop，左 initial≈216，右 initial≈252
950px  → Compact，左 Dock，右 Overlay
760px  → Compact，左 Dock，右 Overlay
<680px → Mobile，左右 Overlay
```

这些结果不是断点常量，而是由容器宽度与各区域需求共同计算。

### 最小宽度原则

当前动态范围大致为：

```text
左栏 min：196 ~ 232 CSS px
右栏 min：228 ~ 288 CSS px
Bottom min：136 ~ 176 CSS px（跟容器高度计算）
```

`px` 只作为 Pointer 几何最终结果和安全 floor/ceiling；业务层不再直接写固定 `LEFT_LIMITS / RIGHT_LIMITS / BOTTOM_LIMITS`。

### Dock / Overlay 规则

```text
Desktop
→ 左 / 中 / 右同时 Dock
→ 只有容器真的能放下三者才进入

Compact
→ 左栏 Dock
→ 右栏 Overlay
→ 右栏不参与中央区宽度计算

Mobile
→ 中间主区全宽
→ 左右都 Overlay
```

Overlay 宽度使用 CSS 变量 + `clamp()` / 百分比，不再使用旧的 `420px / 56vw / 88vw` 方案。

### 拖拽 / 吸附规则保持

```text
展开
→ 正常跟手 Resize
→ 到当前动态 min
→ snap preview 吸到 0
→ Pointer 不松手，反向超过 min + hysteresis 可恢复
→ Pointer Up 时仍 snapped 才正式 collapsed
```

正式 collapsed 后 separator 不能重新展开，只能通过 Header 按钮 / 快捷键恢复。

### 持久化尺寸修复

容器缩小时，`ResizableWorkbench` 会重新 clamp 历史宽度：

- 先 clamp 到当前动态 `min/max`；
- 再 clamp 到“中心区保护”计算出的 dynamic max；
- Compact / Mobile Overlay 不再错误参与另一侧 Dock 的动态 max。

这避免“大屏保存的 340px 左栏 → 小窗仍保持 340px”导致主区崩溃。


## 最新变更

### #21.15 容器响应式与布局变量化

- 新增 `workbench-layout.config.ts` 作为几何单一事实源；
- 使用 ResizeObserver 读取工作台容器，而不是固定 window breakpoint；
- 移除 App Shell 固定 pane limits；
- Desktop / Compact / Mobile 改为基于可容纳空间的计算结果；
- 历史 pane width 随当前容器重新 clamp；
- CSS 改用变量 / rem / clamp / calc；
- 保留三向 min snap / reverse unlock / Pointer Up commit。

## 历史基线

- #21.14 已归档：`archive/0021-14-最小尺寸吸附收起语义修正.md`
- #21.13 及更早继续保留在 archive。

## 影响范围

- `packages/ui/src/workbench/workbench-layout.config.ts`（新增）
- `packages/ui/src/workbench/workbench-layout.types.ts`
- `packages/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/ui/src/workbench/workbench.css`
- `packages/ui/src/index.ts`
- `packages/app-shell/src/AgentWorkbench.tsx`
- `packages/app-shell/src/agent-workbench.css`
- `scripts/ui-contract-check.mjs`
- 当前 UI / Test / Code Map / Prompt / Plan / Progress / Changelog / Release 文档

## 不影响

- Sync / GitHub / Setup / Update 业务逻辑；
- xterm / node-pty PTY bridge；
- Agent Runtime / Tool Runtime / Permission Engine；
- Config / Secret Store / Rust Native 边界。

## 当前验收

静态门禁必须确认：

- App Shell 不存在 `LEFT_LIMITS / RIGHT_LIMITS / BOTTOM_LIMITS` 固定常量；
- 响应式使用 `ResizeObserver` + `resolveWorkbenchLayoutMetrics`；
- `workbench-layout.config.ts` 存在 ratio/floor/ceiling 单一事实源；
- CSS 使用 `data-layout-mode` + CSS 变量 + `clamp()`；
- 旧 `1240 / 760` 双维护断点不回归；
- 旧 `420px / 56vw / 88vw` Drawer 不回归；
- 三向 min 吸附收起、Pointer 反向解锁、Pointer Up 提交保持；
- 大屏持久化宽度在小容器内重新 clamp；
- Windows PowerShell BOM / 基础设施脚本不回退。

真实视觉仍需 Windows Chrome / Edge 多尺寸实机验证。

## 验证结果

发布前必须通过： governance / imports / dev-log / docs / comments / Windows BOM / release consistency / UI contract / TS syntax / ZIP round-trip。

当前静态契约重点：容器响应式、变量化几何、旧固定断点禁止回归、三向 snap 保持。


## 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 - #21.13 | superseded / delivered | `archive/` 对应历史文件 |
| #21.14 | superseded | `archive/0021-14-最小尺寸吸附收起语义修正.md` |
| #21.15 | active | `active/0021-Web工作台UI.md` |

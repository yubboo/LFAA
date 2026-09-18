# 中文代码注释与可读性规范

> 目标不是“给每一行翻译中文”，而是让第一次打开项目的人能知道：这个文件干什么、状态归谁、和谁关联、页面哪块由它负责。

## 1. 关键实现文件必须有结构化文件头

关键 TS / TSX / JS / MJS / CSS / PowerShell 文件必须在文件开头说明：

```text
文件：
作用：
负责：
不负责：
状态归属：
对外接口：
关联文件：
修改注意事项：
```

TypeScript 示例：

```ts
/**
 * 文件：AgentWorkbench.tsx
 * 作用：共享工作台壳。
 * 负责：区域编排和 Shell UI 状态。
 * 不负责：PTY 创建和拖拽算法。
 * 状态归属：Shell collapsed/open 状态归本组件。
 * 对外接口：AgentWorkbench。
 * 关联文件：agent-workbench.css、ResizableWorkbench.tsx。
 * 修改注意事项：不要制造第二份 collapsed 状态。
 */
```

PowerShell 使用同样字段的 `#` 注释。

## 2. 什么叫“关键实现文件”

至少包括：

- 页面 / Feature 主组件；
- Layout / 状态 Owner；
- 与 OS / 网络 / PTY / 文件系统交互的桥接代码；
- 关键类型契约；
- 关键 CSS；
- Setup / Sync / GitHub / Update 等用户会直接运行的脚本；
- 治理 / 安全检查脚本。

纯占位骨架可以使用较短模块说明，但一旦加入真实逻辑，就升级为完整文件头。

## 3. 复杂代码必须解释“为什么”

重点注释：

- 为什么这样设计；
- 状态为什么归这个文件；
- 边界在哪里；
- 与哪些模块关联；
- 哪些事情明确不属于本文件；
- 算法的关键不变量；
- 容易被误改的地方。

例如拖拽吸附要说明：

```text
为什么使用 requestAnimationFrame
为什么需要 hysteresis
为什么 collapsed 后 separator 不能反向展开
```

禁止把每一行代码逐字翻译成中文制造噪声。

## 4. CSS 必须按“盒子 / 区域”分区

关键 CSS 文件除了文件头，还必须写清楚 DOM / 盒子关系。

推荐：

```css
/**
 * 文件：agent-workbench.css
 * 盒子结构：
 * .agent-theme
 * ├─ .agent-web-header
 * └─ .agent-workbench-stage
 *    └─ .agent-center
 */

/* ===== 1. 全局和主题 ===== */
/* ===== 2. 左右侧栏 ===== */
/* ===== 3. 中间主区 ===== */
/* ===== 4. 输入框 ===== */
/* ===== 5. 右栏 ===== */
/* ===== 6. 终端 ===== */
```

CSS 注释必须能回答：

- 这组 selector 对应页面哪一块；
- 这个盒子的父子关系是什么；
- 几何布局由当前文件还是另一个 Layout 文件负责。

## 5. 目录必须能被人读懂

项目一级业务 / 技术目录应有 README 或在项目地图中有明确入口。

当前总地图：

```text
docs/项目结构与代码地图.md
```

至少需要覆盖：

- 根目录文件 / 目录；
- `apps/`；
- `packages/`；
- `crates/`；
- `scripts/`；
- `docs/`；
- 当前重点功能的源码调用链。

目录职责发生变化时，必须同步项目地图。

## 6. 代码与文档必须互相指路

关键源码文件头的“关联文件”要指向直接相关实现。

目录 README / 项目地图则要从人类视角告诉读者“下一步去哪”。

例如 Web UI：

```text
App.tsx
→ AgentWorkbench.tsx
→ agent-workbench.css
→ ResizableWorkbench.tsx
→ workbench.css
→ LocalTerminal.tsx
→ vite.config.ts
```

## 7. 治理门禁

关键文件注释由：

```text
scripts/comment-check.mjs
```

检查。

`governance:check` 必须包含该检查，防止以后新增真实逻辑后又出现“代码能跑，但没人看得懂”的回退。

## 8. Windows PowerShell 注释与编码必须同时成立

`scripts/windows/*.ps1` 既属于关键实现文件，也属于 Windows PowerShell 5.1 可直接执行的用户脚本。

因此必须同时满足：

```text
结构化中文文件头
+
UTF-8 with BOM
```

禁止出现：

```text
为了统一 UTF-8 no BOM
→ 重写 .ps1
→ BOM 丢失
→ Windows PowerShell 5.1 误解码
```

任何批量格式化、脚本生成、Python/Node 重写 `.ps1` 时都必须显式保留 BOM。

自动检查：

```text
node scripts/windows-script-encoding-check.mjs
```

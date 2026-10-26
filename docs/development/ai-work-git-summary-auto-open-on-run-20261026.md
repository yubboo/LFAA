<a id="lfaa-ai-work-git-summary-auto-open-on-run-20261026"></a>

## LFAA-AI-WORK-GIT-SUMMARY-AUTO-OPEN-ON-RUN-20261026

### 用户问题、目标与入口

- 用户问题及影响：AI Work 中小鱼 Agent 开始工作时，Git 摘要卡片仍处于收起状态，用户要手动展开。
- 当前行为/复现步骤：在 `/work` 收起 Git 摘要并提交一轮 Agent 工作，工作开始后摘要仍收起。
- 期望的用户可见结果：每次新的主聊天 Agent Run 进入忙碌状态时自动展开 Git 摘要；手机布局同步打开左侧摘要页；后续状态变化不反复覆盖用户手动开合。
- 运行入口、页面/路由和使用范围：Web/Desktop 共用 Client，AI Work `/work` 主聊天与现有 Git 摘要卡。

### Owner、设置与数据边界

- 真实调用链和唯一 Owner：`AiWorkChat` 依据主 Agent Run 的 `busy` 状态通知 `ApplicationWorkspace`；`packages/client/ui-workspace` 持有 Git 摘要卡开合与 Git 仓库联动。会话 Run 事实由 Agent Loop/Session Owner 提供，不复制或推断运行状态。
- 相关设置、默认值、读取/持久化：未涉及新设置；沿用既有工作台布局/外观偏好，不改默认值或用户偏好。
- 账户/项目/节点数据、权限与认证边界：不新增数据读写、权限或认证路径。自动展开沿用用户手动打开时的既有 Git 绑定与状态读取逻辑。

### 修改范围与验收

- 允许修改：工作台忙碌状态到 Git 摘要开合的联动、相关包 README、任务索引与本合同。
- 禁止改变：Agent Run 行为、Git 数据/操作、权限策略、设置持久化、摘要响应式阈值及既有手动开合行为。
- 可观察验收条件：新 Run 从空闲转为运行时展开摘要；运行中重复 busy 通知不重复触发绑定；手机布局展开左侧摘要页且不覆盖保存的布局偏好；空闲状态和摘要手动开合保持原行为。直接构建/类型检查通过；内置浏览器 `/work` 检查实际页面。真实 Run 未启动时，须明确记录自动展开边沿及手机边沿未实测。

### 实施与验收记录

- 具体方案：复用 `AiWorkChat` 现有 `onBusyChange` 回调，仅响应空闲到忙碌的边沿；调用现有 Git 摘要开合处理器，沿用会话仓库绑定与状态读取。手机模式临时展开左侧摘要页，并保留 `responsiveLeftRestore` 对保存布局偏好的保护。回调使用最新处理器 ref，避免属性身份变化伪造 Run 边沿。
- 变更文件：`packages/client/ui-workspace/src/ApplicationWorkspace.tsx` — 真实 Run 开始时展开摘要，手机同步显示左侧摘要页；`packages/client/ui-workspace/README.md` — 记录行为 Owner 与状态来源；`docs/PROMPTS.md` — 任务索引；本合同 — 记录实施与验收结果。
- 实际验证：`pnpm.cmd --filter lfaa-client-ui-workspace run build` 通过；`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json` 通过；最终 `pnpm --filter lfaa-web run build` 通过（3876 modules），包含 Client TypeScript 检查；构建后 `node scripts/runtime-build-state.mjs web` 返回 `[]`，`git diff --check` 通过。未运行自动化测试。构建产物只写根 `dist/`。
- 实际页面验收：用户授权重启后，使用正式入口 `pnpm.cmd lfaa web --no-local-daemon` 重启当前 checkout 的 Web；`/api/health` 返回 200，ChatGPT 内置浏览器 `/work` 返回 200。默认视口约 1312×1244，历史空闲会话的 Git 摘要入口可见且保持收起；另以 390×844 检查手机布局，当前打开的是工作区新标签页，因此摘要入口不在当前 DOM 中。视口已恢复。未启动真实 Agent Run；因此空闲→运行自动展开、重复 busy 通知及手机运行边沿未做端到端验证。页面截图仅保留在本轮浏览器观察中，没有导出文件。
- 性能/安全/可维护性证据与未测边界：复用既有 `busy` 通知和摘要开合处理器，只在空闲→运行边沿触发一次；稳定回调与最新处理器 ref 避免重复订阅/属性变更误触发；Git 状态/仓库绑定沿用既有认证 Owner，无新增轮询、权限、持久化或设置。真实 Agent 运行、Run 边沿交互、手机运行边沿及帧时间未测。
- 同步的权威文档及链接：[`ui-workspace/README.md`](../../packages/client/ui-workspace/README.md) 记录触发和手机临时开合行为；任务索引见 [`docs/PROMPTS.md`](../PROMPTS.md)。

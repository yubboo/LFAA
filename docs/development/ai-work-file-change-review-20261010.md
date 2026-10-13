# AI Work 文件变更审阅合同

## 目标、入口与 Owner

入口为 Web/桌面共享 AI Work `/tasks`。Agent Loop 只从真实成功的文件 Tool 结果生成活动元数据；项目文件内容与 CRUD 执行仍归 `project-files-v1` Daemon Owner；Session JSONL 沿用既有活动记录；`packages/client/ui-chat` 展示变更；`packages/client/ui-workspace` 负责已登记项目与 Git Owner 的适配；行级 diff 和编辑仍由已有 `GitChangeReview`、Workspace Controller 与目标 Daemon Git/项目文件 Owner 提供。

用户可在助手回复的可折叠工作轨迹中查看模型本轮成功读取、创建、修改、删除的文件路径；修改类条目可针对当前有已登记项目绑定的会话打开该项目 Git 差异和内置编辑器。写操作仍由大模型依据目标选择工具，经 Agent Loop 和统一 `permissions.mode` 授权后派发；Daemon 只执行所选节点文件操作并返回真实结果。

## 记录与路径合同

- 只有项目文件工具成功返回后，才记录 `read`、`created`、`modified` 或 `deleted`；读取只保存路径，`write`/`replace` 仅在 `changed === true` 时记录为修改。创建文件树最多记录其真实返回的 128 项文件。失败、待确认、结果未知、无变化不显示为成功改动。
- Daemon 为成功 read 和 mutation 结果增加以 `/` 分隔的项目相对 `relativePath`，保留既有绝对 `path` 和结果字段兼容性。Session 活动仅保存操作枚举、相对路径和可空的已登记 `projectId`；不保存文件正文、replace 旧/新文本、原始参数、原始结果、散列或隐藏推理。
- Session 读取校验操作枚举、路径长度和相对路径段，拒绝绝对路径、空段、`.`、`..`、控制字符及超量记录。Client 只显示校验通过的结构化记录。
- Git 状态使用仓库相对 `path`，项目文件结果使用登记项目相对路径；工作区须通过当前项目真实 Git 状态中的 `projectPath` 精确匹配后，再将状态返回的 `path` 传给现有差异审阅器。不能由模型或浏览器提供任意绝对路径。
- Git 审阅显示当前项目的真实基线差异。源项目基线可能包含此前已有的工作区改动；Git 本身不能证明每一行都由当前模型调用引入。AI Worktree 使用已有创建快照作为基线。无 Git、无当前差异、路径已提交/忽略或项目访问失败时，不伪造差异，向用户显示真实原因。

## 配置、修改边界与安全

沿用 `permissions.mode`；界面沿用 Appearance 中现有的主题、字体/字号、强调色、遮罩/模糊和减少动态效果。没有新增设置，因此不重置用户偏好。

允许修改项目文件工具的结果投影、Agent Loop 的结构化活动、Session 与 Client 活动类型/读取校验、AI Work 活动 UI、工作区 Git 审阅桥接、直接相关回归及必要包/架构说明。

禁止新增文件操作器、Git 命令执行器、Diff/编辑器或并列的存储/权限 Owner；禁止通过任意路径或未经认证的 Git API 打开文件；禁止在活动记录持久化正文、原始参数/输出或凭据；禁止自动应用补丁、提交/恢复工作树、重启现有服务及改动无关工作树文件。

## 验收

- 成功 read/read_lines/read_image、create/write/replace/delete 和 `create_tree` 展示真实操作及项目相对文件路径；失败、未知、无变化不产生成功活动记录。只有实际变更的路径进入 Git 差异审阅。
- 结构化活动经过 Session 持久化、快照和 SSE 后仍可读取，非法字段/路径被拒绝；记录不含文件内容。
- 绑定项目中的变更路径能在 Git 状态中映射至同一条仓库相对路径并打开已有行级差异和编辑器；没有真实差异或 Git 不可用时显示实际错误。
- 回归覆盖 CRUD 证据、文件树上限、路径映射、Session 校验及 UI 跳转。受影响包构建、TypeScript、工作区 Gate 与差异检查按仓库当前实际脚本运行。构建产物仅写入根 `dist/`。
- 未实际操作的真实 Provider、浏览器点击/视觉、帧时间、运行中服务和桌面验收明确标记未测。

## 实施与验证记录

已完成实现：项目文件 Daemon read/mutation 结果补充项目相对路径；Agent Loop 仅从真实成功的读取及实际发生的变更生成有界结构化活动；Session 校验并持久化该活动；AI Work 展示操作类型与路径；绑定登记项目时复用现有 Git 状态映射、行级差异审阅与编辑器。读取仅显示路径，不保存正文；未绑定项目不会提供路径跳转。未新增设置，沿用 `permissions.mode` 与 Appearance 设置。

验证结果：Agent/项目文件/Session/UI 定向回归 40/40 通过；`pnpm run typecheck`、`pnpm run check:workspace`（178 包）、受影响包构建、`pnpm run build:control-plane`、`pnpm run build:web` 均通过；`git diff --check` 通过。Web 构建有现存的大 chunk 提示，不影响构建成功。

未验证：真实浏览器中的点击与视觉效果、帧时间、运行中服务热加载、Provider/Daemon 实际对话操作、桌面端验收。Git 审阅反映登记项目当前真实基线差异，可能包括本轮之前已有的工作区改动；Git 本身不能单独证明每一行都由当前模型调用产生。

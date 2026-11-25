# 默认项目目录同步（`<文档>/lfaa`）

| 项目 | 内容 |
| --- | --- |
| 状态 | 已实施 |
| 日期 | 2026-11-25（Asia/Shanghai） |
| 实施级别 | A0：负责人截图指出两处 bug 后按明确指令修复 |
| 负责人指令 | 「用户在资源管理器删了文件夹，项目里没有对应删除」；「不管是用 lfaa 新增，还是自己在 lfaa 里建的项目文件夹，都要能被发现并纳入项目」；「其他地方不用管，只管 lfaa；其他位置仍由用户自己绑定，逻辑不变」 |

## 1. 要解决的问题

默认项目目录（`<系统文档>/lfaa`）既是应用「按名称新建项目」的落点，也是用户会在资源管理器里直接操作的地方。此前 Host 只读写 `~/.lfaa/projects.json`，与磁盘完全脱钩：

- 用户在资源管理器删掉项目文件夹后，左二栏仍留着这个项目，点进去是空目录；
- 用户自己在 `lfaa` 里手建的项目文件夹永远不会出现在项目列表里，必须再走一遍「新建项目 → 绑定同一个文件夹」。

## 2. 同步规则

每次读取项目列表（`listProjects()`，对应 `GET /api/workspace/projects`）前，Host 会先把项目记录与默认项目目录对齐：

| 情形 | 结果 |
| --- | --- |
| 默认项目目录下的项目，文件夹被删（或全部根目录都不存在） | 从项目列表移出 |
| 默认项目目录下出现未登记的子文件夹 | 自动纳入为项目（名称取文件夹名，重名时追加 ` (2)`、` (3)`…） |
| 项目外聊天目录（`<文档>/lfaa/default-workspace` 或设置里自定义的位置） | 不当作项目 |
| 工作树容器（`<仓库名>-worktrees`，与项目并排） | 不当作项目 |
| 隐藏目录（`.` 开头）与普通文件 | 不当作项目 |
| 用户在应用里「移除项目」（含编辑弹窗的移除入口） | 只删项目记录，**绝不删除磁盘文件夹**，聊天也保留；路径写入 `dismissedPaths`，刷新不会把它塞回来。之后想重新加入，用「新建项目」再次绑定该文件夹即可（会清掉这条移出记录） |
| 用户在资源管理器里删掉项目文件夹 | 项目随之从列表消失（这是唯一会让 lfaa 跟着消失的删除方式） |
| 用户手动「移出项目」后又把文件夹删掉 | 移出记录失效；同名文件夹再建出来会重新被发现 |
| 绑定在默认项目目录之外的项目（自定义位置） | 完全不受影响：仍需用户自己绑定，磁盘删除也不自动移出，`exists: false` 只作展示 |

默认项目目录本身不存在（尚未创建、或被整体移走）时，既不扫描也不删记录，避免误清空项目列表。

## 3. 契约与实现

`@lfaa/workspace`

- `WorkspaceService.listProjects()` 内部调用 `syncDefaultProjectDir()`：新增文件 `src/project-store.ts` 承载存储读写、路径归一与目录同步，`WorkspacePluginConfig` 新增 `outsideProjectDirResolver`（由装配层提供“项目外聊天目录”）。
- `~/.lfaa/projects.json` 仍保持「纯项目数组」格式（旧版本可继续读取）；「移出」记录写到同目录的 `~/.lfaa/projects-dismissed.json`，读取时与旧格式里的内联字段一起合并去重。
- 新增导出：`readProjectStore`、`writeProjectStore`、`syncDefaultProjectDir`，供测试与后续装配复用。
- `removeProject()` 对默认项目目录下的项目写入移出记录；`createProject()` 显式创建时清掉同路径的移出记录。

`@lfaa/bundle-web`

- 装配 `workspacePlugin` 时新增 `outsideProjectDirResolver`（读 `chat.getGeneralSettings().outsideProjectFolder`），与既有的 `defaultProjectsDirResolver` 成对。

`@lfaa/client-ui-workspace`

- `LocalProjectStore` 在窗口重新获得焦点（`focus`）或页面重新可见（`visibilitychange`）时静默刷新项目列表（800ms 节流），用户从资源管理器切回应用即可看到增删结果，不需要手动刷新；`dispose()` 解绑监听。

## 4. 验收

- 删除 `D:\Documents\lfaa\<项目>` 后，首屏或切回窗口即从项目列表消失；`~/.lfaa/projects.json` 同步移出该记录（会话仍保留在 `~/.lfaa/sessions`，可在「最近」分组继续打开）。
- 应用内「移除项目」不会删除磁盘文件夹，聊天也保留；移除后刷新不会自己回来，想重新加入用「新建项目」再次绑定同一目录。
- 在 `D:\Documents\lfaa` 里手建文件夹后，切回应用即出现在「项目」分组，可直接开新会话。
- `default-workspace`、`*-worktrees`、隐藏目录与普通文件不会变成项目。
- 绑定在 `G:\...` 等其他位置的项目行为不变。
- 悬停卡片（`ProjectHoverCard`）各行图标列与文字列严格同列（编辑项目行此前比其它行右移 1.6px）。

## 5. 风险与回滚

- 风险：项目记录被移出后，其会话保留但失去项目分组，项目简介/置顶等元数据随记录消失；这是「文件夹已不存在」的必然结果。
- 风险：磁盘读取失败（例如网络盘掉线）时目录不可读会退化为「不同步」，不会批量删记录。
- 回滚：移除 `listProjects()` 中的同步调用与 `project-store.ts` 即可恢复纯列表行为；`projects.json` 格式未变，旧版本仍可直接读取，只有「移出」记录随功能一起失效。
# LFAA-WORKSPACE-PROJECT-SCHEMA-REPAIR-20261027：修复默认工作区项目读取失败

<a id="lfaa-workspace-project-schema-repair-20261027"></a>

## 用户目标

修复工作台项目列表和默认工作区初始化返回“服务器内部错误”，让现有项目可正常显示并继续小鱼 Skill 验收。保留已有项目、会话和用户偏好。

## Owner、入口与边界

- 运行入口：Control Plane `/api/workspace/projects`、`/api/workspace/projects/initialize-default`，用户界面 `/work`。
- 数据与迁移 Owner：`storage-sqlite` 定义 SQLite schema；`storage-domain` 按序协调迁移；`workspace` 继续持有项目登记逻辑，`workspace-controller` 继续持有 API。
- 故障证据：运行库声明 `user_version=72`，但 `workspace_projects` 缺少 v70 的 `instructions`、`memory_mode`，且缺 `workspace_project_sources` 与 `project_conversation_memories`；项目查询因此报 `no such column: p.instructions`。
- 设置与权限：不新增或修改设置；迁移不绕过 Permission Owner，也不改变项目路径访问合同。
- 数据边界：只补齐已声明迁移版本缺失的 v70 项目 schema；保留原项目字段/ID、默认项目映射、已有源目录与会话数据；不直接手工改用户数据库，不触碰 Skill 安装、Provider、会话正文或项目文件。

## 验收条件

1. 为声称已迁移至 v72、但缺少 v70 项目 schema 的数据库提供幂等、事务化的向前恢复迁移；完整库同样可安全升级。
2. 隔离迁移回归证明原项目和默认项目关系保留、本机项目源被补齐、项目记忆表恢复、重复启动不重复插入且外键检查干净。
3. 运行直接相关迁移/项目回归与受影响包构建；重新加载当前正式 Web `/work` 后，项目列表与默认工作区初始化不再显示服务器错误。
4. 报告源码检查、实际页面验收、设置变化与未测边界；不把构建结果当作实页证据。

## 实施与验证记录

- `packages/storage/storage-sqlite/src/database.ts` 新增版本 73 恢复迁移：在事务内核对项目基础列，只补缺失的 `instructions`、`memory_mode`、源目录表/索引和项目记忆表；只为尚无对应主目录源记录的本机 Workspace 项目回填一条记录；最后才推进 `user_version`。完整库也安全跳过已存在部分，异常时事务回滚且版本不前进。
- `packages/storage/storage-domain/src/migration.ts` 将恢复迁移接在版本 70–72 迁移之后，保持新库和旧库的既有顺序。Storage 两包 README 记录 73 的恢复职责和数据边界；当前 schema 版本断言更新到 73。
- 隔离回归在 `database-migrations.test.mjs` 构造 v72 缺字段/表数据库，验证项目路径与 ID、默认项目关系及会话仍在，源目录只补一条，外键检查无违规，连续启动不重复写入。
- 当前用户库经正常 Control Plane 启动迁移到 `user_version=73`。只读复核看到默认项目仍指向原路径 `D:\Documents\lfaa\default-workspace`，项目源目录已登记，项目记忆表和两列均存在，外键违规数为 0；SQL 会话总数仍为 30。
- 实页验收：完成启动前端与 Control Plane 指纹重建后，内置浏览器重新登录并刷新 `http://127.0.0.1:3000/work`。视口 1593×1244；项目栏显示“默认工作区”，路径为 `D:\Documents\lfaa\default-workspace`，并显示 25 个历史会话；“刷新项目列表”后仍无项目读取/初始化错误。`/api/workspace/projects/initialize-default` 实际返回 HTTP 200（395ms、255ms、202ms 三次）。当前任务轮次内已截取页面证据；页面截图显示项目栏恢复。
- 直接迁移与项目回归：8/8 通过。同步更新 schema 版本断言后，10 个相关测试文件共 25 项为 24 项通过；唯一失败为 `agent-runtime.test.mjs` 导入 Writing 服务时遇到既有错误“Writing 本地文件迁移结构未初始化”，与本次项目 schema 迁移无关；同一阻塞已在既有任务记录过。
- 构建：`storage-sqlite`、`storage-domain`、Control Plane build/typecheck 和 Web build 均通过；Web bundle 对大于 500 kB 的现有分块给出提示。`node scripts/runtime-build-state.mjs web` 返回 `[]`，运行树与当前源码指纹一致；`git diff --check` 通过。
- 仓库检查：`pnpm run check:workspace` 发现 5 项既有问题：两张历史截图路径缺失，以及 `self-hosted-preference-label-20261027`、`chatgpt-style-project-management-20261027`、`project-application-associations-20261027` 三处既有合同锚点缺失；本合同自身锚点已补齐并可被检查识别。
- 性能/安全：迁移只在升级时执行一次，以事务和 `NOT EXISTS` 保证重复启动不累积记录；请求链没有新增轮询或订阅。迁移不触碰 JSONL 会话正文、附件、记忆内容或项目文件，不改变认证、权限、项目路径权限合同及用户设置。未测量绘制帧时间；这轮没有布局改动。
- 设置中心：未新增、删除或修改任何设置及账户偏好。

# `lfaa-workflow`

## Owner

本包是跨 App 工作流核心：管理账户与 `ApplicationId` 隔离的版本化图定义、认证请求的业务层调用、运行快照和插件注册合同。图只保存节点类型/version、节点配置、端口边和稳定 engine ID；不会导入 Agent Loop、Minecraft、Tools、权限、Session 或 Daemon 实现。

图定义正文由本包原子保存到 `<LFAA_DATA_DIR>/users/<账户 SHA-256>/projects/<appId>/workflows/<工作流 ID SHA-256>.json`；SQLite 保留账户/App 索引、标题与更新时间、运行记录和关联。启动读取时会迁移旧 SQL 正文并回读校验，SQL 正文列保留 schema 允许的 `{}` 占位值。该布局不改变 `LFAA_DATA_DIR` 根目录解析或工作流运行 Owner。

## 扩展生命周期

领域插件通过 `registerWorkflowNodeProvider(owner, provider)` 注册节点 schema、端口和执行回调；执行引擎通过 `registerWorkflowEngine(owner, engine)` 注册图调度方式。注册绑定 Cordis `owner.effect()`，卸载时撤销目录项。新执行仍必须调用该领域原有 Owner 的认证、授权、校验和审批。

没有已注册节点包的 App 可读取/保存可识别定义，但不能运行未知节点。插件卸载不删除已保存图；未知节点配置保留并阻止运行，插件恢复后再解析。既有 v44 工作流由 v45 迁移至 `appId=minecraft`，v46 为运行记录新增当前节点字段。

首个 App 节点实现位于 `packages/workflow/minecraft-adapter`；默认顺序 DAG 引擎在 `packages/workflow/dag-engine`。核心 Registry 允许切换已安装的兼容引擎，但 LFAA 通用第三方插件运行时尚不支持任意工作流代码安全装载。

## 构建

构建输出由工作区脚本写入根目录 `dist/packages/workflow/workflow/`。

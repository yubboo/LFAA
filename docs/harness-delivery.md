# Harness 本地 CLI 与混合存储交付记录

> 本文是 2026-09-30 的历史快照。当前数据库版本、包数量与物理清理状态见 [2026-10-01 全仓审计](workspace-audit.md)；历史审批拒绝没有在后续检查中自动解除。

日期：2026-09-30。用户当前选择：混合存储；仅本地启动与打包，不发布 npm。

## 已完成

- 真实 CLI `pnpm lfaa web` 和 `@yubboo/lfaa` npm 打包入口，默认普通 Web 构建不依赖 Rust。
- JSON 配置、JSONL Agent 历史及 SQLite 控制面的分层实现，退役已迁移的旧表，数据库版本 31。
- 原 `daemon/`、`server/` 的 66 个旧 Git 索引条目已暂存删除；源码迁移按新旧路径配对暂存，尚未提交。
- 65 个实际能力/装配/测试包，其中 64 个产品包；上游 316 个目录名保留，占位不代表实现。
- 完整文件变更表见[绝对路径与职责清单](harness-delivery-files.md)，机器可读记录见[JSON](harness-delivery-files.json)。无关 `design-qa.md` 不计入本任务，也不代为提交。

## 实际数据核对

活动根目录 `H:/LFAA/data` 已使用混合存储，现有 3000 端口 Web 进程保持运行。本次只读核对迁移前的 **7 个会话、30 条消息、14 条用量记录**：逐条与 JSONL 导入事件一致，全部事件的序列、前序摘要、SHA-256 及会话目录摘要正确。核对时现有会话头为 8 个，说明导入后的新会话也正常保留。

迁移前恢复副本：[storage-before-file-migration-7a65bfed-0322-4547-bffd-2e1bc98b2408.sqlite](<H:/LFAA/data/credentials/storage-migration-backups/storage-before-file-migration-7a65bfed-0322-4547-bffd-2e1bc98b2408.sqlite>)。旧副本和活动库 `quick_check` 均为 `ok`；活动库为版本 31，旧消息/用量/配置权威表已经退役。本次未向活动目录注入测试用户或调用真实模型。

## 验证

- `pnpm test`：本轮构建前快照 **30 项通过，0 失败、0 跳过**。修复历史夹具缺表、SQLite 返回对象原型比较和心跳夹具缺少 `dataRoot`；保留原断言与生产校验。后续并行 Agent 修改不纳入这个全套结果。
- `pnpm run build`：产品包、前端、控制端与 npm 发布目录全量构建通过。
- 源码 `pnpm lfaa web` 在独立目录监听 33146：页面、JavaScript、健康接口均为 200；未认证节点心跳为 401；退出释放配置和会话写锁。
- tarball 独立离线安装后，`npx --offline lfaa web` 在 33147：同样通过 200/200/200/401 检查；同数据目录重启后 JWT、节点 Token、配置和迁移标记摘要不变，迁移恢复副本只有一份，SQLite v31 的 quick_check 正常，没有注入账户；关闭后释放两类写锁。
- tarball 314 个文件、9,543,990 字节；SHA-256 `9d16788b35ec967cf962e99bc84502c1d531d8db0b575186dc6446c3fb0f8993`。包内无真实数据、密钥、测试支持、缓存、SQLite 文件、备份或 workspace 协议依赖；`packages/credentials/authorization` 是鉴权源码，属于正式运行能力。
- Provider 密文、激活事务与账户删除使用隔离的长期测试夹具；产品不增加测试路由、模拟账户或权限绕过。
- 没有发布 npm，未验证在线 `npx @yubboo/lfaa web`，未执行桌面安装包重建、真实 LLM/游戏或 Windows 沙盒验收。

三个文件存储目录已经有真实实现，对应多余 `.gitkeep` 已删除，目录仍保留。这是源码文件编辑，临时目录删除的审核拒绝仍按下文记录。

## 设置与文件职责

使用的设置及默认值、持久化和消费者见[存储合同](harness-storage.md#设置中心盘点)。本轮不新增 UI 控件、CSS 变量或用户设置，不重置偏好；本机启动部署开关与设置中心分开归属。各变更文件绝对路径、职责和改动逐项列在交付文件表。

本次 AST 核对确认原有 71 个默认值逐项保持一致。同一工作区的并行 Agent 工作另增加 `aiRuntime.maxModelRequests=12`、`aiRuntime.maxToolCalls=24`，当前为 73 项；其设置控件、类型和执行消费者已经出现在源码中。这两项不归本轮存储实现，不覆盖或回退并行修改。构建与包运行结果只证明本次构建快照；之后变化的 Agent 源码由对应任务继续验证。

并行任务另增加 SQLite v32 通用工作区迁移。专项回归第一次复跑发现旧断言把整个数据库写死为 31（6 通过、1 失败）；已改为验证“文件迁移至少完成 v31、保留 jsonl_revision、旧权威表退役”，其余无损、损坏保护和权限断言全部保留。

最终专项命令 `pnpm --filter @yubboo/lfaa test tests/file-storage.test.mjs tests/database-migrations.test.mjs`：**7 项通过、0 失败、0 跳过**，涵盖当前共享源码及并行加入的 v32 后续迁移。

## 未完成的物理清理

自动审批审核拒绝删除，返回 `blocked by policy`，未提供具体原因。没有通过换工具绕过该拒绝；不宣称仓库已经清干净。

- 旧空壳 `H:/LFAA/server/` 与占位 `H:/LFAA/apps/desktop/`、`H:/LFAA/apps/desktop-host/` 等历史待清理对象，详见[前轮逐项记录](harness-cleanup-files.json)。实际 Electron/Tauri 外壳不是占位，继续保留。
- 本次新增废弃草稿：`H:/LFAA/dist/.tmp/convert-storage.mjs`、`storage-query-inventory.json`、`storage-query-generated.json`、`storage-schema-inventory.json`、`storage-migration-tools/`、`lfaa-storage-draft/`。已核对绝对路径，2026-09-30 删除整组被审核拒绝，仍留在根 dist 临时区，不参与产品装配或发布。
- 本次已停止的验证目录 `H:/LFAA/dist/.tmp/harness-cli-source-validation/`、`H:/LFAA/dist/.tmp/harness-cli-package-validation/`、`H:/LFAA/dist/.tmp/harness-cli-npm-validation-data/` 也被审核拒绝删除，仍保留隔离数据库或包安装依赖；均不进入发布包。长期用例自己的系统临时目录已通过 finally 清理。
- 历史 `H:/LFAA/apps/cli/data/ai-runtime-smoke/`、临时数据库快照、失败归档及其他前轮临时物仍按清理记录处理；正式备份、活动数据、当前构建和长期测试不得删除。

清理受阻不改变当前入口：构建、CLI、API 和数据仓库均指向新包实现，没有启用旧 `server/` 或 `daemon/` 源码。

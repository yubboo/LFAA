# 会话迁移与上下文保真（2026-10-26）

## 用户目标

用户换电脑后可导出并导入账户会话，保留长期记忆、公开对话、可继续工作的 Agent 上下文和会话附件。用户已选择：项目文件另行迁移，导入后重新关联项目目录。

## Owner、入口与设置

- 入口：设置中心 `/settings?section=import` 的账户资料导入/导出；Control Plane Settings Controller；Agent 继续使用 Session Owner 的会话恢复链。
- Session Owner：`packages/core/session` 生成/校验公开会话迁移投影；`packages/session/session-persistence-jsonl` 继续持有 JSONL 权威日志。
- 归档 Owner：`packages/settings/settings-snapshots` 编排 Settings、Conversation Memory、Session 与 Attachment Owner；不接管领域数据落盘。
- 附件 Owner：`packages/attachment/attachment` 合同和 `packages/attachment/attachment-local` 存储；跨账户导入通过目标账户 AttachmentStore 写入并映射新 ID。
- Controller/Client：`packages/api/settings-controller` 认证路由；`packages/client/connection` 与 `packages/client/ui-settings/AccountSnapshotsSettings.tsx` 提供下载、上传、预览和恢复。
- 设置：复用可移植账户设置与 `personalization.memoryEnabled` / `personalization.memoryFromToolChats`；不新增设置、不改权限偏好、Provider 凭据或目标账户设置。

## 数据范围与边界

- `.lfaa-snapshot` v2 保留设置、账户长期记忆、公开用户/助手消息、有限安全活动摘要、回复段落、分支记忆检查点、消息附件引用及其附件字节；SHA-256 校验后由各 Owner 验证与写入。
- 既有 v1 `.lfaa-snapshot` 可预览和导入，兼容旧文件与本机旧快照。
- 会话导入为当前认证账户下的已归档独立会话；同账户同 ID 跳过，跨账户 ID 冲突重新生成目标会话 ID；附件在目标 Attachment Owner 复验并映射为目标账户 ID。
- 不导出密码、登录/恢复凭据、Provider API 密钥、权限模式、授权记忆、插件/MCP 连接、浏览器/电脑权限、原始模型请求/工具参数与工具结果、用量、运行中任务、本机绝对路径或项目文件。
- 项目路径和节点身份不进入归档。项目文件由用户另行迁移，导入后重新关联；上下文和 Agent 生成的分支检查点作为不可信历史资料，继续服从当前规则和权限。
- ZIP/gzip 解压体、附件总量及 HTTP 上传均设有硬上限；任何字段/摘要/容量校验失败都拒绝整份归档，不静默截断。扩展归档使用异步压缩/解压，消息、摘要和单附件仍受 Owner 原有长度/字节限制。

## 允许与禁止

- 允许：为 v2 归档扩展公开 Session 投影、独立的持久上下文检查点事件、Settings Snapshot 编排、附件 Owner 调用、认证 API 上传/下载、客户端预览/恢复说明、对应 README/架构/任务合同及隔离回归。
- 禁止：导出原始模型/工具运行日志或本机路径；复制/打包项目树、密钥、权限或运行中任务；绕过 Attachment/Session/Settings/Permission Owner；覆盖同账户已有会话、记忆或设置而不经用户选择。

## 可观察验收条件

- 新导出 v2 能完整回读公开会话、安全活动、分支记忆与引用附件；文件摘要、附件字节与目标 Attachment Owner 回读一致。
- 文件预览只验证格式、版本、大小、归属数据形状和冲突数，不修改目标数据；恢复只写用户选择的设置/记忆/会话，附件引用指向目标账户的新记录。
- 旧 v1 归档仍可预览/恢复；坏摘要、坏附件、缺失附件、超限载荷和跨账户读取都在相应写入前失败。
- 导入后的会话仍能被恢复为可继续对话的会话；历史分支检查点由 Session Owner 在下一轮作为不可信背景加载。真实文件、长期记忆、凭据和项目目录分别沿各自 Owner 边界处理。
- 直接隔离回归、类型检查、Session/Settings Snapshot/API/UI 包构建、Control Plane/Web 构建及 `git diff --check`；界面变更须按仓库规则进行内置浏览器桌面和窄视口验收。未实际完成的环境验收必须明确标为未测。

## 实施与验证记录

- 归档协议：外部迁移文件升级为 `.lfaa-snapshot` v2，使用 gzip 与 SHA-256 校验；本机 SQLite 快照仍写 v1，旧 v1 文件保持预览/恢复兼容。v2 附件原始总量最多 200 MiB、最多 200 个附件；归档压缩体最多 256 MiB、解压体最多 384 MiB。所有限制在目标 Owner 写入前检查。
- 恢复行为：先预览并选择恢复范围；会话以归档状态导入，跨账户会话 ID 重建，附件写入目标账户 Attachment Owner 并重映射引用；重复内容按 SHA-256 与媒体类型复用。历史 Agent 检查点在继续对话时作为不可信背景注入。没有项目绑定、旧权限、密钥或活动任务恢复。
- 回归：`apps/cli/tests/account-settings-snapshots.test.mjs` 与 `apps/cli/tests/account-snapshots.test.mjs` 共 5/5 通过，覆盖 v1 兼容、v2 会话/上下文/附件回读、ID 重映射与重复附件复用、附件独占消息、路径清理及恢复后继续。
- 静态/构建：客户端与主机 TypeScript 检查通过；Session、Settings Snapshots、Settings Controller、Connection、UI Settings、Core Tools、API Test Support 包构建通过；Control Plane 与 Web 构建通过，产物位于根 `dist/`。Web 构建保留既有大代码块警告。`runtime-build-state.mjs host` 与 `web` 均返回 `[]`；相关文件 `git diff --check` 通过。
- 内置浏览器：实际路由 `/settings?section=import` 在 1280×720、390×640、720×480 视口检查。迁移范围、安全边界与 v1 限制均可读；390×640 下文案换行且无横向溢出，向下滚动后导出和选择归档按钮均可见；720×480 下页面可纵向滚动、操作区可见。截图证据保留在本轮内置浏览器验收输出中。未点击真实账户导出/导入，因此未实测文件选择器、下载及当前账户 API 交互；隔离回归覆盖了服务端导入/导出链。
- 当前服务状态：设置页先由源码 Web 服务 `http://127.0.0.1:3100/settings?section=import` 实际渲染并完成上述视口验收；之后该监听进程退出。复核时 `http://127.0.0.1:3000/` 返回 HTTP 200，但内置浏览器中的应用根节点为空，且切换到该端口的内置浏览器导航超时，因此没有把退出后的 3000 页面声称为通过。窄视口检查使用的是已实际加载的 v2 页面。
- 全仓工作区检查：`node scripts/check-workspace.mjs` 仍报告 6 项既有不一致：包目录 JSON/Markdown 清单未同步、两篇旧 hover-flicker 文档引用缺失截图、两个既有 PROMPTS 锚点缺少目标文档。它们不属于本任务，本次没有修改；相关任务文件自身的差异检查通过。

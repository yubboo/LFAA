# 小鱼 Agent 更新与精确卸载 Skill（2026-10-27）

<a id="lfaa-skill-update-20261027"></a>

## 用户目标

用户在 LFAA 对小鱼说“更新这个 Skill”时，Agent 检查当前账户是否已安装该 Skill；已安装则从原登记来源获取最新版本并更新，未安装则直接安装最新版本。用户也可让 Agent 精确卸载某个已安装 Skill。更新失败时保留旧版本；已是最新时不重复写入。

## Owner、入口与权限

- Agent 入口：`capability_install_skill`（`packages/boot/capability-installs`）增加明确的 install/update 操作；自然语言仍由模型判断目标和操作。
- 来源 Owner：`packages/boot/capability-skill` 固定 GitHub 来源、读取默认最新分支对应的 commit、校验 SKILL.md/文件树与摘要，并验证更新结果。
- 数据 Owner：`packages/knowledge/knowledge-library` 按当前账户与安装 ID 更新同一条安装记录和 `<LFAA_HOME>/skills/<Skill 名称>/` 文件；现有 `capability_remove` 通过同一 Owner 按安装 ID 精确卸载。
- 授权由 `packages/core/tools` / Permission Owner 按当前 `permissions.mode` 处理；更新与卸载维持危险写操作授权，不增设第二套确认模式。
- 复用设置：`plugins.enabled` 与 `plugins.disabledSkillNames` 继续控制 Skill 是否进入模型目录；`permissions.mode` 决定操作授权。更新不改这些设置。

## 数据与操作合同

- 普通 install 仍不覆盖已有安装；只有 Agent 明确判定为 update 才替换。
- 更新按稳定安装 ID 与现有 GitHub 仓库匹配。默认检查该仓库当前默认分支的最新 commit；提交/文件摘要相同则返回“已是最新”并不写盘。
- 新版本先完整下载、验证并暂存，再由 Knowledge Library 替换同一 Skill 目录和登记记录；更新保留安装 ID。任何下载/校验/替换/SQLite 更新失败都恢复旧目录和旧记录。
- Skill 名称或来源与现有记录冲突、目标名目录被手动文件占用、候选不唯一、记录不属于当前账户时停止，不覆盖、不改源、不删文件；向 Agent 返回具体原因。
- 更新调用使用现有 Run AbortSignal，来源脚本和依赖不执行。Skill 正文仍按 Registry 现有规则刷新和按需加载。
- 未安装时走现有安装链，仍写入 `<LFAA_HOME>/skills/<Skill 名称>/SKILL.md`。卸载只接受 `capability_list` 返回的精确 installation ID，并复用现有 `capability_remove`。

## 可观察验收

- 同源已安装 Skill 有新 commit 时，Agent 更新成功、installation ID 保持不变、内容/元数据校验对应新 commit；同源已是最新时不改文件或更新时间。
- 未安装时，更新意图会检查并安装唯一候选的最新版本；多候选/来源冲突时停止并返回选择信息。
- 文件下载、摘要校验、目录替换、数据库提交任一失败均保留旧版本可读；手动同名目录和另一安装记录不受影响。
- `capability_remove` 对一个安装 ID 精确删除该项，并保留同账户其他项和其他账户安装。
- 定向测试覆盖更新/最新无操作/缺少安装时安装/失败回滚/来源冲突/取消/精确卸载；运行相关 Capability Install、Capability Skill、Knowledge Library 回归与包构建、Client/Host TypeScript、Control Plane/Web 构建和 `git diff --check`。此任务不改 UI；真实 GitHub Provider 与跨进程并发压力未测时如实记录。

## 实施记录

已实现以下行为：

- `capability_install_skill` 接受明确的 `operation=update`，可按安装 ID 精确指定，也能按已安装 Skill 的确切名称定位原登记来源；安装目录默认仍是 Windows `%USERPROFILE%\.lfaa\skills\<Skill 名称>\`（即 `<LFAA_HOME>/skills/<Skill 名称>/`）。普通 install 保持不覆盖行为。
- 已安装时只检查原 GitHub 仓库与原 Skill 目录的当前默认分支版本；更新沿用同一 installation ID。没登记时仅在来源唯一的情况下安装最新版；commit 与逐文件清单相同则不写文件、不刷新更新时间。
- Knowledge Library 会先暂存完整新文件并校验旧安装目录与登记清单，再隔离旧目录、切换新目录并更新记录。SQLite 提交失败会恢复旧目录；目录里有手动新增/修改文件、来源改变、Skill 名称改变或安装 ID 失效时停止并保留现有文件。替换不会运行 Skill 脚本或安装依赖。
- Agent 指令要求精确卸载先 `capability_list` 获取 installation ID，再调用已有 `capability_remove`；不增加新目录、账户分层或另一套删除路径。

### 设置和授权

- 沿用 `plugins.enabled`、`plugins.disabledSkillNames` 控制安装后 Skill 是否进入模型 Skill 目录；更新不修改这两项。
- 安装、更新与卸载继续由现有 `permissions.mode` 和 Permission Owner 按危险写操作处理；没有新增设置或权限模式。

### 验证证据

- `pnpm --filter @yubboo/lfaa test -- tests/capability-install-one-step.test.mjs tests/capability-skill.test.mjs`：8/8 通过。覆盖一句话安装、多候选不安装、按名称绑定原 installation ID/sourcePath、未安装更新时装最新版、已是最新不写盘、来源冲突停止、SQLite 更新触发失败后恢复原记录和文件、账户共享发现及按 ID 精确卸载。
- `pnpm --filter lfaa-capability-installs run build`、`pnpm --filter lfaa-capability-skill run build`、`pnpm --filter lfaa-knowledge-library run build`：通过，产物均写到根 `dist/packages/`。
- `pnpm run build:web`：单独重跑通过，写入根 `dist/apps/web/`。本任务没有 UI 变化，不需要页面验收。
- `git diff --check`：通过。
- `pnpm run typecheck` 与 `pnpm run build:control-plane`：失败于工作区既有 Browser Use TypeScript 错误（`accessibility-tree.ts:68` 的 `boolean | "mixed"`、`session-manager.ts:1253` 与 `tabbit-provider.ts:396` 的可选 `accessibilityTree` 类型）。没有改动这三个不相关文件。
- `pnpm --filter @yubboo/lfaa test -- tests/knowledge-library.test.mjs` 的最后一次复跑在 Skill Owner 测试之前失败：夹具当前断言 SQLite schema 版本 72，`retireLegacyFileTables()` 执行后实际为 71；更新/失败恢复断言尚未运行。相同的 SQLite 失败恢复已经由上面的 7/7 Capability Skill 定向回归直接覆盖。仓库里没有 `workspace-preflight` 命令/文件；只找到 Web 启动前置脚本，本次无 UI/启动变更不适用。
- 测试和 Provider 使用隔离夹具与快照 stub；未访问真实 GitHub、未更新真实用户 `.lfaa` 数据。没有验证跨进程并发压力或实际运行的 Skill 依赖环境；Skill 脚本/依赖仍不会自动执行或安装。

### 本轮修改文件

- `packages/boot/capability-installs/src/index.ts`：登记 Skill 更新能力；一站式工具解析更新意图、来源与安装 ID，并在审批摘要中说明操作。
- `packages/boot/capability-skill/src/index.ts`：绑定原来源和账户安装，安装缺失 Skill、检查同源更新、报告最新/已安装/已更新状态并刷新 Registry。
- `packages/knowledge/knowledge-library/src/index.ts`：暂存、内容验证、保留安装 ID 替换及 SQLite 失败回滚；更新和删除继续准确处理旧版存储路径。
- `packages/core/tools/src/capability-settings.ts`：指导 Agent 明确更新、按精确 ID 卸载并在来源冲突时停止。
- `apps/cli/tests/capability-install-one-step.test.mjs`、`apps/cli/tests/capability-skill.test.mjs`、`apps/cli/tests/knowledge-library.test.mjs`：覆盖更新路由、缺失安装、无操作、冲突、替换回滚和精确卸载。
- `packages/boot/capability-installs/README.md`、`packages/boot/capability-skill/README.md`、`packages/knowledge/knowledge-library/README.md`：同步更新操作、存储 Owner 和安全边界。
- `docs/系统总体架构.md`、`docs/PROMPTS.md`、本合同：同步架构、设置/权限与验收结果。

## v0.0.89 Agent Execution Hint

`AgentRunRequest.executionHints.reasoningBoost` 是 Agent 级提示，不属于 `AgentModelBinding.settings`。Config System 仍是 Provider reasoning 参数唯一真值；Web 开发 Host 只能按 Host 能力解释该 Hint。本版 API 开发 Host 通过临时 system instruction 请求更充分的检查，不向 Provider body 注入 Capability 未声明的 reasoning 字段，也不把该 instruction 写回持久会话历史。

## v0.0.88 Web 开发态真实 Chat Run

Web 开发宿主新增最小 `AgentRuntimeHost`：Run 在 localhost Host 中读取账户元数据与 `credentialRef`，Secret 由 Credential Store 获取且不返回浏览器；API Provider 文本回复通过 `AgentRuntimeEvent` 投影到 Chat。该桥只验证真实模型对话链，P2 Capability Invocation、工具调用、正式 Session/Event Store 尚未宣称完成。

## v0.0.87：UI Extension 生命周期边界

UI 插件贡献与 Runtime Capability 使用同一类“owner + generation”思路，但 UI Kernel 本身不是可卸载插件。`ui-effects/ui-extension` Registry 负责安装/卸载后的 contribution 可见性；普通插件不得直接持有 DOM 引用跨 generation 存活。未来 Plugin Runtime 接 UI Contribution 时必须通过 Adapter/Registry，不允许直接向 App Shell 注入任意 JS。

## v0.0.86：Composer Runtime Control 执行边界

Composer 的“强力推理”是最高公开 reasoning 档的快捷入口，不是新增 Provider 参数；实际 Run 仍只携带 Config System 已校验的 `AgentModelBinding.settings`。Slider 拖拽过程中只维护 UI preview，Pointer Up / 键盘离散操作才提交 `setActiveModel`，避免每个 Pointer Move 写入 Host。模型切换继续使用缓存 `modelCatalog`，不重新请求 Provider。

## v0.0.85：模型配置与运行时快切边界

Settings 负责账户认证、Secret 引用、Provider 连接、官方模型目录刷新与高级模型配置；Composer 只负责消费已经持久化的 `activeModel + modelCatalog` 做日常模型/思考强度切换。日常切换不得重新访问 Provider，也不得接触 Secret。

`AiAccountService.setActiveModel` 使用缓存的官方目录完成 Core 级校验和原子持久化；`AgentModelBinding.settings` 把已校验模型参数带入下一次 Chat/Work Run。刷新官方目录仍由 Settings 的 probe/reprobe/selectModel 路径承担。

## v0.0.84：Provider Host 网络事实

浏览器网络与 Node/Vite Host 网络是不同进程事实。Web 开发宿主启动时启用 Node 24 环境代理与系统 CA；若没有显式 `HTTP_PROXY/HTTPS_PROXY`，Windows Setup 可把当前用户已启用的静态 Internet Settings 代理临时映射到 Vite 子进程。该映射只在 Web 进程生命周期内存在，停止后恢复原环境。

Provider HTTP Adapter 继续只接收脱敏请求描述，绝不记录 Header/Secret；网络失败按 DNS、refused、timeout、reset、TLS 分类，HTTP 401/403/429/5xx 单独解释。LFAA 不通过关闭 TLS 校验绕过证书问题。

## v0.0.83：账户认证与当前 Agent 模型分离

AI Account 只拥有认证连接、Provider 设置、该账户默认模型及最近一次官方 `modelCatalog`；全局当前执行模型由独立 `activeModel = { accountId, providerId, modelId }` 持久化。Chat / Work / Agent Runtime 只能读取 `activeModel`，禁止再次用账户数组顺序、第一条 selectedModel 或 UI 临时状态推断当前模型。

`modelCatalog` 只允许保存官方 API / 官方运行时 / 官方文档 Catalog 返回的公开模型元数据，不保存 Secret。API Key / Token 仍只通过 `credentialRef → @lfaa/credentials → Rust Secret Broker` 获取。账户元数据、Active Model 与 Secret 的多步写操作必须补偿回滚，任何一步失败不得留下半成功绑定。

## v0.0.82：Node Source ESM 导入边界

LFAA 的 foundation/domain/runtime/host-adapter workspace package 可能被 Vite Config 或 Node Host 直接从 TypeScript source export 执行。此路径遵守 Node ESM 解析规则：相对 import/export 必须写真实扩展名（如 `./registry.ts`），不能依赖 Vite 浏览器 bundle 自动补全。`runtime-import-resolution-check.mjs` 负责阻断无扩展名与不存在目标。

## v0.0.81：Windows Setup PowerShell 字符串语法安全

Windows PowerShell 会把 `“ ” ‘ ’` 这类智能引号视作可参与语法解析的引号。用户可见中文文案不得在 `.ps1` 中使用这些字符；需要中文强调时统一使用 `「」`。需要在正则中匹配 Unicode 撇号时使用 `\u2019`，不得直接嵌入弯撇号。

`node scripts/windows-script-encoding-check.mjs` 现在同时负责 UTF-8 BOM、严格 UTF-8 与智能引号语法安全，避免参数位置被提示文本意外拆分。

## v0.0.80：独立 Plugin Profile + Unicode 成品发布门禁

用户插件依赖固定进入 `.lfaa/state/plugin-profile`，不得修改 LFAA 根 `package.json/pnpm-lock.yaml`。Profile 包管理由一个 Node Host 承担：inspect → lock → snapshot → pnpm → validate → commit；失败/取消恢复 Profile manifest/lock。pnpm build script 只按待审批的精确包名放行。

Web 写操作只接受当前 localhost 同源请求；Plugin Manager API 不接收 Secret。安装日志写 `.lfaa/logs/plugin-manager` 并先脱敏。

v0.0.79 交付包曾把 `docs/项目结构与代码地图.md` 编成乱码路径。v0.0.80 发布要求不是“源码 preflight 通过就算完”：必须对最终 ZIP 检查 exact Unicode entry，解压到新目录后确认 `.lfaa` 隐藏骨架与中文文件，再从该解压根运行 `workspace-preflight.mjs`。

## v0.0.79：Sync 来源包先验完整性

稳定工作区同步现在使用 fail-safe 顺序：

```text
路径编码检查
→ Source Package workspace-preflight
→ dependency fingerprint / lockfile preservation
→ diff plan
→ 用户确认
→ apply
→ SHA-256 mirror verify
→ Target workspace-preflight
```

Source Preflight 失败时不得生成具有删除语义的可信执行链，更不得修改目标。此规则专门防止发布 ZIP 漏隐藏目录或其他治理必需文件时伤到长期稳定工作区。

另外，`.lfaa/cache|state|tmp|logs` 属于本机运行状态，Sync 的保护匹配必须使用 literal-dot `^\.lfaa/`；不得用会匹配反斜杠的 `^\\.lfaa/`。

# LFAA 本机运行、同步与脚本规范

## v0.0.78：依赖同步幂等与稳定工作区 Lockfile 保护

`LFAA-Sync.bat` 不再把版本包里的 `pnpm-lock.yaml` 无条件覆盖到稳定工作区。Sync 会先计算源版本与目标工作区的 **dependency declaration fingerprint**（workspace + 各 package manifest 的 dependency sections）：

- 声明完全一致，且目标 lockfile 不比来源更短：保护稳定工作区已有 `pnpm-lock.yaml`，避免每个版本都把已经由本机 pnpm 生成好的 lockfile 覆盖回骨架版本。
- 声明真实变化：解除保护，让新版本 lockfile/Setup 正常进入一次依赖同步。
- 产品版本号变化本身不属于依赖变化，不得触发安装。

`LFAA-Setup.bat → 1` 同时把 `.lfaa/state/dependency-state.json` 降级为缓存：只有本地直接依赖缺失/版本不匹配、真实模块解析失败、或 lockfile coverage 不完整时才 `NeedsInstall`。首次没有本机基线时只建立基线，不再把现有依赖全部误报为“新增 N”。

因此从 v0.0.77 升到 v0.0.78 **可能合理发生一次** lockfile 同步：本版本新增了 `agent-runtime → plugin-sdk` 与 `plugin-runtime → plugin-sdk` 两个 workspace-only 依赖，但没有新增外部 npm 包。完成这一轮后，只要依赖声明未变化，后续普通版本同步不应重复要求 pnpm install。

## v0.0.77：稳定工作区统一 Preflight

Windows `LFAA-Sync.bat` 与 `LFAA-GitHub.bat` 现在必须调用同一个 `scripts/workspace-preflight.mjs`。该入口只依赖 Node 和仓库源码，不依赖 `node_modules`，统一运行静态治理 Gate。

失败输出规则：终端直接打印 `[LFAA-PREFLIGHT][FAIL] <gate>`、对应脚本与原始错误摘要；完整日志继续写入 `docs/logs/runtime/...`。用户不再需要只靠一个 `push-error-*.log` 路径猜失败原因。

`docs/logs/runtime/workspace-sync/`、`github-push/`、`source-update/` 带 `.gitkeep`，避免空目录在 Git/ZIP/Sync 后消失。Sync 在镜像校验后立即执行同一 preflight，目标是让“同步成功”和“随后允许 Push”使用同一个工作区事实。


> 记录 Sync / GitHub / Update / Setup、本机 Runtime Log、稳定工作区保护规则。实际 `.log` 仍写入 `docs/logs/runtime/*/`，但这些目录不再放 README。
> 同步规范迁移来源：`docs/standards/WORKSPACE_SYNC.md`。

## LFAA 稳定工作区同步规范

### 1. 固定目录

正式开发结构：

```text
H:\lfaa\
├── lfaa\                 # 唯一稳定工作区 / 唯一 .git
├── LFAA-v0.0.2\          # 版本快照
├── LFAA-v0.0.3\          # 版本快照
└── LFAA-v0.0.3.zip
```

### 2. 唯一 Git 工作区

`.git` 只允许长期存在于：

```text
H:\lfaa\lfaa\.git
```

版本快照不重新初始化独立 Git 历史。

### 3. 每个版本包自带

```text
LFAA-Sync.bat
LFAA-GitHub.bat

scripts/windows/
├── lfaa-sync.ps1
└── lfaa-github.ps1
```

BAT 只负责启动 PowerShell，不承载复杂逻辑。

### 4. 同步要求

同步前必须真实比较：

- 新增文件；
- 修改文件；
- 删除文件；
- 未变化文件数量。

输出完整相对路径，并使用：

```text
【新增】【ADD】
【修改】【MOD】
【删除】【DEL】
```

颜色区分。

确认后才能执行。

### 5. 完整性

除明确的本地保护项外，版本包项目文件必须完整镜像到稳定工作区。

同步完成后必须再次执行 SHA-256 校验。

任何剩余差异都视为失败。

### 6. 永久保护

目标工作区以下内容不参与版本镜像删除：

```text
.git/

node_modules/
target/
dist/
coverage/
.cache/
.tmp/

.env
.env.local
.env.development.local
.env.production.local
.env.test.local
```

其中：

- `.git` 保存唯一 Git 历史；
- - `docs/logs/runtime/workspace-sync/*.log` 保存本机同步留痕，并从镜像差异判断中排除；
- `.env*` 保存本机 Secret/环境差异；
- build/cache 目录属于本机产物。

`/.env.example` 仍然属于项目文件，必须正常同步。

### 7. 删除语义

如果某个普通项目文件：

- 存在于稳定工作区；
- 不存在于新版本包；
- 不属于保护范围；

则同步计划中显示：

```text
【删除】【DEL】 relative/path
```

用户确认后才删除。

因此稳定工作区最终与版本包保持精确一致。

### 8. 同步日志

每次实际同步记录到项目文档日志目录：

```text
H:\lfaa\lfaa\docs\logs\workspace-sync\
```

记录：

- 时间；
- 版本；
- 来源；
- 目标；
- ADD；
- MOD；
- DEL；
- 最终状态。

该目录不进入 Git。


### 9. GitHub 一键推送

GitHub 脚本：

```text
LFAA-GitHub.bat
→ scripts/windows/lfaa-github.ps1
```

必须遵循和同步脚本相同的可观察性原则：

1. 检测当前 Git 变化；
2. 彩色列出新增 / 修改 / 删除 / 重命名；
3. `git add -A` 后再次列出真正 staged 文件；
4. Commit 名称由用户手工输入；
5. 首次 Commit 也不强制使用固定 `first commit`；
6. 用户输入 Commit 名称后直接创建本地 Commit，不再二次确认；
7. 用户选择“一键推送”并输入 Commit 名称后，直接 Push，不再二次确认；
8. 默认禁止 `git push --force`；
9. 远程已有 main 时先 `git pull --rebase`；
10. 生成本机日志到 `docs/logs/runtime/github-push/`。

`.git` 只初始化一次，之后必须复用。


### 10. Git 原生命令输出规范

GitHub 脚本默认控制台使用中文。

规则：

- 成功的 Git 原始输出不直接显示；
- 首次无 `origin` 属于正常状态，不得当作错误；
- 先 `git remote` 判断，再新增/读取 `origin`；
- 失败时原始 Git 技术输出写入 `docs/logs/runtime/github-push/*.log`；
- 控制台给用户显示中文错误摘要；
- 禁止把 Git 大段英文帮助页直接暴露给普通用户。


### 11. origin 配置

远程仓库地址不得写死在 LFAA 脚本。

第一次运行 Git 推送时：

```text
无 origin
→ 用户输入仓库地址
→ 用户确认
→ git remote add origin
→ 保存到 .git/config
```

以后：

```text
已有 origin
→ 自动读取
→ 不再询问
```

`.git/config` 是 origin 的唯一事实源。

禁止另外创建：

```text
origin.json
github.config.json
```

等重复配置。


### 12. 终端结束状态

所有 Windows 一键脚本必须明确告诉用户流程是否已经结束。

成功必须显示：

```text
【提示】【可关闭】全部操作已完成，现在可以安全关闭终端窗口。
```

失败也必须说明：

```text
【提示】【可关闭】错误信息已经保留，现在可以关闭窗口；处理问题后再重新运行。
```

BAT 只负责启动 PowerShell。

最终状态、颜色、等待按键全部由 PowerShell 统一处理，避免：

- 用户不知道是否还能关闭；
- BAT/PowerShell 双重 pause；
- 中英文提示混杂。


### 13. Commit 名称输入即确认

GitHub 一键推送中：

```text
【输入】【提交名称】
```

用户完成提交名称输入后，即视为确认创建本地 Commit。

禁止再次出现：

```text
【确认】【创建提交】
```

避免重复交互。

远程 Push 不再增加独立 Y/N 确认。

一键推送的确认语义是：

```text
用户主动选择菜单 1
+ 用户手工输入 Commit 名称
= 已确认本次 Commit + Push
```

`origin` 新增或修改仍保留独立确认。


### 14. Git Clone 后的源码更新

`git clone` 只用于第一次获取仓库。

以后更新已经克隆的源码使用：

```text
LFAA-Update.bat
→ scripts/windows/lfaa-update.ps1
```

更新脚本必须：

1. 找到真实 `.git` 工作区；
2. 使用 `.git/config` 中的 `origin`；
3. 检测本地未提交修改；
4. 有未提交修改时停止，禁止覆盖；
5. `git fetch --prune origin`；
6. 比较本地/远程 ahead/behind；
7. 已是最新则直接结束；
8. 本地领先时不 pull，提示 Push；
9. 本地/远程分叉时停止，不自动 merge/rebase；
10. 仅在“本地纯落后”状态下使用 `git pull --ff-only`；
11. 拉取前列出远程新增/修改/删除/重命名文件；
12. 拉取后校验本地 HEAD 与远程一致；
13. 生成 `docs/logs/runtime/source-update/*.log`；
14. 成功后明确提示可以关闭终端。

禁止更新脚本默认执行：

```text
git reset --hard
git clean -fd
git pull --force
```

等可能破坏用户本地工作的操作。


### 15. Windows 工具菜单

LFAA 的 Windows BAT 启动器双击后不得直接执行写操作。

必须先进入数字菜单：

```text
LFAA-Update.bat
LFAA-GitHub.bat
LFAA-Sync.bat
```

菜单至少必须包含：

- 执行主操作；
- 只读检查/预览；
- 相关配置或安全高级操作；
- 退出。

### 16. 强制拉取

强制拉取属于明确用户选择的高级操作。

执行前必须：

- fetch 最新远程；
- 显示本地/远程差异；
- 建立本地 backup branch；
- 将未提交和未跟踪文件保存到 stash；
- 用户确认后才 reset；
- 不使用 `git clean -fdx`，避免删除 ignored 的本地 Secret/缓存；
- 完成后显示恢复点。


### 17. Git 工作区路径无关

Git 拉取/更新工具严禁写死：

```text
C:\
D:\
H:\
H:\lfaa\lfaa
```

等路径。

更新脚本必须优先通过：

```text
git rev-parse --show-toplevel
```

确定真实 Git 根目录。

自动发现失败时才允许用户输入项目路径。

目录名称、磁盘盘符、移动硬盘/U盘位置均不能成为脚本运行前提。


### 18. Update 状态判断顺序

源码更新必须先判断 Git Commit 状态，再决定是否读取文件差异。

```text
ahead=0 / behind=0
→ 已是最新
→ 禁止继续 diff

ahead>0 / behind=0
→ 本地领先
→ 安全模式不读取远程 diff

ahead>0 / behind>0
→ 已分叉
→ 安全模式直接停止

behind>0
→ 才读取远程文件变化
```

文件差异优先使用两个明确 tree-ish：

```text
git diff <local-commit> <remote-ref>
```

不要依赖拼接 revision-range 字符串作为唯一实现。


### 19. 版本包中文路径完整性

版本包可能包含中文开发日志、Prompt 和其他人类可读文档。

同步脚本在计算差异前必须验证源版本包路径没有发生字符集损坏。

重点防止以下错误链路：

```text
UTF-8 中文文件名
→ 被错误按 CP437 / OEM 解码
→ 乱码名称重新写入 ZIP
→ 同步时被识别为“中文旧文件删除 + 乱码新文件新增”
```

如果某个源路径片段可以通过：

```text
当前字符串 → CP437 bytes → strict UTF-8
```

恢复成不同的中文名称，则视为疑似发布包路径编码损坏。

此时必须：

1. 在生成 ADD / MOD / DEL 计划前停止；
2. 显示原路径与可恢复的正确路径；
3. 禁止继续同步；
4. 重新生成版本包后再执行。

发布 ZIP 生成后也必须重新读取 ZIP 文件名清单，确认中文路径保持 Unicode 语义。

### 20. Setup 与分层质量入口

根 `package.json` 是 Node/pnpm 工具链版本唯一事实源：

```text
Node 24.x
pnpm 11.17.0
```

`LFAA-Setup.bat` 的菜单编号只是 Windows Adapter，不是开发 / CLI 协议。

`1 按需依赖` 仅在以下情况使用：首次配置、依赖声明变化、工具链损坏或用户主动希望检查环境。环境和依赖已经可用时，可以直接启动 Web、构建或运行检查，不要求先执行菜单 1。Node 部分仍由 PowerShell 负责：确认 Node 24.x；pnpm 缺失或版本不匹配时可通过 Corepack 准备 `packageManager` 锁定版本；失败不得降级 npm / yarn / bun。

v0.0.54 起，菜单 1 使用本机 `.lfaa/state/dependency-state.json` 保存“最近一次成功同步”的依赖指纹。该文件只是一份可删除缓存，真正事实仍是 workspace `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`Cargo.lock` 与 `rust-toolchain.toml`。Node 指纹不包含 LFAA 产品版本，因此只改 `0.0.x` 产品版本不会触发重装。

检测顺序固定为：

```text
工具链是否可用
→ 依赖声明 / lockfile 指纹是否变化
→ 本地直接依赖是否缺失或精确版本不匹配
→ unchanged：直接通过，不执行 pnpm install
→ changed/missing：显示新增 / 删除 / 版本变化摘要
→ 用户 Yes：同步当前项目锁定依赖并刷新本机状态
→ 用户 No：保持现状，不修改依赖
```

菜单 1 不负责“追逐网上最新版本”，禁止自动 `pnpm update`、删除 `node_modules`、清空 pnpm store 或 Cargo cache。项目新版本已经改变 lockfile / 依赖声明时，这是该项目版本需要的依赖变化；用户仍可拒绝本次写操作，但需要接受当前项目可能无法正常运行。pnpm 安装时保留既有 store/node_modules，由 pnpm 自身复用已存在内容，仅补齐真实缺失/变化部分。Rust 同样先检查固定 toolchain + rustfmt + clippy；已完整时跳过 rustup 安装；无外部 crate 时跳过 `cargo fetch`，有 `Cargo.lock` 时只在首次或 lock hash 变化后 fetch。

v0.0.55 起，菜单 1 不再先后重复打印“预检/检测”两组 Node、pnpm、workspace，也不在结尾分别重复 Node 与 Rust 完成状态。输出固定为一次环境摘要、一次依赖状态、一次关键路径区、一个最终总结果。路径必须从当前机器动态解析：项目 `node_modules`、`node_modules/.pnpm`、`pnpm-lock.yaml`、`.lfaa/state/dependency-state.json`；pnpm Store 通过 `pnpm store path` 获取；Cargo registry/git 缓存来自 `CARGO_HOME`（或用户默认 `.cargo`）；Rust 工具链来自 `RUSTUP_HOME/toolchains`。菜单 7 环境检查复用同一位置展示。

v0.0.56 起，菜单 1 的 Node 状态分为三层：

```text
声明层：package.json / pnpm-lock / workspace 指纹
项目层：各 workspace 外部依赖真实 Node resolve + 关键入口/原生模块加载
Store 层：pnpm store path 的真实目录/内容/状态
```

`.lfaa/state/dependency-state.json` 只帮助判断声明是否变化，不能让项目层或 Store 层直接通过。Store 被删除/清空时必须报告缓存缺失；如果项目 node_modules 因 pnpm 硬链接仍能真实运行，则显示“项目依赖可用，但 Store 缓存缺失”，用户可选择按当前 lockfile 恢复缓存。恢复只补当前锁定内容，不升级依赖。项目层真实解析失败时才进入项目依赖同步分支，安装后必须重新执行真实健康检查。

v0.0.57 起，机器环境路径再增加“来源与实时性”约束：`Get-PnpmStorePath` 必须在 `$ProjectRoot` 每次执行当前 pnpm runner 的 `store path`；PNPM_HOME、pnpm executable、全局 config 文件、全局/项目 `storeDir` 只用于解释来源，不能替代最终 active Store。仓库自己的 `pnpm-workspace.yaml` 不声明 `storeDir`，默认尊重 pnpm 用户/机器环境。状态缓存不得保存并回放旧 Store 路径。

`10 检查中心` 只提供三种分层入口：

```text
快速检查  → pnpm run quality:quick
完整检查  → pnpm run quality:full
正式发布  → pnpm run release:full
```

语义固定为：

- `quality:quick`：governance + typecheck + test；不安装依赖、不 build、不要求 Rust；
- `quality:full`：quick + build；不隐式安装依赖、不执行 Rust 发布检查；
- `release:full`：发布环境版本检查 + `pnpm install --frozen-lockfile` + 完整检查 + Rust check/test。

未来 CLI / GUI 直接调用上述能力，不重新实现菜单 1 / 10。Windows 安装、PATH、Corepack、Rust 官方安装等系统行为继续留在 `scripts/windows/*.ps1`；MJS 只负责跨平台项目级检查 / 静态门禁，不承载 Windows 安装动作。

候选版本在 `pending-user-acceptance` 阶段可以在受限制作环境打包供实机验收，但必须披露未执行 / 被阻断门禁；只有受支持环境真实 `release:full` PASS 后，才能声明完整发布验证通过。

### 14. Windows PowerShell 脚本编码契约

根入口：

```text
LFAA-Sync.bat
LFAA-GitHub.bat
LFAA-Setup.bat
LFAA-Update.bat
```

通过 Windows 自带：

```text
powershell.exe -File
```

调用 `scripts/windows/*.ps1`。

因此这些 `.ps1` 必须使用：

```text
UTF-8 with BOM
```

原因：Windows PowerShell 5.1 对无 BOM UTF-8 脚本的自动识别不可靠，特别是脚本包含中文字符串和中文注释时可能发生误解码。

发布前必须执行：

```text
node scripts/windows-script-encoding-check.mjs
```

该检查必须验证：

- BOM 字节 `EF BB BF`；
- BOM 后内容可严格按 UTF-8 解码；
- 4 个根 BAT 仍通过 `powershell.exe` 指向正确 `.ps1`。

> 迁移来源：`docs/logs/runtime/README.md`

## 运行日志

这里保存 Windows 开发工具实际运行产生的本机日志。

```text
workspace-sync/
→ 稳定工作区同步

github-push/
→ GitHub 推送

source-update/
→ Git 源码更新
```

实际 `*.log` 默认不提交 GitHub。

这些日志不记录架构决策；架构和需求变化必须写入：

```text
docs/logs/development/
```

> 迁移来源：`docs/logs/runtime/workspace-sync/README.md`

## Workspace Sync Logs

本目录用于保存 **LFAA 稳定工作区同步日志**。

运行：

```text
LFAA-Sync.bat
```

后，日志生成到：

```text
docs/logs/runtime/workspace-sync/
```

例如：

```text
sync-20260917-235500-v0.0.4.log
```

### 说明

`README.md` 属于项目文档，会进入版本控制。

实际运行生成的：

```text
*.log
```

属于本机开发留痕：

- 不参与版本包与稳定工作区的镜像差异判断；
- 不会因为新版本同步被删除；
- 默认不会提交到 GitHub；
- 可由开发者手工保留、审查或归档。

同步日志记录：

- 时间；
- LFAA 版本；
- 来源版本目录；
- 目标稳定工作区；
- ADD；
- MOD；
- DEL；
- 最终同步状态。

> 迁移来源：`docs/logs/runtime/source-update/README.md`

## Source Update Logs

本目录用于保存：

```text
LFAA-Update.bat
```

一键拉取远程最新源码时生成的本机日志。

运行日志示例：

```text
update-20260918-120000.log
update-error-20260918-120100.log
```

### 记录内容

- 远程 origin；
- 当前分支；
- 更新前 Commit；
- 更新后 Commit；
- 远程新增 / 修改 / 删除 / 重命名文件；
- 最终结果。

### Git 与同步规则

实际生成的：

```text
*.log
```

属于本机开发运行记录：

- 默认不提交 GitHub；
- 不参与版本包与稳定工作区镜像差异判断；
- 不会因新版本同步而删除；
- 本 README 正常进入版本控制。

> 迁移来源：`docs/logs/runtime/github-push/README.md`

## GitHub Push Logs

本目录用于保存 LFAA 一键 GitHub 推送的本机运行日志。

运行：

```text
LFAA-GitHub.bat
```

成功或部分失败时，可生成：

```text
push-YYYYMMDD-HHMMSS-vX.Y.Z.log
```

日志记录：

- 执行时间；
- LFAA 版本；
- 仓库；
- 分支；
- Commit 名称；
- 本次 Git 变化；
- 推送结果。

### Git 策略

实际生成的：

```text
*.log
```

属于本机开发留痕：

- 默认不提交 GitHub；
- 不参与版本快照和稳定工作区镜像差异判断；
- 不会因版本同步被删除；
- `README.md` 本身正常进入版本控制。


### v0.0.58 PowerShell 自动变量安全

Windows PowerShell 变量名大小写不敏感。Setup/Sync/GitHub/Update 等 PS1 不得把 `$HOME`、`$PID`、`$Host`、`$Error`、`$PSHOME`、`$PWD`、`$LASTEXITCODE` 等自动/只读变量作为普通赋值目标。v0.0.58 修复 `Test-PnpmHomeInPath` 中 `$home` 与 `$HOME` 冲突；pnpm Store 实时路径与来源逻辑保持 #20.11 不变。


### v0.0.59 开发期依赖同步与发布 frozen 分离

菜单 1 在 lockfile 落后时允许更新 `pnpm-lock.yaml`，在 lockfile 已完整但本地依赖损坏时使用 frozen 精确修复；pnpm 写操作采用 append-only reporter 实时显示进度。正式发布 `release:full` 继续 frozen。

### v0.0.62 Windows pnpm 同控制台直连

菜单 1 的交互式 `pnpm install` 在 Windows 不再从 PowerShell native-command 管道直接调用 `pnpm.cmd`。改为由 `cmd.exe` 在当前控制台启动版本匹配的 `pnpm.cmd`，PowerShell 通过 `Start-Process -NoNewWindow -Wait -PassThru` 只等待退出码，不配置 stdout/stderr 重定向。这样安装中间过程由 pnpm 自身控制。

### v0.0.61 Windows pnpm CMD 前台与精简输出

菜单 1 的 pnpm 写操作在 Windows 优先使用版本与 `packageManager` 一致的 `pnpm.cmd`，以获得和用户直接在 CMD 执行 `pnpm install` 相同类别的原生终端输出。安装 stdout/stderr 不进入 LFAA 捕获链。

菜单 1 只显示关键环境、node_modules / pnpm Store / Cargo / Rust toolchains 四类路径、状态摘要和必要确认；PNPM_HOME、全局配置、Store 来源、lockfile、状态缓存等完整诊断放在菜单 7。异常详情只在失败时展开。

### v0.0.60 pnpm 原生前台输出

Windows 实机证明强制 append-only reporter 并未恢复用户熟悉的安装过程可见性。菜单 1 的交互式 `pnpm install` 因此不再传任何 `--reporter=*`，由 pnpm 根据当前终端使用原生 reporter；LFAA 不捕获、不重定向、不模拟 stdout/stderr。#20.13 的 frozen / no-frozen 分流和正式发布 frozen 规则保持不变。

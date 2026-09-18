# LFAA 开发规范

> **当前唯一有效开发规范。**
> 用户说“按照开发要求做”或“按照开发规范开发”时，必须先执行本文件的阅读流程，再开始任何代码修改。

## 1. 开发前强制阅读顺序

### 1.1 第一入口

必须先读：

```text
DEVELOPMENT.md
```

禁止先改代码再补文档。

### 1.2 第二入口：文档总索引

然后读取：

```text
docs/README.md
```

先确认当前文档目录职责，禁止盲目搜索。

### 1.3 第三入口：开发日志

然后读取：

```text
docs/logs/development/INDEX.md
```

根据当前任务的模块名、关键词、编号，打开对应：

```text
docs/logs/development/active/
```

只有需要追溯原因时才读取：

```text
docs/logs/development/archive/
```

### 1.4 第四入口：当前开发事实源

按顺序继续读取：

```text
ARCHITECTURE.md
→ PROJECT_PLAN.md
→ CHANGELOG.md
→ Module README
→ Module PLAN
→ Module PROGRESS
→ Active Prompt
→ 相关 Standards
→ Code
```

没有读完，不修改业务代码。

---

## 2. 开发日志硬规则

完整规范：

```text
docs/standards/DEV_LOGS.md
```

### 2.1 当前与历史分开

```text
active/
→ 当前仍有效

archive/
→ 已被替代
```

禁止把新旧日志平铺在一起。

### 2.2 同一问题使用子编号

```text
#20
#20.1
#20.2
```

属于同一问题的修正，不重复创建新主编号。

### 2.3 旧记录不删除

旧记录只能：

```text
superseded
→ archive
→ 指向新的 active 文件
```

禁止直接覆盖导致历史丢失。

Development Log 索引也不得丢失旧主编号；旧任务必须能直接搜索到对应历史日志和原始来源。

### 2.4 每次需求变化必须记录

以下变化都必须写开发日志：

- 用户要求改变；
- 设计改变；
- 架构改变；
- 行为改变；
- 安全规则改变；
- 文件/目录职责改变；
- 已解决问题出现新的修正结论。

---

## 3. 文档硬规则

### 3.1 中文为主

所有自有开发文档必须中文为主。

英文只用于：

- 代码；
- API；
- 命令；
- 路径；
- 标识符；
- 专有名词。

### 3.2 必须清楚分段

重要文档至少要能快速看到：

- 当前结论；
- 任务目标；
- 变更原因；
- 修改内容；
- 影响范围；
- 验证结果；
- 下一步。

禁止大段无标题流水账。

### 3.3 标题必须突出

标题使用清晰层级：

```text
# 文档标题
## 主要章节
### 具体事项
```

同层级内容不要混写。

---

## 4. 命名硬规则

完整规范：

```text
docs/standards/NAMING.md
```

核心规则：

- 目录：`kebab-case`
- TS 文件：`<name>.<role>.ts`
- React 组件：`PascalCase.tsx`
- Rust module：`snake_case.rs`
- 固定治理文档：`README.md` / `PLAN.md` / `PROGRESS.md` / `INDEX.md`
- 开发日志：`NNNN-中文短名.md`
- 开发历史变更：`NNNN-NN-中文短名.md`

禁止：

```text
new
latest
final
final-final
fix2
utils2
abc
```

名称必须短、准、能表达职责。

编号类人类文档必须优先使用中文短名；源码、Package、API 等技术标识继续遵守英文代码命名规则。

---

## 5. AI 四大规则

### 5.1 文档先行

先读规范、日志和当前事实源，再写代码。

### 5.2 边界优先

每个任务开始前必须明确：

- 主模块；
- 允许修改；
- 禁止修改；
- 状态 Owner；
- 对外 API；
- Protocol 是否变化；
- DB Schema 是否变化；
- 安全边界是否变化。

未明确允许的区域默认不修改。

### 5.3 验证闭环

按任务实际范围执行：

- TypeScript typecheck；
- 单元测试；
- 集成测试；
- UI/E2E；
- Rust check/test；
- Agent Eval/Trace；
- 安全路径测试；
- 无无关文件修改检查。

### 5.4 全程可追溯

每次开发按需要同步：

- Active Prompt；
- Plan；
- Development Log；
- Progress；
- Module README；
- 测试记录；
- CHANGELOG；
- Release。

---

## 6. 模块聚焦

当前主模块：

```text
config-system
```

当前模块未达到 `deliverable` 或明确 `blocked` 前，不切换无关业务模块。

允许跨模块只有：

1. 当前模块被基础依赖阻塞；
2. 需要公共 Protocol 变更；
3. P0/P1 缺陷阻塞；
4. 安全问题必须立即修复。

跨模块必须先记录 Plan / Progress / Development Log。

---

## 7. 开发状态

只能使用：

```text
pending-development
planned
in-progress
pending-test
testing
pending-optimization
deliverable
not-delivered
delivered
blocked
deprecated
archived
```

推荐流程：

```text
pending-development
→ planned
→ in-progress
→ pending-test
→ testing
→ deliverable
→ delivered
```

---

## 8. Plan / Progress / Prompt

### 8.1 Plan

路径：

```text
docs/plans/modules/<module>/PLAN.md
```

Plan 负责“要怎么做”。

Plan 变更先于代码。

### 8.2 Progress

路径：

```text
docs/progress/modules/<module>/PROGRESS.md
```

Progress 负责“实际做到哪里”。

Progress 只记录事实，不写预计完成。

### 8.3 Prompt

新业务必须先有 Active Prompt。

Prompt 负责：

- 任务目标；
- 允许修改；
- 禁止修改；
- 输入/输出；
- 边界；
- 验收。

需求变化先更新 Prompt 和 Development Log，再改代码。

---

## 9. 中文源码注释

重要源码文件使用：

```ts
/**
 * 文件：
 * 作用：
 * 负责：
 * 不负责：
 * 状态归属：
 * 对外接口：
 * 关联文件：
 * 修改注意事项：
 */
```

注释说明设计原因和边界，不做逐行翻译。

---

## 10. UI / Runtime / 状态边界

### UI

负责展示、交互、局部视觉状态。

禁止 UI 直接访问：

- SQLite；
- Rust Broker；
- Provider Secret；
- Tool 执行。

### 状态 Owner

同一个事实状态只能有一个 Owner。

Child 不直接修改 Parent 私有状态。

---

## 11. 执行与安全边界

任何执行能力必须走：

```text
Agent / Plugin / MCP / DSH
→ Capability / Tool Adapter
→ Tool Runtime
→ Policy
→ Permission
→ Rust Broker
→ OS
```

`Full` 不能绕过硬拒绝、项目边界、Secret 隔离和 Broker 校验。

---

## 12. 项目资源

唯一项目资源根：

```text
<project>/.lfaa/
```

只认：

```text
skills/
experts/
plugins/
extensions/
mcp/
```

禁止重新建立根 `/skills`、`/plugins` 作为第二事实源。

Secret 明文禁止进入 `.lfaa/`。

---

## 13. Node.js 包管理器

唯一允许：

```text
pnpm
```

允许：

```text
pnpm install
pnpm add
pnpm remove
pnpm run
pnpm exec
pnpm --filter
pnpm -r
```

禁止使用 npm / npx / yarn / bun 替代 pnpm 管理本项目依赖。

---

## 14. Windows 一键工具

入口：

```text
LFAA-Setup.bat
LFAA-Sync.bat
LFAA-GitHub.bat
LFAA-Update.bat
```

BAT 只负责启动 PowerShell。

脚本必须：

- 先显示菜单；
- 写操作明确确认；
- 路径无关；
- 成功/失败状态明确；
- 结束时明确可关闭终端。

---

## 15. Git 与工作区

- `.git` 只保留稳定工作区唯一历史；
- `origin` 唯一事实源是 `.git/config`；
- Commit 名称由用户输入；
- Commit 名称输入后不再次确认；
- 菜单 1“一键推送”中，Commit 创建后直接 Push，不再增加远程 Push 二次确认；
- origin 新增或修改仍必须单独确认；
- Update 默认保护本地工作；
- 分叉不自动改写历史；
- 安全拉取只允许 fast-forward。

详细规则：

```text
docs/standards/WORKSPACE_SYNC.md
```

---

## 16. 质量门禁

禁止 build/typecheck/test 假成功。

详细规则：

```text
docs/standards/QUALITY_GATES.md
docs/standards/SECURITY.md
docs/standards/PERFORMANCE.md
```

涉及 Rust 时必须真实执行 Rust 检查；工具链缺失时明确记录 blocked / skipped 原因，不能伪造通过。

---

## 17. Definition of Done

任务只有同时满足以下条件才算完成：

1. Prompt 与需求一致；
2. Plan 与实现一致；
3. Development Log 已更新；
4. 代码完成；
5. 中文注释符合规范；
6. 相关测试通过；
7. 无无关修改；
8. Module README 按需同步；
9. Progress 已留痕；
10. CHANGELOG 按需更新；
11. 状态明确；
12. 正式发布时 Version / Release 同步。

---

## 18. 标准开发流程

```text
读取 DEVELOPMENT
→ 查 Development Log INDEX
→ 读取相关 active 日志
→ 读取当前架构/Plan/Progress/Prompt/Standards
→ 明确边界
→ 更新文档合同
→ 实现
→ 验证
→ 追加开发日志
→ 更新 Progress / CHANGELOG
→ 判断交付状态
```


---

## 19. docs 文档目录硬规则

开发者进入 `docs/` 后必须先读：

```text
docs/README.md
```

顶层目录固定为：

```text
standards
architecture
modules
plans
progress
prompts
logs
changelog
releases
testing
```

未经开发日志、规范和治理检查同步更新，禁止随意新增同义顶层目录。

日志只分：

```text
docs/logs/development/
→ 开发决策

docs/logs/runtime/
→ 脚本运行记录
```

禁止混放。

编号类人类文档使用：

```text
NNNN-中文短名.md
NNNN-NN-中文短名.md
```

固定工具入口文件继续使用：

```text
README.md
INDEX.md
PLAN.md
PROGRESS.md
RELEASE.md
```


---

### GitHub 一键推送确认语义

`LFAA-GitHub.bat → 1 一键推送` 的用户意图链固定为：

```text
选择“一键推送”
→ 查看文件变化
→ 输入 Commit 名称
→ 创建本地 Commit
→ 显示 origin / 分支 / Commit
→ 直接 Push
```

禁止再次出现：

```text
【确认】【推送远程仓库】输入 Y 确认
```

原因：

- 用户已经主动选择“一键推送”；
- 用户又手工输入了 Commit 名称；
- 再增加 Push 的 Y/N 属于重复确认。

以下操作仍然保留确认：

```text
新增 origin
修改 origin
强制拉取
其他高风险恢复/覆盖操作
```


---

### Setup 真实依赖检测

`LFAA-Setup.bat → 1` 不允许只根据目录是否存在判断依赖。

必须真实检查：

```text
Node 可执行文件
Node 版本
pnpm / corepack
pnpm 版本
workspace package 数量
package.json 依赖声明
pnpm install --frozen-lockfile
Cargo
rustc
winget
```

`node_modules` 的大小不是依赖完整性依据。

如果当前 `package.json` 没有声明第三方包，则：

```text
node_modules 很小
```

属于正常现象。

Cargo 缺失时：

```text
winget 可用
→ 优先 winget

winget 不可用 / 安装失败
→ Rust 官方 static.rust-lang.org
→ 下载 rustup-init.exe
→ 下载官方 .sha256
→ SHA-256 校验
→ 才允许执行
```

自动安装仍失败时，一键准备必须显示“部分完成 / Rust 未完成”，不能显示全部成功。


---

### Setup 统一开发菜单

Windows 本地开发、运行、构建入口统一为：

```text
LFAA-Setup.bat
```

高频菜单固定为：

```text
1  一键依赖
2  启动 Web
3  启动桌面
4  构建 Web
5  构建桌面
6  构建发布
7  环境检查
8  项目资源
9  治理检查
10 完整检查
```

规则：

- 禁止为 Web / Desktop 再新增重复 BAT 主入口；
- Web / Desktop 是否可执行必须检查真实 workspace script；
- 未实现功能必须明确失败；
- “构建发布”只生成本地产物，不自动上传远程；
- GitHub 推送继续由 `LFAA-GitHub.bat` 负责；
- 源码更新继续由 `LFAA-Update.bat` 负责。


---

### Rust 安装输出与 WinGet 语义

Rust 安装必须区分：

```text
LFAA 自身提示
→ 中文

Rust 官方 rustup 输出
→ 保留官方原始英文
```

路径检测必须支持：

```text
CARGO_HOME/bin
PATH
%USERPROFILE%/.cargo/bin
```

WinGet 返回码不得一律显示“失败”。

已知：

```text
-1978335189 / 0x8A15002B
→ No applicable update found
→ 中文显示“未发现可适用更新”
```

此时必须重新检测本机 rustup/Cargo，再决定是否使用官方 rustup-init。


---

### Rust 工具链与项目依赖分层

默认采用：

```text
rustup / rustc / cargo / 标准库
→ 用户/机器共享工具链

rust-toolchain.toml
→ 项目事实源，锁定版本

Cargo.toml / Cargo.lock / target
→ 项目级
```

禁止为每个普通项目复制一整套 Rust toolchain 作为默认方案。

`CARGO_HOME` / `RUSTUP_HOME` 可以由用户配置到非系统盘；Setup 必须尊重已有配置。

项目不得修改用户的全局 `rustup default`；项目版本由 `rust-toolchain.toml` 选择。


---

### 工具链与项目依赖最终规则

LFAA 固定使用一套简单规则，不再提供多种安装模式。

#### 电脑基础工具

以下工具属于电脑环境：

```text
Node.js
pnpm
Git
Rust / rustup / cargo / rustc
```

规则：

- 一台电脑只准备一次；
- 多个项目可以复用；
- 已经安装在哪里就继续使用哪里；
- LFAA 不迁移用户已有工具链；
- 普通用户不需要选择“用户级 / 项目级 / 共享目录”。

#### 项目内容

以下内容跟项目走：

```text
node_modules/
Cargo.toml
Cargo.lock
rust-toolchain.toml
target/
.lfaa/
```

`rust-toolchain.toml` 只负责声明 LFAA 需要的 Rust 版本，不代表把整套 Rust 编译器复制进项目。

#### Setup

`LFAA-Setup.bat → 1` 的目标只有一个：

```text
检查环境
→ 已有工具直接复用
→ 缺失工具自动补齐
→ 安装项目依赖
→ 初始化项目资源
→ 给出最终状态
```

Rust 缺失时直接使用 Rust 官方 `rustup-init`，不再优先尝试 WinGet。

Rust 官方原始安装输出允许保留英文；LFAA 自己的状态提示必须中文清楚。

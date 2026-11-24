# 沙箱：契约、强制边界与路线

状态：**第一版已落地（DEV-000194）**：契约包 + 工具层后端 + 端到端测试。**尚未实现操作系统级进程沙箱**，本文把这条边界写清楚，避免误判安全性。

## 1. 为什么要有这一层

Agent 会执行命令、写文件。没有边界时，「模型被诱导」或「插件有 bug」都可能直接改动工作区之外的系统文件。沙箱的作用是**在执行前判定、拒绝可疑操作**，而不是事后审计。

## 2. 模式（沿用 DSH 词汇）

| 模式 | 允许 | 默认 |
|---|---|---|
| `read-only` | 只读工具；**拒绝一切写入与命令执行** | 无工作区根时的兜底 |
| `workspace-write` | 允许工作区根之内的写入；命令可执行 | 有工作区根时的默认 |
| `danger-full-access` | 不限制 | 需显式选择 |

判定遵循 **fail-closed**：无法证明安全的操作一律拒绝（例如只读模式下不尝试判断命令是否只读，直接拒绝）。

## 3. 分层

| 包 | 职责 |
|---|---|
| `@lfaa/sandbox`（`packages/sandbox/sandbox`） | 抽象契约：`SandboxMode`、`SandboxPolicy`、`SandboxDecision`、`SandboxEnforcer` 服务与 `ctx.sandbox` |
| `@lfaa/sandbox-local`（`packages/sandbox/sandbox-local`） | 工具层后端：按策略判定写入路径与命令 |

命令级策略（`command-policy.ts`）：

- **灾难性命令在任何模式下都拒绝**，包括 `danger-full-access`：`format`、`diskpart`、`bcdedit`、`vssadmin delete`、`reg add/delete`、`takeown`、`icacls /grant|/deny|/reset`、`net user`、`shutdown`/`Stop-Computer`、递归删除磁盘根、`mkfs`、`dd if=`。
- **重定向写入**（`>`、`>>`、`2>`、`*>`）解析目标路径，工作区外拒绝。
- **常见写入命令**（`cp`/`copy`/`mv`/`rm`/`del`/`mkdir`/`touch`/`tee`/`Set-Content`/`Add-Content`/`Out-File`/`New-Item`）取路径参数判定；拿不到绝对路径就拒绝，不猜测放行。

强制接入点：`@lfaa/tools` 的 `executeTool` 在调用工具本体前先判定——

- `write_file` / `edit_file`：校验目标路径（相对路径按工作区根解析，解析后比较，拒绝 `..` 穿越）
- `run_command`：校验命令是否允许执行
- 其余工具（读取类）不受影响

被拒绝时返回 `ok: false` 且 `output` 为可展示原因，工具本体不会执行。

## 4. 安全边界（必须知道）

`@lfaa/sandbox-local` 的 `enforcement` 如实报告为 **`policy`**，意思是：

| 能拦住 | 拦不住 |
|---|---|
| 模型通过工具写工作区外文件 | 通过命令间接写文件（如 `echo > ../x`） |
| 只读模式下的一切工具写入与命令 | 插件自己 `fs.writeFile` 绕过工具 |
| 相对路径与 `..` 穿越 | 第三方进程、原生模块、网络副作用 |

也就是说：**这不是内核级沙箱**。它把「通过工具作恶」的口子收紧了，但无法约束任意进程。

## 5. 与 DSH 的差距

DSH 的 `sandbox-windows-acl` 用受限令牌 + capability SID + ACL 授权，把写入目标限制在授予范围内（约 95 KB FFI 实现，依赖 koffi）。LFAA 目前没有原生层，因此：

- 契约已对齐（同样的三档语义、按调用携带策略、fail-closed）；
- **强制能力不对齐**（DSH 是进程包装 `confine(argv)`，LFAA 是工具层判定）。

## 6. 进度

| 项 | 状态 |
|---|---|
| 工具层写入判定（`write_file` / `edit_file`） | ✅ 已实现 |
| 命令级写入约束（重定向 + 写入命令） | ✅ 已实现（DEV-000196） |
| 全权模式也不是无脑放行（灾难性命令始终拒绝） | ✅ 已实现 |
| `confine(argv, policy)` 进程包装入口 | ✅ 接口已就位，**默认实现直接抛 `SandboxUnavailableError`**（失败即拒绝） |
| Windows 原生后端（受限令牌 + ACL） | ❌ 未实现，属独立工程 |
| 模式来源（设置面板 / 会话级切换） | ⏳ 仍由 `ToolExecutionContext.sandboxMode` 传入，缺省 `workspace-write` |

**因此仍然不能说「已沙箱化」**：进程包装没有原生实现，命令之外的进程行为不受约束。

## 7. 验收

- 单元测试：三档模式判定、路径穿越、相对路径、空命令（`packages/sandbox/sandbox-local/tests/sandbox.test.ts`）。
- 集成测试：只读模式下 `write_file` 与 `run_command` 被拒、读取不受影响；工作区模式放行内部写入、拒绝越界（`tests/tools-enforcement.test.ts`）。
- 运行时：`@lfaa/sandbox-local` 在根上下文装配，bundle 通过 `inject: ["sandbox"]` 取得判定器并交给工具层。

# Shell 执行体系

负责人已确认按 DSH 的整个 Shell 包组补齐能力，并要求修复命令中文乱码。本方案约定 LFAA 的包边界、交互和验收。Windows 写入沙箱涉及项目目录 ACL，启用范围由负责人单独确认。

本轮装配 `shell`、`shell-env`、`bash-local`、`pwsh-local` 与现有 `run_command` 前台入口。其余六个目标包仍待实施。Web 当前使用本机解释器和宿主 OS 用户权限。

## 能力与文件范围

| DSH 包 | LFAA 目标目录 | 公开职责 |
| --- | --- | --- |
| `shell` | `packages/shell/shell` | Cordis `ctx.shell`，解析请求并管理可取消的执行句柄、独立 stdout/stderr、退出原因与有界输出。 |
| `shell-env` | `packages/shell/shell-env` | 每次执行的环境、会话目录和编码。授权目录与应用凭据由 Host 决定，工具参数不能替换。 |
| `bash-local` | `packages/shell/bash-local` | 在 Bash 或已选择的 Git Bash／WSL 中启动本地命令。WSL 使用发行版对应的真实目录映射。 |
| `pwsh-local` | `packages/shell/pwsh-local` | Windows PowerShell 执行，识别 PowerShell 7 和 Windows PowerShell。用户选择 CMD 时走单独的 CMD 启动参数和解码。 |
| `bash-sandbox` | `packages/shell/bash-sandbox` | 调用已安装、通过预检的隔离后端。无法隔离时拒绝执行。 |
| `pwsh-sandbox` | `packages/shell/pwsh-sandbox` | 复用 DSH Windows 受限令牌与 ACL 实现，以明确授权的工作区为写入范围。 |
| `tool-bash` | `packages/shell/tool-bash` | Agent 通过现有 `run_command` 和明确选择的执行器调用 Bash，支持当前会话拥有的后台任务。 |
| `tool-pwsh` | `packages/shell/tool-pwsh` | Agent 通过同一调用协议选择 PowerShell，呈现输出、退出和停机原因。 |
| `tool-bash-persistent` | `packages/shell/tool-bash-persistent` | 会话拥有的持久 Bash，串行调用并保留目录、变量和函数，显式关闭后释放资源。 |
| `tool-pwsh-persistent` | `packages/shell/tool-pwsh-persistent` | 会话拥有的持久 PowerShell，同一会话拒绝并发写入命令，超时或 shell 退出后重建。 |

现有调用入口在 `packages/core/tools/src/`。工具的参数校验和审批仍由 `packages/core/agent/src/` 负责，`apps/web/src/server.ts` 从已保存会话及通用设置装配执行服务。现有 `packages/core/memory/src/types.ts` 为命令记录增加可选的执行器、目录、输出和结束原因字段。旧回复保持可读。聊天由 `packages/core/chat/client/components/AssistantTimeline.tsx` 接收真实的有界输出增量，沿用浅色和深色主题及已有折叠交互。

## 用户流程与约束

- 新命令使用已选 Shell 和已绑定的项目目录。模型收到实际 Shell 方言和可用工具，失败时展示具体原因。开始、stdout、stderr、停止和退出等事件在同一条命令记录上更新，刷新后可回看。
- 长命令需要后台时登记为当前会话的任务，读取进度、停止和领取结果均验证归属。关闭会话或 Host 时释放进程、监听器和缓存。持久 Shell 随会话隔离，启动后不同会话之间无法共享 cwd 或环境变量。
- 执行器返回原始输出或明确的编码信息，分别处理 UTF-8、UTF-16 BOM 与 Windows 控制台编码，保留分块末尾未完整的字符。输出有界，达到上限应提示。
- 当前 DSH Windows ACL 后端会修改目录安全描述符，限制写入与删除。读取和网络保持该原生后端的实际边界，界面不得将它表述为读取隔离。应用凭据保护和命令授权需继续由各自边界实施。
- DSH 本地源码为 `0.2.1-alpha.5` 家族。已查到的注册表版本含旧 `dsh-bash`、不同版本的 Cordis 和不同协议。移植时固定来自同一版本的能力及依赖，验证跨机器构建与运行。LFAA 不能在运行时依赖某台机器上的 `E:\lfaa1\deepseek-harness` 绝对路径。

## 实施与验收

1. 先修现有 `run_command` 的字节解码。用真实 UTF-8、GBK、UTF-16 进程输出及非零退出覆盖 stdout、stderr、历史写回。已经落盘为替换字符的历史记录只能保留现存文字。
2. 装配 Shell 契约、环境及本地执行器。实测 Windows PowerShell 与 CMD、可用的 Bash／Git Bash／WSL、工作目录、分段中文、停止、超时及清理。
3. 接入真实沙箱后端，先在隔离夹具验证写入越界、符号链接、拒绝后不执行以及 ACL 复原。真实项目启用由明确授权触发。
4. 接入前台、后台及持久工具。验证任务和持久终端跨会话隔离、停止释放及失败归因。命令轨迹在浅色、深色与窄屏通过内置浏览器实测。

回滚时移除新增的 Host 装配，恢复现有 `run_command` 提供者。会话新增字段可选，无需数据迁移。沙箱 ACL 的回滚另行验证安全描述符恢复，并在真实目录启用前保留恢复材料。

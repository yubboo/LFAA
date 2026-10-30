# LFAA 桌面安装包体积与安装耗时优化（2026-10-30）

<a id="lfaa-desktop-package-size-install-speed-20261030"></a>

## 用户问题、目标与入口

- 用户问题：Windows Electron 安装器约 298.3 MB，实际安装展开约 946 MiB，安装过程明显偏慢。
- 当前证据：NSIS 归档含 21,721 个文件；Claude Agent SDK 的 `claude.exe` 原始 296.8 MB、归档占约 99.5 MB；Electron `LFAA.exe` 原始 246.0 MB、归档占约 72.2 MB；随包 Node 原始 92.3 MB、归档占约 23.1 MB。前端 `app.asar` 约 2.3 MB。
- 期望结果：保留 Claude Agent SDK 能力，将其 Windows x64 CLI 运行文件从默认桌面安装器中移出；首次明确调用 Claude 驱动时获取精确锁定版本并验证后缓存。比较 NSIS 压缩设置的包体与安装耗时，减小默认安装展开量并改善安装时间。
- 运行入口：根 `pnpm run build:desktop:win` → Electron x64 NSIS；运行时能力由 Control Plane Host 的 `lfaa-subagent-claude-code` 驱动。

## Owner、设置与数据边界

- 真实调用链与 Owner：`apps/desktop-electron` 只负责构建、组装和注入桌面组件清单；`packages/subagent/subagent-claude-code` 是 Claude SDK 二进制解析、下载、缓存和启动参数的唯一 Owner；Home 路径由 `packages/util/home-paths` 提供；调用授权、预算与真实工具执行继续走 Agent Loop/Permission Owner。
- 相关设置：复用现有 `permissions.mode`、`aiRuntime.executionSandboxMode` 与 Settings/Credentials 中按账户验证保存的 Anthropic Console API Key；不新增设置、不改默认值、不读取或改写用户偏好。只有既有委派流程实际执行 Claude 驱动时才获取组件，不预下载。
- 数据与权限：运行文件缓存于当前 `LFAA_HOME` 的专用 `runtime-components/`，不写入或迁移 `LFAA_DATA_DIR`、账户凭据、项目或会话数据。下载失败/校验失败/取消时不得启动未验证文件；不得绕过当前工具授权、账户凭据、沙箱门槛或模型预算。

## 修改范围与验收

- 允许修改：Claude SDK Owner 与 Home Paths 的最小公开合同、Electron 运行时组装/排除规则、直接回归、受影响 README、此合同与索引。
- 禁止改变：删除 Claude 能力、改模型/凭据/权限/预算、接受未校验下载、静默降级、使用本机 Claude 登录、自动发布或安装到真实用户目录。
- 可观察验收条件：
  1. 默认 NSIS 安装器和运行目录不含 `claude.exe`；当前锁定 SDK JS、许可说明及其他已登记能力仍可用。
  2. 首次显式调用时只下载锁定版本；npm tarball SHA-512 与锁文件一致、提取二进制 SHA-256/大小与构建清单一致后才启动；之后调用命中缓存，不重复下载。
  3. 网络错误、摘要不符、损坏归档和取消均返回真实错误，不创建可执行的半成品；同一进程的并发调用共享下载任务，临时归档有上限并在完成/失败时清理。
  4. 以隔离账户/Home 运行直接回归；构建并检查 NSIS 清单、体积与安装耗时，确认用户数据不变。对比可用 NSIS 压缩等级，记录包体与耗时权衡；若无法启动隔离安装环境，明确记录阻碍，不能以打包结果代替安装验收。
  5. 保留 Electron 与内置 Node 一体化运行能力；本任务不承诺将完整 Windows Electron 安装器降至 100 MB 以下。

## 实施与验收记录

- 具体方案：运行时组件清单从锁文件读取 `@anthropic-ai/claude-agent-sdk-win32-x64@0.3.310` 的固定版本和 SHA-512；Electron 运行树排除 284 MiB 的 `claude.exe`。Claude driver 只有在凭据、预算和现有授权检查通过且真实执行该驱动时才下载；先校验 tarball SHA-512，再安全提取并核验可执行文件 SHA-256/大小，通过后原子放入 `LFAA_HOME/runtime-components/`。并发请求共用单次下载；缓存复用；取消、超时或校验失败均闭锁，不启动未验证文件。开发及非该桌面发行目标不触发下载。
- 变更文件：
  - `packages/subagent/subagent-claude-code/src/claude-sdk-component-contract.mjs`、`claude-sdk-component-contract.d.mts`：锁定组件版本、官方地址及 tarball SRI 合同。
  - `packages/subagent/subagent-claude-code/src/claude-sdk-component.mjs`、`claude-sdk-component.d.mts`：安全下载、校验、缓存、并发合并和失败清理 Owner。
  - `packages/subagent/subagent-claude-code/src/index.ts`：在原有凭据/预算/工具执行边界后接入按需组件，并将校验后的可执行文件路径传给 SDK。
  - `packages/subagent/subagent-claude-code/package.json`、`pnpm-lock.yaml`：声明 Home Paths 与 tar 解析直接依赖及锁定解析结果。
  - `packages/util/home-paths/src/data-layout.mjs`：注册独立 `runtime-components/` Home 目录。
  - `apps/desktop-electron/package.json`：默认运行资源过滤掉随 SDK 安装的 `claude.exe`。
  - `apps/desktop-electron/src/main.mjs`：仅在打包桌面运行时注入组件清单位置。
  - `apps/desktop-electron/scripts/prepare-runtime.mjs`、`verify-packaged-runtime.mjs`：准备锁定组件清单并验证运行树没有大二进制且能力导入可用。
  - `apps/cli/tests/claude-sdk-component.test.mjs`、`data-directory-settings.test.mjs`、`subagent-claude-sdk-permissions.test.mjs`：覆盖按需/失败闭锁/缓存目录/授权顺序与 SDK 参数。
  - `apps/desktop-electron/tests/installer-package.test.mjs`：覆盖打包过滤和清单接线。
  - `packages/subagent/subagent-claude-code/README.md`、`packages/util/home-paths/README.md`、`apps/desktop-electron/README.md`：维护组件、Home 路径和发行包 Owner 合同。
  - 本合同与 `docs/PROMPTS.md`：记录范围、结果和未测项。
- 实际验证：
  - `pnpm install --lockfile-only --config.confirmModulesPurge=false`、`pnpm install --config.confirmModulesPurge=false` 通过；锁文件仅有对应工作区依赖改动。
  - `pnpm --filter lfaa-subagent-claude-code run build`、`pnpm run build:control-plane`、`pnpm run build:windows-sandbox-host`、`pnpm --filter lfaa-web run build:desktop-candidate` 通过；产物均位于根 `dist/`。
  - Claude 组件、权限、MCP 隔离、外部工作区、Home 目录回归通过（23/23）；Electron installer package 回归通过（5/5）；相关模块 `node --check` 通过。
  - 打包运行树检查通过：22,049 个文件，约 665.7 MiB，组件清单存在，`claude.exe` 为 0；桌面 CUA driver/tool 注册 smoke 通过。
  - 使用官方 npm registry 实际下载锁定 tarball：首次下载、SHA-512、提取二进制 SHA-256/大小校验均通过，首用总计 18 秒；第二次请求命中同一缓存且 fetcher 未调用。
  - 隔离 NSIS 包为 199,604,300 字节（199.6 MB），对比原 `.15` 安装器 298,312,560 字节减少 98,708,260 字节（98.7 MB，33.1%）；展开由约 945.9 MiB 降至 665.8 MiB，减少约 280.1 MiB。新包清单中 `claude.exe` 为 0。原 `.15` 发行包保持不变。
  - 本地 NSIS 临时验证配置使用缓存中校验通过的 Electron 44.4.5 归档，并跳过可执行文件图标/元数据编辑和签名步骤以绕过缺失的 `winCodeSign` 下载；此 `.tmp` 安装器只用于内容/体积核验，不是可发布安装包。
- 压缩和安装速度对照：当前 LZMA 包在隔离目录解压为 15.50 秒；原包为 15.90 秒。ZIP NSIS 对照（临时禁用差分更新，仅用于首次完整安装比较）大小为 265,790,705 字节（265.8 MB），解压为 16.53 秒，因此不采用 ZIP，也不改正式差分更新或压缩设置。NSIS 的 normal/maximum 在当前 Builder 下走同类 zlib 压缩，切换名称不能改善解压。当前实测只证明安装器下载量和落盘空间明显下降，解压代理仅快 0.40 秒，不能据此声称完整安装明显提速；约 22,000 个独立文件下，磁盘写入与实时扫描可能主导耗时，这是待进一步实测的假设。
- 实际安装验收：没有执行真实 NSIS 交互/静默安装。当前 Windows 用户注册表留有 `CliPathAdded=1`，而环境没有 Windows Sandbox；直接安装会改写真实用户 PATH 和安装记录。因此只测隔离目录中的归档解压，不把它表述成完整安装计时。若要确认用户报告的完整安装耗时，仍需在独立 Windows 用户/虚拟机上记录安装全过程。
- 性能/安全/可维护性证据与未测边界：默认包少 98.7 MB，首次安装落盘少约 280.1 MiB；Claude 首用需要联网且本机本次花 18 秒，离线且缓存未命中时该任务返回真实下载错误，Claude 能力不会静默降级。下载最多 512 MiB、超时 3 分钟、拒绝重定向/非锁定源，并在可执行前校验两层摘要。没有测真实签名发行包、真实全流程安装时间、不同磁盘/杀毒软件环境或下载网络分布；没有修改用户安装目录、偏好或数据。
- 设置中心：未新增配置；沿用现有 Anthropic Console API Key、`permissions.mode` 与 `aiRuntime.executionSandboxMode`，未更改默认值和用户偏好。

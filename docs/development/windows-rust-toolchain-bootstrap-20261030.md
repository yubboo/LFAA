# LFAA Windows Rust 工具链自动缓存（2026-10-30）

<a id="lfaa-windows-rust-toolchain-bootstrap-20261030"></a>

## 用户问题、目标与入口

- 用户问题：另一台 Windows 电脑从菜单 2 选择开发模式（模式 3）时，启动预检因没有 Cargo/rustup 而退出；菜单 3 的 Windows Electron 构建也依赖同一个 Windows Sandbox Host Rust 构建。本轮另外复现到 `lfaa.bat` 在菜单显示前因 PowerShell 解析错误退出。
- 期望结果：缺少 Rustup/stable 或 `x86_64-pc-windows-msvc` target 时，从 Rust 官方分发源下载并安装到当前 LFAA 数据根的 `cache` 子目录；缓存路径通过现有数据目录解析器确定，不修改系统 PATH 或全局 Rust 安装。
- 运行入口：`lfaa.bat` → `scripts/install-dependencies.ps1` 菜单 2 → `scripts/start-dev.ps1` 开发模式，或菜单 3 → `pnpm run build:win`；共享原生构建为 `pnpm run build:windows-sandbox-host`。

## Owner、设置与数据边界

- Owner：开发/构建工具链由 `scripts` 启动与构建适配负责；Rust 原生宿主仍由 `native/system` 实现，`apps/daemon` 只调用现有 Cargo 构建入口，不复制 Sandbox 业务规则。
- 数据目录：复用 `scripts/resolve-data-directory.mjs` 得到当前 `LFAA_DATA_DIR`（含现有 Home、设置中心存储位置与 `.env` 规则）；工具链、rustup 与 cargo 缓存写入 `<LFAA_DATA_DIR>/cache/rust/`。不新增设置项，不读取或改变账户偏好。
- 安全边界：只从 Rust 官方 `static.rust-lang.org` 取 `rustup-init` 及其 SHA-256 sidecar，校验通过后执行；环境变量只作用于当前启动进程树。Microsoft C++ Build Tools 是 Windows MSVC 链接器与 SDK 的独立系统先决条件，不写入 LFAA cache，也不由本任务静默安装。

## 修改范围与验收

- 允许修改：共用 Rust 工具链 bootstrap、菜单 2/3 的调用点、目标 Owner README、定向长期回归、此合同与任务索引。
- 禁止改变：全局 PATH/注册表、用户已有 Rust Home、现有数据目录、安装器版本状态、Daemon 权限/运行行为、用户其他工作区差异。
- 可观察验收条件：
  1. Rust stable MSVC host/target 已满足时复用现有安装，不下载、不改用户环境。
  2. 缺少 Rust 工具链时，使用官方来源及匹配摘要下载；Rustup Home、Cargo Home 和工具链仅写到当前 Data 根 `cache/rust/`，并能被后续菜单启动/构建进程找到。
  3. 下载、摘要校验或安装失败时在终端给出可诊断错误，且不启动会调用 Cargo 的服务/构建；并发启动不会同时写坏同一安装目录。
  4. 运行 PowerShell 解析与定向回归、相关工作区 Gate/差异检查；真实另一台设备及其 VS C++ Build Tools 状态不能由本机脚本回归代替。

## 实施与验收记录

- 具体方案：新增共用 Windows Rust bootstrap；菜单 2 开发启动在停止旧服务前准备工具链，菜单 3 桌面构建在运行 pnpm 前准备工具链。已有完整全局安装直接复用；缺失时将 Rustup、stable host 与 x64 target 放入当前 Data `cache/rust`。bootstrap 使用 UTF-8 BOM，兼容菜单启动链使用的 Windows PowerShell 5.1。
- 变更文件：`scripts/windows-rust-toolchain.ps1`（官方来源校验、数据缓存路径、互斥安装、进程内环境接入及 Windows PowerShell 5.1 编码兼容）；`scripts/start-dev.ps1`（菜单 2 开发启动前准备并复用工具链）；`scripts/install-dependencies.ps1`（菜单 3 构建前准备工具链）；`scripts/tests/windows-rust-toolchain.Tests.ps1`（来源、SHA-256、缓存路径、调用顺序与 PowerShell 解析回归）；`packages/host/daemon/README.md`（Daemon Windows 构建前置依赖）；`docs/PROMPTS.md` 与本合同（任务索引和验收记录）。
- 此前验证：`Invoke-Pester -Script 'scripts/tests/windows-rust-toolchain.Tests.ps1' -PassThru`：7 通过、0 失败；`pnpm run build:windows-sandbox-host`：通过，Cargo 将产物写入仓库根 `dist/apps/daemon/target`；调用 `Initialize-LfaaWindowsRustToolchain` 成功复用本机既有 stable MSVC target，并将 `RUSTUP_TOOLCHAIN` 限定在当前 PowerShell 进程；`git diff --check` 通过。此前 `pnpm run check:workspace` 未通过：包目录 JSON/Markdown 清单过期，以及 PROMPTS 中 3 个其他任务合同锚点缺失（Minecraft metadata recovery、Minecraft instance JVM configuration、Java environment master-detail）。
- 本轮启动链验证：修复前运行 `cmd.exe /d /c lfaa.bat`，退出码 1；PowerShell 在解析无 BOM 的 UTF-8 `scripts/windows-rust-toolchain.ps1` 时报告多处语法错误并显示乱码。PowerShell 7 对该文件解析为 0 错误，说明原有解析回归未覆盖菜单使用的 Windows PowerShell 编码行为。为 bootstrap 增加 UTF-8 BOM 后重跑同一命令，菜单正常显示；输入 `0` 后退出码 0。
- 性能/安全/可维护性证据与未测边界：缓存命中路径只检查本地 stable host、Cargo 与 x64 target；缺失时 checksum 最大 4 KB、安装器最大 32 MB，只允许 HTTPS `static.rust-lang.org` 及同主机重定向，摘要匹配后才运行安装器；互斥锁按当前 Data 缓存路径串行安装，环境变量仅作用于启动进程树，不改系统 PATH 或用户全局 Rust Home。回归用模拟下载验证匹配/不匹配摘要，没有在本机写入整套缓存或执行真实联网安装；另一台 Windows 电脑尚未复验。MSVC target 编译还需要 Microsoft C++ Build Tools 和 Windows SDK，其安装及组织许可由设备环境负责，本任务不静默安装 Visual Studio。
- 设置中心：不新增设置；复用现有 Data Directory Owner 与当前 `LFAA_DATA_DIR` 解析。

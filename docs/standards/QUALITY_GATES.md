# LFAA 质量门禁规范

## 1. 禁止假成功

`build`、`typecheck`、`test`、`lint`、`security` 等质量命令必须执行真实检查。尚未实现时必须明确返回失败。

## 2. 最小合入门禁

- 治理一致性；
- 格式化；
- lint 零 warning；
- TypeScript `tsc --noEmit`；
- 单元/集成/协议契约测试；
- 真实 build；
- Rust 相关检查；
- 依赖边界；
- 安全扫描和依赖审计；
- 无无关文件修改；
- 关键实现文件结构化中文注释检查；
- 项目结构 / 目录职责文档同步检查；
- Windows PowerShell `UTF-8 with BOM` 编码检查；
- 当前发布版本 / CHANGELOG / Release 一致性检查；
- Web Shell Tooltip 单一提示源与鼠标事件契约检查。

## 3. Node.js 工具链

Node.js 依赖安装和 workspace 任务统一使用 pnpm。CI、本地脚本和文档命令不得混用 npm/npx/yarn/bun。

## 4. 变更分级

A：架构、安全、协议、数据库。  
B：普通功能。  
C：局部缺陷、文档和低风险脚本修复。


## 5. Setup 菜单依赖安装语义

`LFAA-Setup.bat` 菜单 `1` 用于安装“当前环境可用”的全部项目依赖：

- Node + pnpm/corepack 可用：安装 Node workspace 依赖；
- Cargo 可用：安装 Rust workspace 依赖；
- 某一工具链缺失：明确显示跳过，不得把已完成的另一类依赖安装误判为整体失败；
- 两类工具链都不可用：才视为菜单 1 无法执行。

菜单 `4`（Rust 依赖）和菜单 `10`（完整检查）属于严格操作，缺少 Cargo 时必须失败，不能伪装通过。


## Setup 环境检测真实性

环境准备不得使用以下方式伪造“已安装”：

- 只检查 `node_modules/` 是否存在；
- 只检查目录大小；
- 只检查命令名，不检查项目要求版本；
- Cargo 缺失时仍显示全部完成。

本地 Setup 依赖准备以：

```text
pnpm install
```

的真实结果为准，允许在开发新增依赖后同步 lockfile。

CI、正式质量门禁和可复现验证必须使用：

```text
pnpm install --frozen-lockfile
```

Rustup 自动下载必须来自 Rust 官方 HTTPS 地址，并在执行前通过官方 SHA-256 校验。


### Rust 工具链安装诊断

Rust 工具链自动准备必须满足：

1. 支持 `CARGO_HOME` 自定义路径；
2. Rust 缺失时直接使用官方 `rustup-init`；
3. Windows 必须先检测宿主 CPU 架构并映射到官方 target tuple；
4. Rust 官方 `rustup-init` 只允许从官方 HTTPS 来源下载；
5. 执行前必须通过官方 SHA-256；
6. 官方 rustup 原始输出允许保留英文；
7. LFAA 自身状态提示必须中文清楚。

Windows 当前允许的 Rustup target：

```text
x86_64-pc-windows-msvc
aarch64-pc-windows-msvc
i686-pc-windows-msvc
```


### Rust 工具链分层

- `rustup` / toolchain 使用共享安装，避免多项目重复占用空间；
- 根 `rust-toolchain.toml` 是项目 Rust 版本事实源；
- Setup 不得执行 `rustup default` 改写用户全局默认；
- `Cargo.lock` 必须跟项目走；
- Cargo build `target` 属于项目构建缓存；
- `CARGO_HOME` / `RUSTUP_HOME` 可自定义到非系统盘。


## 工具链与项目依赖边界

质量检查按以下边界判断环境是否完整：

```text
电脑基础工具
→ Node / pnpm / Git / Rust / Cargo

项目内容
→ node_modules / Cargo.lock / rust-toolchain.toml / target / .lfaa
```

禁止为了“项目隔离”给每个项目复制完整 Rust 工具链。

Rust 自动安装只走 Rust 官方 `rustup-init`：

- 官方 HTTPS；
- 官方 `.sha256`；
- 本地 SHA-256 校验；
- 校验通过后执行。

已有 Rust/Cargo 直接复用，不迁移、不覆盖。


### pnpm 原生构建脚本门禁

- `strictDepBuilds` 必须保持 `true`；
- 原生依赖必须以精确包名 + 版本进入 `allowBuilds`；
- 当前批准：`node-pty@1.1.0`；
- 禁止 `dangerouslyAllowAllBuilds: true`；
- 菜单 1 安装后必须验证 node-pty 可以被 Node 实际加载。


### node-pty Smoke Check

- 菜单 1 安装后必须验证 `node-pty` 可以被 Node 实际加载；
- node-pty Smoke Check 必须使用独立脚本文件；
- 禁止用依赖复杂引号的 `node -e` 内嵌代码作为 Windows PowerShell 校验；
- 当前校验入口：`scripts/check-node-pty.mjs`；
- 必须检查 `pty.spawn` 为函数。


## 代码可读性门禁

关键实现文件必须通过：

```text
node scripts/comment-check.mjs
```

该检查至少验证结构化文件头、关联文件说明和关键 CSS 分区注释。


## Windows 脚本编码门禁

所有 `scripts/windows/*.ps1` 必须通过：

```text
node scripts/windows-script-encoding-check.mjs
```

该门禁用于防止 Windows PowerShell 5.1 因 BOM 丢失而错误解析中文脚本。

## 发布版本一致性门禁

正式发布前必须通过：

```text
node scripts/release-consistency-check.mjs
```

它以 `lfaa.release.json` 为唯一版本事实源，检查 package / crate / README / CHANGELOG / Changelog / Release 是否仍混用旧版本。


## Web UI 静态契约门禁

工作台 Shell Header 的三个框架按钮必须通过：

```text
node scripts/ui-contract-check.mjs
```

该检查禁止 `title + 自定义 Tooltip` 双提示源，并要求 Tooltip `pointer-events:none`，防止提示层抢 Hover / Click。

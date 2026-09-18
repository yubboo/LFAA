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
- 无无关文件修改。

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

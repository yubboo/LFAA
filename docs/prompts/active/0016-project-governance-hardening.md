# #16 项目治理、归属与项目级资源边界加固

## 主模块

`project-foundation`

本任务是 `config-system` 开发前的全项目基础设施加固，不改变当前主业务模块顺序。

## 任务目标

- 补齐性能、安全、质量门禁的硬性要求；
- 固定 LFAA 官方命名、作者署名和第三方归属规则；
- 明确 Skills、Experts、Plugins、Extensions、MCP 等资源只能项目级安装；
- 新增菜单化依赖与开发检查脚本；
- 加强模块、权限、运行时与项目资源边界。

## 允许修改

- 根目录治理与项目说明文档；
- `docs/standards/**`、`docs/testing/**`；
- `docs/architecture/active/**`；
- `docs/plans/modules/project-foundation/**`；
- `docs/progress/modules/project-foundation/**`；
- `docs/plans/modules/config-system/**`；
- `docs/progress/modules/config-system/**`；
- `.lfaa/**` 项目资源骨架；
- `LFAA-Setup.bat`；
- `scripts/windows/lfaa-setup.ps1`；
- 与治理检查、同步保护直接相关的脚本。

## 禁止修改

- Config System 业务实现；
- Agent Loop；
- Tool Runtime 业务实现；
- Rust Broker 业务实现；
- 无关模块与历史归档架构。

## 状态所有权

- LFAA 项目身份由根治理文档与发行元数据拥有；
- 项目资源安装位置由项目根 `.lfaa/` 拥有；
- 用户目录不得成为 Skills、Experts、Plugins、Extensions 的事实源；
- Secret 仍由 OS Credential Store / Secret Broker 拥有，不进入 `.lfaa/`。

## 实现约束

- BAT 只做 PowerShell 启动；
- PowerShell 菜单必须包含 `1-10` 与 `0`；
- 写操作必须明确说明并取得确认；
- 脚本不得写死盘符或用户目录；
- 未实现的 build/typecheck/test 不得伪装成成功；
- 第三方代码必须保留原版权、许可证和来源信息。

## 安全约束

- `Full` 不得绕过硬拒绝、项目边界、Secret 隔离和 Rust Broker 校验；
- 项目资源不得从用户级目录隐式继承；
- 第三方资源安装必须记录来源、版本、哈希和许可证；
- 项目资源执行仍必须经过 Tool Runtime → Policy → Permission → Rust Broker。

## 验收条件

- 新规范进入强制阅读链路；
- 当前架构明确项目资源边界与不可绕过安全不变量；
- `LFAA-Setup.bat` 能打开菜单且 PowerShell 语法检查通过；
- 治理检查覆盖新增规范和脚本；
- Progress、Changelog 同步；
- 无无关业务代码修改。

## CHANGELOG 编号

`#16 项目治理、归属与项目级资源边界加固`

## 版本目标

待下一正式版本统一发布。

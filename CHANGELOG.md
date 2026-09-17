# LFAA 更新日志

> 根目录只保留当前索引和最近版本。
> 历史详细记录放入 `docs/changelog/`。

## #13 Git 更新脚本路径无关化

- 产品：Little Fish AI Agent
- 简称：LFAA
- 用户版本：v0.0.12
- 状态：delivered
- 日期：2026-09-18

### 完成

- Update 脚本不再依赖 `H:\`。
- 不再要求项目目录名必须叫 `lfaa`。
- 优先通过 `git rev-parse --show-toplevel` 自动识别真实 Git 根目录。
- 可从脚本目录、当前启动目录和附近 Git 工作区自动发现。
- 多个 Git 项目时提供数字选择。
- 自动发现失败时允许用户手工输入任意项目路径。
- 用户输入路径会验证是否真实 Git 仓库。
- 支持 C/D/E/H/U 盘及任意目录位置。
- 当前主业务模块仍为 `config-system`。

完整记录：

`docs/changelog/v0.0.12.md`

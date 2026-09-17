# LFAA 更新日志

> 根目录只保留当前索引和最近版本。
> 历史详细记录放入 `docs/changelog/`。

## #8 用户首次配置 Git origin

- 产品：Little Fish AI Agent
- 简称：LFAA
- 用户版本：v0.0.7
- 状态：delivered
- 日期：2026-09-18

### 完成

- Git 推送脚本不再写死远程仓库地址。
- 第一次没有 `origin` 时要求用户手工输入仓库地址。
- 输入后先显示地址并要求确认。
- 确认后保存到 `.git/config`。
- 后续运行自动读取现有 `origin`，不重复询问。
- origin 地址成为 Git 自己的唯一事实源。
- 推送日志记录本次实际使用的 origin。
- 当前主业务模块仍为 `config-system`。

完整记录：

`docs/changelog/v0.0.7.md`

## #7 GitHub 首次远程仓库检测与中文输出修复

历史版本：

`docs/changelog/v0.0.6.md`

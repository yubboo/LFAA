# 000113-20261118-1839-dependency-lockfile-line-endings

- 时间：2026-11-18 18:39:25 +08:00
- 类型：缺陷修复
- 关联开发日志：`../dev-log/000113-20261118-1839-dependency-lockfile-line-endings.md`

## 用户能看到的变化

- 修复 Windows 菜单选项 2 在依赖安装显示成功后仍误报 lockfile 不一致、从而拒绝启动 Web 的问题。
- 现在 pnpm 副本与仓库 lockfile 仅存在 CRLF/LF 换行差异时会正常通过预检；实际依赖内容不一致仍会要求处理。

## 影响范围与使用提示

- 可直接重新运行 `lfaa.bat` 并选择 `2`，或执行 `pnpm lfaa web`。

## 已知限制

- 无。

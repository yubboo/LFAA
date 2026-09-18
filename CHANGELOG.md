# LFAA 更新日志

> 根目录只保留当前索引和最近版本。

## #19 一键准备与依赖检测

- 用户版本：v0.0.34
- 状态：delivered
- 最新变更：#19.9
- 日期：2026-09-18
- 修复 Windows PowerShell 5 下 node-pty Smoke Check 的 `node -e` 引号丢失问题。
- node-pty 校验改为 `scripts/check-node-pty.mjs` 独立脚本。
- `allowBuilds` 精确许可和严格依赖构建策略保持不变。
- #21 真实终端开发桥接继续保持 pending-test。

详细记录：

`docs/changelog/v0.0.34.md`

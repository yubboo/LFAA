# #4 稳定工作区同步与 GitHub 推送

## 主模块

`project-foundation`

## 任务类型

开发基础设施优化

## 任务目标

让每个 LFAA 版本快照能够安全、完整地同步到：

```text
H:\lfaa\lfaa
```

并保证：

- `.git` 常驻；
- 新增/修改/删除真实检测；
- 彩色详细路径；
- 删除前确认；
- 同步后完整校验；
- 一键 GitHub 推送脚本随版本包恢复。

## 参考脚本风格

用户提供的 XMA Sync/GitHub BAT 采用：

- BAT 仅作为启动器；
- PowerShell 承担真实逻辑；
- 窗口保留结果。

LFAA 沿用该分层方式，并增加真实 diff、SHA-256 校验、颜色输出和稳定工作区定位。

## 禁止修改

- config-system 业务实现；
- Agent Runtime 行为；
- Rust Broker 行为。

## 验收

- 正式版本包含 `LFAA-Sync.bat` 与 `LFAA-GitHub.bat`
- PowerShell 位于 `scripts/windows/`
- 同步前展示 ADD/MOD/DEL 完整路径
- 同步后无项目文件差异
- `.git` 不被删除/覆盖
- GitHub 脚本始终优先操作稳定工作区

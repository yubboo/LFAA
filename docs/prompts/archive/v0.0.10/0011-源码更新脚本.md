# #11 Git Clone 后一键更新源码

## 主模块

`project-foundation`

## 问题

`git clone` 只适合第一次下载仓库。

GitHub 仓库后续更新时，不应该重新删除目录再 clone。

## 目标

新增：

```text
LFAA-Update.bat
scripts/windows/lfaa-update.ps1
```

实现已有 Git 工作区的一键安全更新。

## 安全规则

- 有未提交修改：停止；
- 本地与远程分叉：停止；
- 本地领先：不 pull，提示 Push；
- 本地纯落后：允许 fast-forward only；
- 禁止 hard reset；
- 禁止自动删除用户本地文件；
- 更新前展示远程文件变化；
- 更新后验证 HEAD；
- 保存本机更新日志。

## 不修改

- config-system 业务；
- Agent Runtime；
- Rust Broker。

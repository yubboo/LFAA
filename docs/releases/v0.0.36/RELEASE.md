# LFAA-v0.0.36 Release

## 状态

```text
delivered
```

## 任务

```text
#10.2 GitHub 推送预检容错
#21.8 三向吸附与显式重新展开
```

## 主要变化

- GitHub 一键推送改为 fetch + rebase + safe push；
- 远程预检失败不再直接阻断真正的 push；
- 对网络 / 代理 / TLS、认证权限、non-fast-forward 给出分类提示；
- 已经 commit 但尚未 push 的本地提交可直接继续推送；
- 左右栏吸附后不能从 resize handle 反向拖开；
- 底部终端新增向下吸附收起；
- 左 / 右 / 底部均通过显式入口重新展开。

## 实机验证重点

```text
LFAA-GitHub.bat
→ 1 一键推送
```

在工作区无新文件变化、但本地存在未推送 commit 时，应继续执行远端同步与 push。

Web 工作台：

```text
左 / 右 / 底部拖到阈值 → 吸附收起
收起后拖拽分隔条 → 不展开
点击对应边缘 / 底部入口 → 展开
```

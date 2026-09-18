# 应用壳

## 目录

`packages/app-shell`

## 当前职责

页面与 Feature 编排，供 Web / Desktop 共用。

当前已实现：

- `InkWorkbench`
- 左侧导航 / 会话区
- 中间工作区
- 右侧资源舱
- 水墨主题

Vite 特有的 `.lfaa` 开发桥接不放在本包，保持 App Shell 与运行环境解耦。

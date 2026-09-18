# #19.9 node-pty 校验引号兼容

## 主任务

`#19 一键准备与依赖检测`

## 问题

Windows PowerShell 5 下调用 `node -e` 时，内嵌 JavaScript 字符串中的引号可能被原生命令参数转换影响。

导致本来正确的：

```js
require("node-pty")
```

传到 Node 后变成：

```js
require(node-pty)
```

从而出现 SyntaxError。

## 修复

- 不再用 `node -e` 做 node-pty Smoke Check；
- 使用独立 `scripts/check-node-pty.mjs`；
- 从 `apps/web/package.json` 创建 require 上下文；
- 保留真实 `pty.spawn` 检查。

## 状态

`delivered in v0.0.34`

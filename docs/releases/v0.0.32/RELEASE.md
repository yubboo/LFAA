# LFAA-v0.0.32 Release

## 状态

```text
pending-test
```

## 任务

```text
#21.7 侧栏 Hover 与真实终端
```

## 已实现

- 侧栏自己的 Hover 控件；
- 分隔条与按钮彻底分离；
- 最底部 Terminal Dock；
- Terminal Dock 高度拖拽；
- xterm.js + node-pty 真实 PTY；
- Windows 默认 PowerShell；
- PTY 会话生命周期清理；
- localhost 开发安全边界。

## 未伪造通过

当前构建环境没有项目 pnpm/node_modules，无法真实安装 `node-pty` 并启动 Windows PTY。

因此本版本必须在用户 Windows 环境：

```text
Setup 1 → 安装新增依赖
Setup 2 → 启动 Web
```

完成实机测试后再将 #21.7 标记 deliverable。

# LFAA-v0.0.30 Release

## 状态

```text
delivered
```

## 任务

```text
#19.7 Setup 主菜单循环
#21.5 Web 启动延迟修复
```

## 主要变化

- Web 端口检测由“逐端口网络超时”改为“读取实际 TCP Listener”；
- 菜单 2 不再隐式安装依赖；
- 直接运行项目本地 Vite；
- Setup 普通操作全部返回主菜单；
- 只有 `0` 退出。

## 实机验证重点

```text
LFAA-Setup.bat
→ 2 启动 Web
```

应明显恢复为快速启动。

按 `Ctrl+C` 停止 Web 后，应回到主菜单。

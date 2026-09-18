# LFAA-v0.0.34 Release

## 状态

```text
delivered
```

## 任务

```text
#19.9 node-pty Smoke Check 引号兼容
```

## 核心变化

- 修复 Windows PowerShell 5 下 `node -e` 参数引号丢失；
- node-pty 校验改为独立 `.mjs` 文件；
- 保留 node-pty 精确构建许可；
- 保留真实 `pty.spawn` 检查。

## 实机验证

```text
LFAA-Setup.bat
→ 1 一键依赖
```

正常应看到：

```text
【校验】【node-pty】 检测真实终端原生模块是否可加载。
【通过】【node-pty】 真实终端原生模块可用。
```

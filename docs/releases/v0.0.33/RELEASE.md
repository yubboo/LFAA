# LFAA-v0.0.33 Release

## 状态

```text
delivered
```

## 任务

```text
#19.8 node-pty 跨机器安装
```

## 核心变化

- pnpm 精确批准 `node-pty@1.1.0` 的构建脚本；
- `strictDepBuilds` 继续开启；
- 禁止全部依赖构建许可；
- Setup 菜单 1 增加 node-pty Smoke Check。

## 实机验证重点

在没有旧 `node_modules` 的 Windows 机器：

```text
LFAA-Setup.bat → 1
```

不应再出现 `ERR_PNPM_IGNORED_BUILDS`。

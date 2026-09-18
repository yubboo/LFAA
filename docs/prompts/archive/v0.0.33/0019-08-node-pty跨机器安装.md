# #19.8 node-pty 跨机器安装

## 主任务

`#19 一键准备与依赖检测`

## 问题

全新 Windows 电脑执行：

```text
LFAA-Setup.bat → 1
```

pnpm 因 `node-pty@1.1.0` 的构建脚本未被项目审核而报：

```text
ERR_PNPM_IGNORED_BUILDS
```

## 目标

- 用户不需要手动运行 `pnpm approve-builds`；
- 只批准 LFAA 已审核、锁定的原生依赖；
- 不降低 pnpm 的供应链安全门禁。

## 实现

```yaml
strictDepBuilds: true
allowBuilds:
  "node-pty@1.1.0": true
```

并在 Setup 安装后做 node-pty Smoke Check。

## 状态

`delivered in v0.0.33`

# Plugin Host Node

## 作用

`@lfaa/plugin-host-node` 是 LFAA 插件 Profile 的唯一 Node/pnpm Provider。Web 开发宿主、未来 Desktop 和 CLI 都应复用它，禁止各自再写一套 `pnpm add`。

## 安装语义

1. 先 Inspect，再 Install；
2. 插件安装到 `.lfaa/state/plugin-profile`，不修改 LFAA 根 `package.json` / `pnpm-lock.yaml`；
3. 安装失败、取消或 Manifest 无效时恢复 Profile `package.json` + `pnpm-lock.yaml`；
4. 安装完成默认 `enabled=false`，用户看到结果后再启用；
5. install/build script 默认拒绝，只有 pnpm 标出的精确 pending package 经用户批准后才能重试；
6. 所有诊断先经过 Credential 脱敏；
7. 包代码在本阶段不会被 `import()` 到 Web/Electron 主进程。

## 角色

这是 Plugin Lifecycle Seam 的 **Service Provider**。`@lfaa/plugin-runtime` 是 Definition/Coordinator，设置页和未来 Agent Tool 是 Consumer。

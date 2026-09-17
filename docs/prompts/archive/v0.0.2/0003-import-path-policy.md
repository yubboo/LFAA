# #3 导入路径与 Alias 优化

## 主模块

`project-foundation`

## 任务类型

基础架构优化 / config-system 开发前置任务

## 任务目标

避免 LFAA 随目录增长出现：

```text
../../../
../../../../
```

等深层相对路径。

建立：

- `./` 同模块导入；
- `@/` 当前 workspace 导入；
- `@lfaa/*` 跨 package 导入；
- 自动检查。

## 允许修改

- 项目治理文件
- TypeScript workspace `tsconfig.json`
- scripts
- project-foundation Plan/Progress
- config-system Progress 前置记录
- Changelog / Release

## 禁止修改

- config-system 真实业务代码
- Agent Runtime 行为
- Rust 执行逻辑
- 数据库业务 Schema

## 验收

- 所有 TS workspace 有本地 `@/* -> src/*`
- 禁止 `../../` 及以上深层导入
- 跨 package 不访问 internal
- 自动检查可执行
- 主模块仍保持 `config-system`

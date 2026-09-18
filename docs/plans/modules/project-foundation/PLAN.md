# project-foundation PLAN

## 状态

```text
deliverable
```

## 目的

建立 LFAA v0.0.1 开发基础。

## 范围

- 产品身份
- Monorepo
- 根目录当前规范
- 当前/历史架构隔离
- 命名规范
- 模块边界
- Plan/Progress
- Prompt
- Changelog
- Version
- Apps/Packages/Crates 骨架

## 验收

- AI 进入根目录可找到开发入口；
- 当前和历史架构物理隔离；
- 主模块与下一步明确；
- 骨架模块有 README；
- Rust workspace 可独立检查；
- Governance check 可执行。

## #16 横向加固范围

`project-foundation` 已交付，但允许为后续业务补充以下全局硬边界：

- LFAA 官方命名、作者署名、版权与第三方归属；
- 项目级 Skills / Experts / Plugins / Extensions / MCP 安装位置；
- 性能、安全和质量门禁；
- 路径无关的依赖安装与开发检查菜单。

本加固不切换当前主业务模块，不实现 `config-system` 业务。

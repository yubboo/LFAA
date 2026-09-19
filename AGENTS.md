# AGENTS.md

> LFAA 仓库的 AI 开发入口。
> 用户说“按照开发要求做 / 按照开发规范开发 / 严格按照开发规范”时，必须按本文件和 `DEVELOPMENT.md` 执行，禁止只口头承诺。

## 0. 一眼先看到的唯一流程

```text
用户需求
→ 分配 #NN.x 编号 + 功能名称 + 新版本
→ 先写 docs/PROMPTS.md
→ 更新 docs/DEVELOPMENT_LOG.md / PROJECT_PLAN.md
→ 冻结边界、验收条件、必须测试
→ 才开始改 Code
→ AI 自测 + 自动门禁 + 能做的实际运行验证
→ 更新 CHANGELOG.md / docs/RELEASES.md
→ 状态 = pending-user-acceptance
→ 打包给用户验收
→ 用户明确通过后才允许 delivered
```

用户验收不通过：必须新建子编号、新 Prompt、新递增版本；旧包只读保留，禁止覆盖。

## 1. 强制阅读顺序

1. `DEVELOPMENT.md`
2. `docs/README.md`
3. `docs/PROMPTS.md` 中当前任务
4. `docs/DEVELOPMENT_LOG.md` 中对应编号
5. `ARCHITECTURE.md`
6. `PROJECT_PLAN.md`
7. `docs/MODULES.md`
8. 任务相关的 `docs/UI.md` / `docs/TESTING.md` / `docs/RUNTIME.md`
9. 对目录或源码关系不熟悉时读 `docs/项目结构与代码地图.md`
10. Code

未完成必要阅读和 Prompt 合同前，禁止修改业务代码。

## 2. 文档不再“一任务一个文件”

v0.0.50 起，历史通过固定长期文档中的编号时间线记录：

```text
docs/PROMPTS.md          # 所有 Prompt
docs/DEVELOPMENT_LOG.md  # 所有开发日志
CHANGELOG.md              # 所有版本变更
docs/RELEASES.md         # 所有发布记录
```

禁止重新创建 `active/archive/version-folder` 的 Markdown 碎片体系。

## 3. 当前事实源

```text
DEVELOPMENT.md
ARCHITECTURE.md
PROJECT_PLAN.md
docs/MODULES.md
docs/UI.md
docs/TESTING.md
docs/RUNTIME.md
docs/项目结构与代码地图.md
```

历史记录不能覆盖当前事实；当前事实变化时，同时在 Development Log / Changelog 留痕。

## 4. 代码可读性

关键实现文件必须写清：作用、负责、不负责、状态归属、对外接口、关联文件、修改注意事项。

复杂算法解释原因和不变量；CSS 写明盒子 / 区域结构；重要目录必须有 README 或项目地图入口。

Windows `scripts/windows/*.ps1` 必须保持 UTF-8 with BOM。

## 5. AI 四条硬规则

1. Prompt 先行；
2. 边界优先；
3. AI 自测不等于用户验收；
4. 全程可追溯。

## 6. 执行能力唯一链路

```text
Agent / Plugin / MCP / DSH
→ Capability / Tool Adapter
→ Tool Runtime
→ Policy Engine
→ Permission Engine
→ Rust Broker
→ OS
```

禁止绕过。

## 7. 包管理器与开发入口

Node workspace 只允许 `pnpm`。

Windows 开发入口：

```text
LFAA-Setup.bat
LFAA-Sync.bat
LFAA-GitHub.bat
LFAA-Update.bat
```

四者职责不得混用；详细规则看 `docs/RUNTIME.md`。

`LFAA-Setup.bat` 的菜单编号只是 Windows 便捷入口，不是开发协议：环境已就绪可跳过依赖准备；质量能力以根 `quality:*` / `release:*` 命令为长期入口，未来 CLI / GUI 复用能力而不是复用菜单编号。

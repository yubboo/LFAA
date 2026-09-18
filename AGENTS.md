# AGENTS.md

> LFAA 仓库的 AI 开发入口。
> 用户说“按照开发要求做”时，必须按本文件顺序读取，不得直接开始编码。

## 零、开发规范触发器

用户说“按照开发要求做 / 按照开发规范开发 / 严格按照开发规范”时，必须真实执行 `DEVELOPMENT.md` 的完整链路。

必须有可验证产物：Plan / Prompt / Code / Progress / Development Log / Standards（如有规则变化）/ CHANGELOG / Release / 门禁结果。不得只口头承诺。

旧版本只读保留，新修复必须递增版本；Active 与 Archive 不得混写。

## 一、强制阅读顺序

1. `/DEVELOPMENT.md`
2. `docs/README.md`
3. 如果对目录 / 文件关系不熟悉，读取 `docs/项目结构与代码地图.md`
4. `docs/logs/development/INDEX.md`
5. 根据任务关键词读取 `docs/logs/development/active/` 中的相关当前日志
6. `/ARCHITECTURE.md`
7. `/PROJECT_PLAN.md`
8. `/CHANGELOG.md`
9. 当前模块 README
10. 当前模块 PLAN
11. 当前模块 PROGRESS
12. 当前 Active Prompt
13. 相关 Standards
14. Code

需要追溯原因时再读：

```text
docs/logs/development/archive/
docs/architecture/archive/
docs/prompts/archive/
docs/changelog/
docs/releases/
```

未完成阅读前，禁止修改业务代码。

## 二、代码可读性硬要求

关键实现文件必须遵守：

```text
docs/standards/COMMENTS.md
```

必须写清：作用、负责、不负责、状态归属、对外接口、关联文件、修改注意事项。

关键 CSS 必须说明盒子结构和区域分区；一级目录职责必须能从 README 或 `docs/项目结构与代码地图.md` 找到。

治理入口：

```text
node scripts/comment-check.mjs
node scripts/windows-script-encoding-check.mjs
node scripts/release-consistency-check.mjs
```

Windows `scripts/windows/*.ps1` 必须保持 UTF-8 with BOM，不能为了补中文注释而改成无 BOM UTF-8。

## 三、当前与历史分离

当前实现依据：

- `DEVELOPMENT.md`
- `docs/logs/development/active/`
- `ARCHITECTURE.md`
- `docs/architecture/active/`
- `PROJECT_PLAN.md`
- 当前 Module PLAN / PROGRESS
- Active Prompt
- 当前 Standards

历史只用于解释“为什么变”，不能覆盖当前结论。

## 四、文档命名

编号类人类文档优先中文：

```text
0002-配置系统.md
0020-开发日志与文档规范.md
0020-01-历史编号迁移.md
```

固定入口文件保持：

```text
README.md
INDEX.md
PLAN.md
PROGRESS.md
RELEASE.md
```

详细规则：

```text
docs/standards/NAMING.md
docs/standards/DEV_LOGS.md
```

## 五、开发日志规则

需求、设计、架构、目录、行为或安全规则发生变化：

```text
先查主编号
→ 同一问题追加 #NN.x
→ 更新 active
→ 旧版本进入 archive
→ 旧版本指向当前文件
→ 更新 INDEX
```

旧记录不得删除。

## 六、当前主模块

```text
config-system
```

达到 `deliverable` 或明确 `blocked` 前，不切换无关业务模块。

## 七、AI 四大规则

1. 文档先行
2. 边界优先
3. 验证闭环
4. 全程可追溯

## 八、执行能力唯一链路

```text
Agent / Plugin / MCP / DSH Plugin
→ Capability / Tool Adapter
→ Tool Runtime
→ Policy Engine
→ Permission Engine
→ Rust Broker
→ OS
```

禁止绕过。

## 九、包管理器

Node.js workspace 只允许：

```text
pnpm
```

## 十、Git 源码更新

Git Clone 后统一使用：

```text
LFAA-Update.bat
```

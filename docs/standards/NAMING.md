# LFAA 命名规范

## `-`

默认用于项目目录、package、普通 TS 文件单词分隔：

```text
agent-runtime/
left-sidebar/
model-router/
deepseek-harness/
```

## `_`

TypeScript 目录/文件默认禁止用 `_` 分隔单词。

允许：

- Rust module：`process_broker.rs`
- DB field：`session_id`
- Python
- 生成代码
- 上游兼容层必须保持原命名

## `.`

只用于：

- 语义职责后缀
- 文件扩展名
- 隐藏配置

```text
session.store.ts
session.types.ts
session.test.ts
.env.example
```

禁止：

```text
left.sidebar.ts
agent.runtime.ts
```

## React 组件

```text
LeftSidebar.tsx
AgentRunPanel.tsx
```

组件目录：

```text
left-sidebar/
agent-run-panel/
```

辅助文件：

```text
left-sidebar.types.ts
left-sidebar.store.ts
left-sidebar.test.tsx
```

## 禁止模糊命名

```text
utils2.ts
new-helper.ts
final-final.ts
abc.ts
common-all.ts
```



## 文档命名

### 稳定目录

`docs/` 顶层目录使用短英文，作为稳定工具路径：

```text
standards
architecture
modules
plans
progress
prompts
logs
changelog
releases
testing
```

禁止随意增加同义目录，例如：

```text
doc
documents
notes
history-new
temp-docs
```

新增 docs 顶层目录必须先更新文档结构规范和治理检查。

### 固定入口文件

保持固定名称：

```text
README.md
INDEX.md
PLAN.md
PROGRESS.md
RELEASE.md
```

### 编号类人类文档

使用中文短名：

```text
NNNN-中文短名.md
NNNN-NN-中文短名.md
```

示例：

```text
0002-配置系统.md
0020-开发日志与文档规范.md
0020-01-历史编号迁移.md
```

### 普通技术源码

继续遵守原代码命名规则，不因为文档支持中文就把源码文件全部改成中文。

## 中文文档硬要求

LFAA 自有文档：

- 中文为主；
- 标题清楚；
- 一项一项列明；
- 文件名能直接看懂职责；
- 英文只保留命令、路径、API、代码、专有名词。

禁止模糊命名：

```text
其他.md
新文档.md
最终版.md
最新版.md
说明2.md
```

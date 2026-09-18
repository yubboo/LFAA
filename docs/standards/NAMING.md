# LFAA 命名规范

## LFAA 官方命名空间

面向外部的自有工具、发行物和 Rust crate 优先使用：

```text
lfaa-<domain>-<role>
```

TypeScript workspace 使用：

```text
@lfaa/<package>
```

普通内部文件不机械添加 `lfaa-`。第三方成果不得仅通过改名伪装成 LFAA 原创。

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

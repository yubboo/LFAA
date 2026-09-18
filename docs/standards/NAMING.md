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

固定治理文件使用固定名称：

```text
README.md
PLAN.md
PROGRESS.md
INDEX.md
```

普通文档文件名：

- 英文短名；
- `kebab-case`；
- 2 到 4 个语义词；
- 不把完整句子塞进文件名；
- 不使用临时状态词。

开发日志：

```text
NNNN-short-name.md
NNNN.x-short-name.md
```

示例：

```text
0020-dev-logs.md
0020.1-layout.md
```

禁止：

```text
0020-this-is-the-new-final-development-log-file.md
0020-final.md
0020-latest.md
0020-fix2.md
```

## 文档内容命名

标题必须表达真实职责。

推荐：

```text
# 开发日志规范
## 当前结论
## 最新变更
## 影响范围
```

禁止模糊标题：

```text
# 其他
## 一些修改
## 新东西
## 注意
```

LFAA 自有文档必须中文为主，英文只保留技术专有内容。

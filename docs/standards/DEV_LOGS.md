# 开发日志规范

> 开发日志用于记录需求、设计、架构和规则的变化。
> 机器运行日志不属于开发日志。

## 1. 固定目录

```text
docs/logs/development/
├── README.md
├── INDEX.md
├── active/
└── archive/
```

## 2. 当前与历史分开

```text
active/
→ 当前仍生效

archive/
→ 已交付、已替代或已废弃
```

开发时先查 `active/`，历史只用于对比。

## 3. 文件命名

### 当前主日志

```text
NNNN-中文短名.md
```

示例：

```text
0020-开发日志与文档规范.md
```

### 历史变更

```text
NNNN-NN-中文短名.md
```

示例：

```text
0020-00-开发日志初始分层.md
0020-01-历史编号迁移.md
```

文件名不使用：

```text
0020.1-dev-logs.md
```

这种人类难以直接理解的格式。

## 4. 编号显示

文档内部继续使用：

```text
#20
#20.1
#20.2
```

文件名里的：

```text
0020-01
```

对应：

```text
#20.1
```

## 5. 中文命名要求

文件名必须：

- 至少包含中文；
- 短、准、可搜索；
- 通常 4 到 12 个汉字；
- 技术专有名词可保留，例如 Git、GitHub、pnpm、Cargo、Setup；
- 不使用完整需求句子。

禁止：

```text
dev-logs
final
latest
new
fix2
```

## 6. Active 日志必须包含

```text
主编号：
名称：
最新变更：
状态：
关键词：
当前文件：

## 当前结论
## 最新变更
## 影响范围
## 验证结果
## 历史索引
```

## 7. Archive 规则

允许状态：

```text
delivered
archived
superseded
deprecated
```

### superseded

必须写：

```text
已由：
当前查看：
```

### delivered / archived

必须写：

```text
## 原始来源
```

## 8. INDEX 规则

每个真实主编号必须直接出现在：

```text
docs/logs/development/INDEX.md
```

不能只写“去旧目录找”。

索引至少包含：

- 主编号；
- 名称；
- 最新变更；
- 状态；
- 关键词；
- 文件路径。

## 9. 开发前读取

用户说：

```text
按照开发要求做
```

必须：

```text
DEVELOPMENT.md
→ docs/logs/development/INDEX.md
→ 匹配任务的 active 日志
→ Architecture / Plan / Progress / Prompt / Standards
→ Code
```

## 10. 开发后记录

发生以下变化必须更新：

- 用户要求；
- 设计；
- 架构；
- 安全规则；
- 文件/目录职责；
- 工具行为；
- 已有方案修正。

同一问题追加：

```text
#NN.x
```

独立问题才新建主编号。

## 11. 历史不能消失

- 旧记录不删除；
- 主编号不能无记录缺失；
- 原 Prompt / Progress / Changelog / Release 保留；
- Development Log 是索引和摘要，不替代原始历史。

## 12. 不伪造历史

不存在的编号不补造。

当前真实历史从 #1 开始，因此不创建虚假 #0。

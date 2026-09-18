# 开发日志规范

> 本规范只定义“开发决策与需求变更日志”的存放、命名、读取和归档方式。
> 机器运行日志继续使用 `workspace-sync`、`github-push`、`source-update` 等独立目录。

## 1. 目录结构

开发日志固定放在：

```text
docs/logs/development/
├── README.md
├── INDEX.md
├── active/
└── archive/
```

含义：

- `active/`：只放**当前仍然有效**的开发记录；
- `archive/`：只放**已经被新变更替代**的旧记录；
- `INDEX.md`：当前日志总索引，先看这里再打开具体日志；
- `README.md`：说明目录职责和维护方式。

禁止把开发日志直接平铺在 `docs/logs/development/` 根目录。

## 2. 当前与历史必须分开

### 当前记录

当前仍生效的日志：

```text
docs/logs/development/active/NNNN-short-name.md
```

示例：

```text
0020-dev-logs.md
```

### 历史记录

同一主编号被新变更替代后，旧版进入：

```text
docs/logs/development/archive/NNNN-short-name/
```

示例：

```text
archive/
└── 0020-dev-logs/
    ├── 0020.0-initial.md
    └── 0020.1-layout.md
```

历史文件只用于回溯，不能作为当前实现依据。

## 3. 编号规则

主任务：

```text
#20 开发日志分层规范
```

第一次有效版本：

```text
#20.0
```

同一问题继续调整：

```text
#20.1
#20.2
#20.3
```

独立的新问题才创建新的主编号。

禁止为了同一个问题不断创建新的主编号。

## 4. Active 日志顶部必须写清楚

每个 `active/*.md` 顶部必须包含：

```text
主编号：
名称：
最新变更：
状态：
关键词：
当前文件：
```

并且必须有以下标题：

```text
## 当前结论
## 最新变更
## 影响范围
## 验证结果
## 历史索引
```

阅读者不需要通读全文，就能先知道“现在应该按哪个结论开发”。

## 5. Archive 日志必须指向当前记录

每个被归档的旧日志必须写：

```text
状态：superseded
已由：#20.2 替代
当前查看：docs/logs/development/active/0020-dev-logs.md
```

禁止留下“旧方案失效了但不知道新方案在哪里”的孤立日志。

## 6. INDEX 必须可搜索

`INDEX.md` 必须至少列出：

- 主编号；
- 名称；
- 最新变更；
- 状态；
- 关键词；
- 当前日志路径。

关键词要使用稳定、短、可搜索的词，例如：

```text
日志
命名
权限
配置
模型
插件
热插拔
```

禁止堆砌长句作为关键词。

## 7. 开发前读取规则

用户说：

```text
按照开发要求做
```

第一步必须读取：

```text
DEVELOPMENT.md
```

然后严格按照 DEVELOPMENT 中的入口继续：

```text
docs/logs/development/INDEX.md
→ 与当前任务关键词匹配的 active 日志
→ 当前架构 / Plan / Progress / Prompt / Standards
→ Code
```

禁止跳过日志直接开发。

## 8. 开发后记录规则

发生以下任一情况，都必须更新开发日志：

- 用户改变需求；
- 当前设计被修正；
- 架构边界改变；
- 文件/目录职责改变；
- 工具行为改变；
- 安全规则改变；
- 已解决问题再次发生并产生新结论。

如果属于已有主编号：

```text
追加 #NN.x
```

如果是新的独立问题：

```text
创建 #NN
```

## 9. 中文文档硬要求

开发日志必须：

- 中文为主；
- 标题清晰；
- 一项一项列出；
- 当前结论放在前面；
- 变更原因、修改内容、影响范围、验证结果分开写；
- 英文只用于代码、命令、路径、API、专有名词；
- 禁止大段无标题流水账；
- 禁止只有“已优化”“已处理”而没有具体内容。

## 10. 文件命名硬要求

开发日志文件：

```text
NNNN-short-name.md
NNNN.x-short-name.md
```

要求：

- `NNNN` 固定四位数字；
- `short-name` 使用 `kebab-case`；
- 2 到 4 个短单词；
- 名称表达职责，不写 `final`、`new`、`latest`、`fix2` 等临时词；
- 文件名应简短清晰，禁止把完整需求句子塞进文件名。


## 11. 历史编号保留硬规则

建立或调整日志体系时，禁止只写：

```text
#1 - #19 去旧目录查看
```

而不在 Development Log 索引中逐条列出。

要求：

1. 已经真实存在的主编号必须逐条出现在 `INDEX.md`；
2. 当前仍生效的任务放入 `active/`；
3. 已完成任务放入 `archive/`；
4. 原始 Prompt / Progress / Changelog / Release 不删除；
5. Development Log 可以做摘要和索引，但不能替代原始历史来源；
6. 主编号从 #1 开始连续检查，缺号必须明确说明原因。

## 12. Archive 状态

`archive/` 不只表示 `superseded`。

允许：

```text
delivered
archived
superseded
deprecated
```

其中：

### superseded

必须包含：

```text
已由：
当前查看：
```

### delivered / archived

必须包含：

```text
原始来源
```

用于继续回溯详细记录。

## 13. 不伪造历史

如果某个编号从未真实存在：

- 不得为了“补齐”而虚构内容；
- 必须在 `INDEX.md` 明确说明未使用原因；
- 当前 LFAA 正式任务历史从 #1 开始，因此不创建虚假 #0。

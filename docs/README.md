# LFAA 文档中心

> 进入 `docs/` 后先看本文件。
> 目录负责分类，文件名负责让人一眼看懂内容。

## 新手导航

如果你主要想知道“这个文件夹 / 文件是干什么的”，直接看：

```text
docs/项目结构与代码地图.md
```

里面包含根目录地图、所有主要 package / crate 的作用，以及当前 Web UI 的 TSX / CSS 文件关系。

## 目录总览

```text
docs/
├── README.md                 # 文档总入口
├── 项目结构与代码地图.md       # 人类代码导航 / 目录说明
├── standards/                # 当前开发规范
├── architecture/             # 当前/历史架构
├── modules/                  # 模块职责说明
├── plans/                    # 模块开发计划
├── progress/                 # 模块开发进度
├── prompts/                  # 任务合同
├── logs/                     # 开发日志与运行日志
├── changelog/                # 版本变更记录
├── releases/                 # 正式发布记录
└── testing/                  # 测试规范与策略
```

## 为什么目录仍用短英文

这些目录属于稳定工具路径，会被脚本、治理检查和 AI 读取。

因此目录名保持：

- 短；
- 稳定；
- ASCII；
- 不频繁改名。

## 为什么文档文件名优先中文

人类需要经常浏览文档。

编号类文档统一使用：

```text
编号-中文短名.md
```

示例：

```text
0002-配置系统.md
0020-开发日志与文档规范.md
0020-01-历史编号迁移.md
```

固定入口文件继续使用：

```text
README.md
INDEX.md
PLAN.md
PROGRESS.md
RELEASE.md
```

这些属于约定接口，不改成中文文件名。

## 开发时先看

```text
/DEVELOPMENT.md
→ docs/logs/development/INDEX.md
→ 当前相关 active 日志
→ 当前架构 / Plan / Progress / Prompt / Standards
```

## 日志怎么分

```text
docs/logs/development/
→ 需求、设计、架构、规则的开发记录

docs/logs/runtime/
→ Sync / GitHub / Update 等脚本运行日志
```

两类日志不得混放。

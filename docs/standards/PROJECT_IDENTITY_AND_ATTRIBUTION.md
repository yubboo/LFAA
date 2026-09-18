# LFAA 项目身份、命名、版权与第三方归属规范

## 1. 项目身份

- 产品：Little Fish AI Agent
- 简称：LFAA
- 作者署名：二鱼
- 官方命名空间：`lfaa`、`@lfaa/*`、`lfaa-*`

`lfaa` 命名空间代表 LFAA 自有项目内容，不得用于伪装第三方代码或未经授权的派生物。

## 2. 官方命名

面向外部的 LFAA 自有工具、发行物、Rust crate 和独立组件优先使用：

```text
lfaa-<domain>-<role>
```

例如：

```text
lfaa-project-resolver
lfaa-plugin-runtime
lfaa-secret-store
```

TypeScript workspace 使用已有作用域：

```text
@lfaa/<package>
```

普通内部文件不强制重复添加 `lfaa-`，避免 `lfaa` 前缀污染所有局部命名。

所有 `package.json` 必须写入 `"author": "二鱼"`，所有 LFAA Rust crate 必须写入 `authors = ["二鱼"]`；治理检查负责强制验证。

## 3. 自有文件署名

重要的新源码、脚本、模板可使用：

```text
Copyright (c) 2026 二鱼.
Part of the LFAA project.
```

仓库根许可证尚未确定前，不得擅自填写虚构的 SPDX 标识或宣称某种开源许可证。

署名不能代替清晰的模块说明；仍需写明负责、不负责、状态 Owner 和安全边界。

## 4. 第三方成果必须尊重原作者

使用第三方代码、设计、协议、算法实现或资源时必须：

1. 先确认许可证允许当前使用方式；
2. 保留原版权声明和许可证文本；
3. 在 `NOTICE.md` 或对应模块文档记录项目名、作者、来源 URL、许可证、使用范围和修改内容；
4. 明确区分“灵感参考”“接口兼容”“基于源码修改”“复制代码”；
5. 不得用“参考”掩盖实际复制，不得把第三方代码改名为 `lfaa-*` 后宣称完全自有；
6. 许可证冲突或来源不清时停止合入并记录为 blocked。

推荐说明：

```text
本功能的交互思路参考 <项目/文章>，实现由 LFAA 独立完成，未复制其源码。
```

如果实际修改了第三方源码，必须写：

```text
Based on <project> by <author>, licensed under <license>.
LFAA modifications: <summary>.
```

## 5. AI 生成内容

AI 参与不改变责任归属：提交者仍需检查来源、许可证、相似实现和安全边界。

无法确认来源的长代码片段不得直接进入仓库。

## 6. 合入门禁

新增 package、crate、Skill、Expert、Plugin、Extension 或较大功能时必须回答：

- 是否为 LFAA 原创；
- 是否使用第三方成果；
- 作者和来源是否记录；
- 许可证是否兼容；
- 是否需要更新 `NOTICE.md`。

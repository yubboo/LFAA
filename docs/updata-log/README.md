# 更新日志（updata-log）

面向用户的变更记录：新功能、修复、优化。一条一个文件，文件名即编号 + 时间 + 英文短名：

```text
000435-20261123-2215-settings-dialog.md
 │      │        │      └─ 英文短名（kebab-case，能看懂做了什么）
 │      │        └──────── 时间 HHMM
 │      └───────────────── 日期 YYYYMMDD
 └──────────────────────── 六位任务号（与 dev-log 同号，便于对照）
```

规则：

- 只有**用户能感知**的变化才写这里；纯内部重构写 `dev-log/`。
- 编号与 `dev-log` 同步递增，不复用、不跳号（历史重号已登记在 `scripts/log-number-baseline.json`）。
- 新条目从 [templates/updata-log.template.md](../templates/updata-log.template.md) 复制。
- 不写未发生的变更，不把计划写成已完成。

配套：每轮的实施事实与文件清单在 [dev-log](../dev-log/)；设计背景见 [features](../features/README.md) 与 [plans](../plans/README.md)。
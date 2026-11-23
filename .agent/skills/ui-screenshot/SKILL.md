---
name: ui-screenshot
description: 用 `pnpm ui:shot` 给真实界面截图并自查。改完任何界面（布局、弹窗、颜色、状态、窄屏）后，先出图再评价，不要凭想象判断。
---

# UI 截图（ui:shot）

本仓的界面验收方式是**看图**。截图工具用本机 Edge/Chrome 无头打开生产构建，按 `scripts/ui-shot-tasks.ts` 里的任务逐项操作后出图。

## 用法

```sh
pnpm ui:shot                      # 跑全部任务
pnpm ui:shot --list               # 看有哪些任务（名称 / 尺寸 / 主题 / 说明）
pnpm ui:shot --only=settings      # 名字包含 settings 的任务
pnpm ui:shot --group=app          # 只跑 app 组
pnpm ui:shot --theme=light        # 强制浅色
pnpm ui:shot --only=app-home-light,settings-general --build   # 先重建 Web 产物
pnpm ui:shot --url=http://127.0.0.1:5173/                     # 直接截正在跑的 dev server
```

- 产物：`shots/<任务名>.png` + `shots/manifest.json`（生成时间、Web 产物时间、每条任务的主题/视口/耗时/控制台报错）。`shots/` 已在 `.gitignore`，不入库。
- 没有 Edge/Chrome 时自动跳过并以 0 退出。
- 某条任务找不到元素会记 `✖` 并写进 manifest 的 `failure`，进程退出码 1。
- 控制台有报错不会让工具失败，但会在末尾列出——**这也算验收不通过，要修**。

## 新增一个截图任务

1. 在 `scripts/ui-shot-tasks.ts` 的 `TASKS` 里加一条：`name`、`group`、`description`、可选 `width/height/theme`、`steps`。
2. 步骤只能用现成的 `click` / `clickText` / `hover` / `press` / `wait`；需要新交互就往 `ShotStep` 里加一种，不要写一次性脚本。
3. 跑 `pnpm ui:shot --only=<新名字> --build` 确认出图正确，再把图贴进交付说明。

## 约定

- 任务名用 kebab-case，按页面或状态命名（`settings-git`、`app-mobile-home`），不要按 bug 编号命名。
- 截图是**证据**不是装饰：交付前至少覆盖改动涉及的主态 + 深色 + 窄屏各一张。
- 需要「状态画廊」（加载中/流式/报错等假数据态）时，在任务里用 `--url` 指向专用入口并造数据，不要往生产代码里塞测试开关。
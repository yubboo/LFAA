# LFAA UI

## 目录

`packages/ui`

## 定位

LFAA **所有可复用图形界面的唯一主目录**。Web / Desktop / Linux 图形宿主复用这里的 UI，不在各 App 复制第二套业务页面。

## 负责

```text
src/primitives/    Button / Input / Dialog / Tabs 等基础组件
src/layout/        可复用布局
src/workbench/     工作台几何、Resize、Snap
src/features/      可复用业务 Feature UI
```

AI 设置界面固定归：

```text
src/features/settings/ai/
```

## 不负责

- Config / Account / Auth / Provider 业务真值；
- Provider 外部 API 请求；
- Secret 保存 / Credential Store；
- SQLite / Config Storage；
- Web / Electron / CLI 宿主桥；
- 模型推理 Runtime。

UI 通过 Props / Controller / ViewModel 接收业务能力，不直接导入业务包内部实现。

## 对外 API

统一由 `src/index.ts` 暴露。包外禁止深链内部文件。

Workbench 导航：`src/workbench/README.md`。
Feature UI 导航：`src/features/README.md`。

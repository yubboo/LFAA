# packages：共享 TypeScript / React 模块

> `packages/` 是 LFAA 的共享业务层和 UI 层。App 不应该把所有逻辑都堆在 `apps/`。

## 当前最常看的

```text
app-shell/
→ 页面区域和 Feature 编排
→ 当前 AgentWorkbench 在这里

ui/
→ 纯 UI / Layout
→ 当前 ResizableWorkbench 拖拽、吸附在这里

config-system/
→ 配置系统业务边界
→ v0.0.51 起拥有唯一 Config Schema / 默认值 / 运行时校验
```

其他 package 的逐项职责见：

`docs/项目结构与代码地图.md → 4. packages/`

每个 package 自己也必须有 `README.md` 说明“作用 / 不负责 / 对外 API / 状态归属”。

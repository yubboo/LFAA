# packages：可复用业务与 UI 模块

> `packages/` 只放可跨 Web / Desktop / CLI / Server 复用的模块。目录按长期职责划分，不按“当前先在哪个端开发”划分。

## 核心职责地图

```text
app-shell/
→ 页面 / Feature 编排
→ 连接 UI 与业务公开接口

ui/
→ LFAA 可复用图形界面的唯一主目录
→ Primitive / Layout / Feature UI

config-system/
→ 配置设置业务唯一归属
→ Schema / Settings / Account / Auth / AI Provider 配置 / 后续 Storage

model-providers/
→ 模型运行期 Provider Adapter
→ 不等于 Config System 的“Provider 配置插件”
```

## 硬边界

- UI 不拥有 Config / Provider / Secret 真值；
- Config System 不依赖 React / DOM / App；
- App 不复制 packages 中已有的业务或 UI；
- 同一家 Provider 可以在不同层有不同职责：配置期逻辑归 `config-system`，推理运行期 Adapter 归模型运行域；两者不得混为一个大杂烩目录；
- 跨 package 只从公共 Export 导入。

完整职责与依赖方向：`DEVELOPMENT.md → 目录职责、归属与依赖方向`。
完整导航：`docs/项目结构与代码地图.md`。

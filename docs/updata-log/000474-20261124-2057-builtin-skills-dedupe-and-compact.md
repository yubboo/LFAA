# UPDATE-000474｜内置技能精简与上下文压缩：移除空壳重复项、默认启停分层与目录摘要压减

- 时间（含时区）：2026-11-24T20:57:00+08:00
- 类型：优化
- 关联开发日志：`../dev-log/000401-000600.md`（DEV-000474）

## 用户能看到的变化

- **保留上游原目录便于后续更新**，仅移除 3 个纯路由空壳与完全重复项（`ask-emil`、`ui-skills-root`、`fixing-motion-performance`），内置技能精简为 **40 项**。
- **默认启停分层**：26 项高频核心技能（完整覆盖全部 11 组来源）默认启用；14 项高度重叠或细分场景技能（`baseline-ui`、`improve-ui`、`write-swift`、`animate-expo`、`ask-sonner`、`animation-vocabulary`、`find-animation-opportunities`、`improve-animations`、`remove-animations`、`learn-taste`、`pick-ui-library`、`prototype`、`apple-design`、`mobile-native`）默认关闭，仍在「技能中心」可见，需要时可一键开启并持久化记住状态。
- **每轮系统提示词大幅瘦身**：单条目录描述自动压缩至 120 字符以内（不影响 `load_skill` 读取完整正文），系统提示词技能目录由约 18,300 字符（~5,229 tokens）降至 **4,672 字符（~1,335 tokens，降幅 74.5%）**。

## 影响范围与使用提示

- 如需使用默认关闭的细分技能，打开「技能中心」开启对应开关即可，刷新重启后状态保持生效。
- 全部保留的内置技能均维持上游原目录结构，后续直接覆盖更新无合并冲突。

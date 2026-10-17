# 登录进入动画插件合同

LFAA 的登录进入动画是可替换的 Client 扩展点。默认实现由 LFAA 根 Renderer 提供，使用浏览器 View Transition 把登录卡片和工作台根画面连续衔接。安装并装配的 DSH Client 插件可以贡献 `auth.transition`，用户从设置中心选择实际动画来源。

## Slot 与输入

- 名称：`auth.transition`
- 类型：`list`，范围：`root`
- 注册 ID：插件为本项贡献提供稳定且唯一的 ID，并通过 `options.label` 提供设置中心显示名。
- `owner.phase`：`preparing` 表示登录成功、设置和工作台依赖仍在准备；`entering` 表示工作台已就绪，即将运行整屏 View Transition。
- `owner.reducedMotion`：当前「减少动态效果」设置对本次进入动画的最终判断。值为 `true` 时插件不能启动动态效果。

组件通过 DSH Slot 收到 `owner`，可在 `entering` 阶段向 `::view-transition-group(lfaa-auth-scene)`、`::view-transition-old(lfaa-auth-scene)` 与 `::view-transition-new(lfaa-auth-scene)` 提供自己的 CSS。LFAA 根 Renderer 在一次转场结束后撤销用于选择动画的文档标记。未选择插件或插件已不可用时使用内置动画；旧选择保留在设置中，用户可重新选择。

## 生命周期示例

以下示例展示登记方式。组件只在用户选中该 ID 后作为动画贡献渲染。

```tsx
const slotName = "auth.transition";
const contributorId = "example-auth-scene/transition";

function TransitionContribution({ owner }: {
  owner: { phase: "preparing" | "entering"; reducedMotion: boolean };
}) {
  if (owner.phase !== "entering" || owner.reducedMotion) return null;
  return <style>{`
    ::view-transition-group(lfaa-auth-scene) {
      animation-duration: 760ms;
      animation-timing-function: cubic-bezier(.7, 0, .2, 1);
    }
    ::view-transition-old(lfaa-auth-scene) { animation: example-auth-old 760ms both; }
    ::view-transition-new(lfaa-auth-scene) { animation: example-auth-new 760ms both; }
    @keyframes example-auth-old { to { opacity: 0; } }
    @keyframes example-auth-new { from { opacity: 0; } }
  `}</style>;
}

ctx.effect(() => ctx.slots.inject(slotName, () => ctx.slots.register(
  { name: slotName, id: contributorId, label: "Example · 进入工作台" },
  TransitionContribution
)));
```

正式插件仍须按 DSH 的 React、TypeScript、Slot 和插件生命周期合同构建；上例只说明 LFAA 向贡献项传递的数据与选择方式。不要把用户凭据或 LFAA 私有状态加入组件 Owner。

## 设置与回退

- 设置路径：`appearance.advanced.authTransitionPluginId`，共享默认值为 `builtin`。
- 减少动态效果复用 `appearance.advanced.reducedMotion`：`on` 跳过动画，`system` 遵循操作系统，`off` 允许播放。
- 旧设置没有动画 ID 时只补 `builtin`，既有主题、遮罩、字体、对比度等偏好保持原值。
- 新动画只在密码、通行密钥或首次初始化认证成功后启动；错误密码、恢复密码失败和会话恢复不会调用该动画。
- 用户插件只提供画面，不替代身份验证、认证 API 或 Permission Owner。

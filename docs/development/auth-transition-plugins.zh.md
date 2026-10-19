# 登录进入动画插件合同

LFAA 的登录进入动画是可替换的 Client 扩展点。默认实现由 LFAA 根 Renderer 提供：先在登录覆盖层后挂载并预热隐藏的 Workbench，再播放内置的壁纸引力透镜与登录卡片吸入动画。动画到达事件视界后，Workbench 在覆盖层后变为可见但继续保持 `inert` 和 `aria-hidden`；覆盖层用 240ms `opacity` 淡出后才解除门控并显示提醒。登录卡片使用首尾减速的 `transform` 缓动，不缩放整屏壁纸。默认路径不捕获整页快照，也不在动画期间同步挂载 Workbench。安装并装配的 DSH Client 插件可以贡献 `auth.transition`，用户从设置中心选择实际动画来源。

## Slot 与输入

- 名称：`auth.transition`
- 类型：`list`，范围：`root`
- 注册 ID：插件为本项贡献提供稳定且唯一的 ID，并通过 `options.label` 提供设置中心显示名。
- `owner.phase`：`preparing` 表示登录成功、设置和工作台依赖仍在准备；`entering` 表示目标场景已就绪且转场正在运行。自定义插件路径持续到浏览器 `ViewTransition.finished`；默认动画还会在主动画结束后淡出覆盖层，再解除工作台交互门控。提醒只在完整收尾后显示。
- `owner.reducedMotion`：当前「减少动态效果」设置对本次进入动画的最终判断。值为 `true` 时插件不能启动动态效果。

组件通过 DSH Slot 收到 `owner`。自定义插件可在 `entering` 阶段为 `::view-transition-group(lfaa-auth-scene)` 和 `::view-transition-old(lfaa-auth-scene)` 提供自己的 CSS；Renderer 在 `ViewTransition.ready` 后隐藏底层真实工作台并隐藏新场景快照，直到 `finished` 后才揭开页面、显示提醒并释放动画贡献。插件不得覆盖此约束或提前显示工作台内容。内置动画不创建 View Transition 快照：Workbench 首次挂载及主动画期间保持 `visibility:hidden`、`aria-hidden` 和 `inert`；最后 240ms 在登录覆盖层后显现并淡入，期间仍不可交互。淡出结束后，Renderer 才卸载覆盖层、解除 Workbench 门控并显示提醒。未选择插件或插件已不可用时使用内置动画；旧选择保留在设置中，用户可重新选择。

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
      animation-duration: 1500ms;
      animation-timing-function: cubic-bezier(.55, .05, .2, 1);
    }
    ::view-transition-old(lfaa-auth-scene) { animation: example-auth-old 1500ms both; }
    @keyframes example-auth-old {
      0%, 14% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
      82% { opacity: .72; transform: translate3d(0, -1vh, 0) scale(.945); }
      100% { opacity: 0; transform: translate3d(0, -1.6vh, 0) scale(.9); }
    }
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
- 工作台新场景及凭据/首次配置提醒仅在所选转场完整结束后显示；自定义插件只动画离场画面，不得让新场景提前可见。
- 用户插件只提供画面，不替代身份验证、认证 API 或 Permission Owner。

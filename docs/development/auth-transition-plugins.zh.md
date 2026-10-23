# 登录进入动画插件合同

LFAA 的登录进入动画是可替换的 Client 扩展点。默认实现由 LFAA 根 Renderer 提供：先在登录覆盖层后挂载并预热隐藏的 Workbench，再用 CSS 播放约 420ms 的黑洞核心、倾斜吸积环与登录卡片 3D 吸入动画，仅改变 `transform` 和 `opacity`。动画到达事件视界后，Workbench 在覆盖层后变为可见但继续保持 `inert` 和 `aria-hidden`；覆盖层用 160ms `opacity` 淡出后才解除门控并显示提醒。默认路径不运行逐帧 WebGL、不捕获整页快照，也不在动画期间同步挂载 Workbench。安装并装配的 DSH Client 插件可以贡献 `auth.transition`，用户从设置中心选择实际动画来源。

## 动画实现选择与 Motion 使用约定

- 固定时序、少量元素的进入/退出、淡入淡出和 3D 吸入继续用 CSS。当前内置登录转场保持 CSS 实现，不增加动画依赖；继续使用 `transform`、`opacity`、`perspective` 和 `transform-style: preserve-3d` 表达 3D 场景。
- 只有在动画需要 React 状态驱动的多段编排、手势/拖拽、布局协同或退出动画协调，且 CSS/现有浏览器 API 已难以清楚维护时，才评估 Motion for React。库不会自动消除卡顿；先确认实际需求，再检查产物体积、动画属性和目标设备上的帧时间。
- 若登录视觉 Owner 确实需要 Motion，将 `motion` 作为 `packages/client/ui-settings-account` 的直接依赖安装并更新工作区锁文件，不要放到应用根包或另一个共用 Owner 中重复声明。其他功能由其唯一视觉 Owner 持有依赖。Motion 只负责动画表达，不接管认证、转场阶段、工作台门控或用户设置。
- 常规 API：安装 `motion` 后从 `motion/react` 导入 `motion`，使用 `initial`、`animate`、`exit`、`transition` 等声明式属性。对关注首屏包体积的入口，优先评估 `m` + `LazyMotion`，只加载所需功能；文档示例：

  ```tsx
  import * as m from "motion/react-m";
  import { LazyMotion, domAnimation } from "motion/react";

  function Scene() {
    return (
      <LazyMotion features={domAnimation}>
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        />
      </LazyMotion>
    );
  }
  ```

- 对确实需要按阶段触发的时间线，可评估 `useAnimate`；它把选择器限制在组件作用域并在组件卸载时清理动画。不要用每帧 React state 更新驱动动画。使用 Motion 时仍优先动画 `transform`/`opacity`，避免无依据地增加滤镜、阴影、布局动画或常驻 `will-change`；保留现有透视和 3D 层级，不能为了接库把 3D 场景改平。
- 减少动态效果的唯一来源仍是设置中心的 `appearance.advanced.reducedMotion`，登录贡献项读取 `owner.reducedMotion`。Motion 的 `MotionConfig reducedMotion="always"` 仅自动跳过变换与布局动画、仍可能播放透明度等动画，因此不能单独满足本合同；当 `owner.reducedMotion` 为 `true` 时，必须显式跳过该转场的全部动态效果。不得新建第二套偏好或自行读取系统设置覆盖 Owner。
- 引入库前核对当前 React 兼容要求、维护状态、依赖体积与工作区包边界；改动依赖后运行对应包构建和直接回归，并检查打包体积。构建通过不等于运行流畅，仍需在代表性真实视口观察转场和帧时间。

参考资料（以官方文档当前内容为准）：[Motion 安装](https://motion.dev/docs/react-installation)、[Motion 性能与包体积](https://motion.dev/docs/react-reduce-bundle-size)、[Motion `useAnimate`](https://motion.dev/docs/react-use-animate)、[Motion 减少动态效果](https://motion.dev/docs/react-accessibility)、[Web Animations 性能指南](https://web.dev/articles/animations-guide)。

## Slot 与输入

- 名称：`auth.transition`
- 类型：`list`，范围：`root`
- 注册 ID：插件为本项贡献提供稳定且唯一的 ID，并通过 `options.label` 提供设置中心显示名。
- `owner.phase`：`preparing` 表示登录成功、设置和工作台依赖仍在准备；`entering` 表示目标场景已就绪且转场正在运行。自定义插件路径持续到浏览器 `ViewTransition.finished`；默认动画还会在主动画结束后淡出覆盖层，再解除工作台交互门控。提醒只在完整收尾后显示。
- `owner.reducedMotion`：当前「减少动态效果」设置对本次进入动画的最终判断。值为 `true` 时插件不能启动动态效果。

组件通过 DSH Slot 收到 `owner`。自定义插件可在 `entering` 阶段为 `::view-transition-group(lfaa-auth-scene)` 和 `::view-transition-old(lfaa-auth-scene)` 提供自己的 CSS；Renderer 在 `ViewTransition.ready` 后隐藏底层真实工作台并隐藏新场景快照，直到 `finished` 后才揭开页面、显示提醒并释放动画贡献。插件不得覆盖此约束或提前显示工作台内容。内置动画不创建 View Transition 快照：Workbench 首次挂载及主动画期间保持 `visibility:hidden`、`aria-hidden` 和 `inert`；最后 160ms 在登录覆盖层后显现并淡入，期间仍不可交互。淡出结束后，Renderer 才卸载覆盖层、解除 Workbench 门控并显示提醒。未选择插件或插件已不可用时使用内置动画；旧选择保留在设置中，用户可重新选择。

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

# RuntimeControl 模块

Composer 下的独立子模块，负责模型快切、模型 Capability 投影、reasoning preview/commit queue 和强力推理 UI。

```text
RuntimeControl.tsx              # View / Popover 装配
├─ RuntimeModelPicker.tsx       # 模型列表
├─ ReasoningControlRow.tsx      # 真实 reasoning stages → shared DiscreteSlider/Effect
├─ useRuntimeControlController  # 局部状态/提交队列/boost
├─ contracts.ts                 # 模块内部 public contract
└─ RuntimeControl.module.css    # 仅本模块静态皮肤
```

- Slider Pointer、Canvas 粒子、Disclosure 等共享算法继续由 `@lfaa/ui` 拥有，不复制到本目录。
- Provider/Config capability 只能通过窄依赖 facade 输入；本模块不能自己发明 Provider 字段。
- 修改 RuntimeControl 不允许顺带编辑 Left / Conversation / Right / Terminal。

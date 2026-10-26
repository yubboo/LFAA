<a id="lfaa-canvas-home-fluid-background-20261026"></a>

## 画布首页流体背景（2026-10-26）

### 用户目标、入口与 Owner

- 用户不接受此前低对比的 SVG 细线，要求 `/canvas` 具有 Magine Canvas 参考页那种连续、可见的流体运动与高光层次。
- 运行入口：Web/Desktop 共用 Workbench 的 `/canvas` 路由，装配 `packages/client/ui-workspace/src/CanvasHome.tsx`；本页装饰层 Owner 是 `packages/client/ui-workspace`，独立渲染组件为 `CanvasHomeFluidBackground.tsx`。
- 用户提供 [在线试用页](https://magine-trial.magine1921.workers.dev/) 与 [MagineCanvas-Learn 仓库](https://github.com/Magine1921/MagineCanvas-Learn)。只读检查了参考页及 `src/components/canvas/WaterBackground.tsx`：其视觉包含实时水面扰动、高光/涟漪。参考仓库标注 AGPL-3.0-only；LFAA 根目录无 LICENSE 文件。本轮只借鉴视觉方向，不移植参考着色器源码或 `public/backgrounds/bg.svg`，使用独立公式绘制。
- 原背景实现已被用户明确否定并从 CanvasHome 删除；不能再把静态/缓慢平移的光纤作为验收结果。

### 设置、数据与权限边界

- 背景颜色沿用 `settings.appearance.accentColor`，动效沿用 `settings.appearance.advanced.reducedMotion`；系统 `prefers-reduced-motion` 同时生效。不新增控制项，不改默认值或用户偏好。
- 透明背景保留 Workbench 的主题、`appearance.backgrounds.appCenter` 壁纸、遮罩与 Wallpaper Engine。页面内容与项目数据请求不变。
- 效果只在首页空白区响应指针；背景层 `pointer-events:none`，交互监听挂在 CanvasHome 根节点并排除按钮、链接、表单控件。
- 资源边界：一个 WebGL canvas；最大绘制预算 1.25M 像素；ResizeObserver 只观察背景容器；页面隐藏或设置减少动态效果时停止 RAF，卸载时撤销 RAF、观察器和事件；WebGL 不可用时退化到 CSS 渐变层。

### 实施记录

- `CanvasHomeFluidBackground.tsx` 用 LFAA 独立编写的解析流场生成连续水面弯折、折射高光与焦散；空白区点击产生有限寿命的单道扩散涟漪。不是将参考源码改色后提交。
- `canvas-home.css` 保留轻柔多层 CSS 流光作为底色/降级；背景放在内容后方，桌面、窄容器、明暗主题与减少动态效果分别适配。未新增 CSS 自定义变量或依赖。
### 验收记录

- `node --test apps/cli/tests/client-canvas-home-fluid-background.test.mjs`：1/1 通过；覆盖组件挂载、强调色与减少动态效果配置、页面隐藏暂停、涟漪、像素上限、资源清理和无 WebGL 降级。
- `pnpm --filter lfaa-client-ui-workspace run build`：通过。
- `pnpm run build:web`：当前共享工作区重跑未通过 TypeScript 检查，错误位于未改动的 `packages/client/ui-settings/src/SettingsPage.tsx`，涉及 `secretLabel`、`modelInput`、`scope`、`verificationToken`、`documentationUrl` 等 Plan 字段；本轮未修改该文件。单独运行 Vite bundler 到 `dist/.tmp/canvas-home-fluid-check` 后通过（3880 个模块），这不替代完整 Web 类型检查。该目录是本轮临时构建产物，位于仓库允许的 `dist/.tmp/`；尝试清理时，工具策略拒绝了递归删除命令，因此产物仍保留。
- `git diff --check`：通过。
- `pnpm run build:control-plane`：未通过。当前共享工作区中 `packages/core/agent-loop/src/execute-turn.ts:982` 有 `exactOptionalPropertyTypes` 错误，`packages/core/agent-loop/src/pi-runtime.ts:146-147` 访问了推断类型中不存在的 `tools`。这些文件不是本轮改动，本轮未修改它们。构建清理后控制端产物缺失/未就绪；`node scripts/runtime-build-state.mjs web` 返回 `["host","web"]`。
- ChatGPT 内置浏览器实页未通过：尝试的源码页为 `http://127.0.0.1:5180/canvas`，页面实际显示“控制端暂不可用”，其 `/api/health` 代理请求超时；3000 源码控制端未装配前端时 `/canvas` 返回 404，带前端启动又被缺失的 Control Plane 构建指纹阻断。最终检查时 3000/3001/5173/5180 均无监听，原 3000 浏览器标签显示“无法访问此站点”。没有获得画布首页截图，也没有完成桌面、窄分栏/短屏与交互验收；没有帧时间实测。
- 未改动账户偏好或项目数据。实现设有 1.25M 像素上限、单 RAF、隐藏页暂停及卸载清理；这些是源码证据，不代表真实浏览器帧时间已验证。等待共享 Control Plane 类型错误修复并成功构建后，再完成 `/canvas` 内置浏览器验收。


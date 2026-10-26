# 画布右下角 AI 对话入口悬停上浮（2026-10-26）

<a id="lfaa-canvas-chat-launch-hover-lift-20261026"></a>

## 用户目标与入口

参考用户提供的 React Bits FlyingButton 视觉提示，让无限画布右下角“与 AI 对话”入口在鼠标悬停时喷焰起飞并扬起烟雾。只调整该入口的反馈，保留现有点击打开小鱼助手的语义。

- 运行入口：Web 与 Electron 共用的 Canvas Workspace 页面，截图实际路由为 `/apps/workspace/canvas/:projectId`。
- UI Owner：`packages/client/ui-workspace` 中的 Canvas Workspace 按钮与局部样式；通用主题表面和颜色继续由 `packages/client/ui-theme` 提供。
- 设置：沿用 `appearance.advanced.reducedMotion`，权威默认值为 `system`；Workbench 将账户选择映射到 `.workbench-shell[data-reduced-motion]`，系统减少动态偏好由既有主题/样式合同处理。不新增设置或覆盖用户偏好。
- 数据与权限：无数据写入、网络请求或权限变化；按钮点击仍进入既有 Canvas 小鱼助手与 Agent Loop。
- 上游参考：用户选择 React Bits Flying Button 的 JS/CSS 变体，页面描述悬停喷焰与 WebGL 烟雾。2026-10-26 核对[官方许可证](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md)为 MIT + Commons Clause，允许商业使用但限制将组件本身单独、打包或移植再分发；因此不运行 shadcn CLI、不复制或安装其源码。LFAA 实现为所属 Canvas UI Owner 内的独立 CSS 渐变，不含上游代码或依赖。
- 性能边界：动效只针对单个按钮；起飞使用 transform，喷焰/烟雾用 opacity 与 transform 过渡，没有 WebGL、计时器、监听器、帧循环或依赖；退出时由 CSS 转场复位。

## 允许范围与验收

- 允许：Canvas 按钮结构与局部 CSS、ui-workspace README、此合同与 PROMPTS 索引及定向回归断言。
- 禁止：改变按钮位置/功能、助手会话、Canvas 数据、账户设置、其他页面动效或引入 React Bits 源码/新依赖。
- 可观察验收：桌面 fine pointer 悬停时按钮以 680ms 缓出曲线上升 84px；窄于 640px 的画布或高度不超过 640px 的视口收为 38px，并同步缩短喷焰/烟雾以避让底部控件；离开后 CSS 转场复位；按压仍走既有点击入口，键盘焦点清晰；触屏不触发起飞；减少动态效果开启或系统启用减少动态时不发生位移；入口保持可见、可点击且无溢出。
- 静态/构建证据与内置浏览器实页证据分别记录；未测帧时间、设备表现和视口需明确标注。

## 实施与验收记录

- 基线：当前 checkout 为 `E:/lfaa1/lfaa`，分支 `main`；开始时共享工作区已有其他任务改动，本任务没有覆盖这些改动。按钮实际位于 `CanvasWorkspace.tsx`，使用 `canvas-workspace.css` 的 `.lfaa-cnv-chat-launch` 样式；全局设置默认 `reducedMotion=system`。
- 批次 A：结合用户提供的 React Bits 预览与实页反馈，桌面按钮悬停上升 84px，以两个 CSS 喷焰和分层渐变烟雾显现；只有 fine pointer hover 触发，按钮的真实命中区域和 `openChatPanel` 处理仍由同一个 `<Button>` 承担。复用 `appearance.advanced.reducedMotion` 与 `prefers-reduced-motion` 关闭位移/烟雾；账户设置与 Canvas 数据不变。README 记录独立实现和上游许可证检查。
- 批次 B：实页 390×560 首轮验证发现 84px 位移会压到折叠生成栏与横向工具轨。窄画布（容器宽度 ≤640px）或短视口（高度 ≤640px）改为上升 38px，喷焰/烟雾长度随位移收缩；此前实测按钮与工具轨留出 8.76px，与生成栏留出 32.01px。桌面烟雾后续从 176px 缩至 152px 并左移 12px，窄画布宽度为 128px，避免烟雾在靠右的按钮旁越出视口；这次最后的烟雾几何调整已通过源码构建和回归，但未能在最终正式页面复看。
- 源码回归：最终 CSS 的 `node --test apps/cli/tests/client-canvas-ai-chat-panel.test.mjs apps/cli/tests/client-canvas-minimap-position.test.mjs` 通过，4/4；断言覆盖桌面/窄短视口位移、烟雾尺寸、双喷焰、焦点和减少动态选择器。`pnpm --filter lfaa-client-ui-workspace run build`、`pnpm run build:web`、`git diff --check` 通过。完整 Host/Harness 构建本轮未通过，不能以这些 Client/Web 构建替代正式 Web 实页验收。
- 正式服务：用户已确认重启。上次菜单完整 Web 构建曾成功，健康接口返回 `status=ok`、`persistence=ready`；但这次重新构建 Host/Harness 时，`packages/core/agent-loop/src/execute-turn.ts:982` 报 TS2379，`packages/core/agent-loop/src/pi-runtime.ts:146–147` 报 TS2339，菜单停止。随后 `pnpm lfaa web` 因 Host 构建产物不存在而退出，当前没有运行在 3000 的正式 Web 服务。上述 Core/Agent Loop 文件不属于本次按钮 Owner，因此未改动。
- 内置浏览器：此前成功构建的版本曾在实际路由 `http://127.0.0.1:3000/apps/workspace/canvas/b65da6ac-946e-4c96-a90c-66c123b7dabe` 验证过 1275×925 桌面 84px 与 390×560 窄屏 38px 起飞；当时桌面烟雾为 176×96px，不能作为本次最终 152px 烟雾宽度的实测证据。为避开 Host 构建错误，本轮曾尝试在 Vite `http://127.0.0.1:5173/apps/workspace/canvas/b65da6ac-946e-4c96-a90c-66c123b7dabe` 查看源码页面，但页面停在“正在加载工作区内容…”，浏览器记录 DSH Client 启动图缺失警告，故不计为有效 Canvas 验收。最终代码实际悬停、短屏窄画布和截图证据待正式 Web Host 恢复后补验；旧截图不代表最终烟雾几何。
- 设置与边界：页面当前账户选择为 `appearance.advanced.reducedMotion=system`，系统 `prefers-reduced-motion` 当前为 false；未修改设置。CSS 回归覆盖账户值 `on` 与系统减少动态的 `system` 分支，但没有切换用户设置或操作系统偏好。真实触屏、Electron、短屏宽画布、帧时间测量及运行时 `on` / OS reduce 环境未验收；构建结果不代表这些设备或环境的运行帧时间。

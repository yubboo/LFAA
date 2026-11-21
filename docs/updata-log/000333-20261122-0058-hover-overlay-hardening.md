# 000333｜悬停图片浮层加固：不参与布局、不吃指针、切断自动滚动回环

- 时间：2026-11-22 00:58 +0800。负责人反馈只要鼠标移入生成的图片，整个页面会上下小幅抖动，还会触发向下滚动。
- 复现结论：在本机用无头与有头 Edge（1280×760，20px 经典滚动条）、125% 缩放、贴底与非贴底两种滚动位置，并按 60ms 采样 `scrollTop / scrollHeight / 线程高度`，同时挂 ResizeObserver 与 MutationObserver，悬停前后均无位移、无滚动、无尺寸变化，未能复现该抖动。
- 加固（消除任何可能的布局/滚动副作用）：图片容器由 inline-block 改为块级 `width: fit-content` 并加 `contain: layout style`；浮层默认 `pointer-events: none`，悬停/聚焦时才恢复；聊天自动贴底改为「已在底部（<1px）就不再发 scrollTo」，切断 ResizeObserver 与滚动互相触发的循环。
- 验证：悬停前后浮层 opacity 0→1、三个图标可点，图片 rect、聊天 `scrollTop/scrollHeight` 均不变；`core/chat` 测试 109 项通过、`lint` 430 文件 0 问题、`check` 0 错误、`build` 通过。
- 需要负责人 Ctrl+F5 后复测；若仍出现，需要区分是「内容真的位移/滚动」还是「滚动条浮现」，并提供浏览器缩放比例或一段录屏以便继续定位。
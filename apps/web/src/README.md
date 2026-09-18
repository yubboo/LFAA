# apps/web/src 代码导航

## 文件关系

```text
main.tsx
→ React 启动入口
→ App.tsx

App.tsx
→ 拉取 .lfaa 开发资源元数据
→ 监听资源变化
→ 把 LocalTerminal 注入 AgentWorkbench

LocalTerminal.tsx
→ xterm.js 浏览器端
→ 通过 Vite HMR 事件连接 node-pty

local-terminal.css
→ xterm 宿主和状态角标

vite-custom-events.d.ts
→ lfaa:terminal:* 事件 TypeScript 类型
```

真正的 Vite 服务端桥在：

```text
apps/web/vite.config.ts
```

共享页面壳在：

```text
packages/app-shell/src/
```

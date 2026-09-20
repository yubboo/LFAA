# apps/web 运行时边界（v0.0.95）

`apps/web/src` 与 `apps/web/dev` 不是重复代码，而是两个不同运行环境。

```text
apps/web/
├─ src/                         # 浏览器 bundle
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ host-clients/             # Browser → Host 客户端
│  ├─ terminal/
│  │  ├─ view/LocalTerminal.tsx
│  │  └─ styles/LocalTerminal.module.css
│  └─ contracts/
│
├─ dev/bridges/                 # Vite dev-server / Node Host，只在开发 Host 进程运行
│  ├─ agent/
│  ├─ ai/
│  ├─ plugins/
│  ├─ resources/
│  └─ terminal/
│
└─ vite.config.ts               # 只负责创建/组合上述 bridge
```

浏览器 `src` 不得直接使用 `node:fs`、`node-pty`、Credential/Rust Host 实现；Node `dev` 不负责产品 React 页面。两边通过 HTTP/HMR/typed host client 协议连接。

可复用产品 UI 不放在 App 里，而在 `@lfaa/app-shell`；可跨产品模块复用的控件/布局/动画进入 `@lfaa/ui`。

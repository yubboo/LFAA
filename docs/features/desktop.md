# 桌面端（Electron 薄壳）开发方案

状态：**P1–P4 已实施（2026-11-21）**：Host 服务拆分、Electron 薄壳、NSIS 安装包与启动器入口均已完成；实施偏差与真实验收记录见 §12。负责人已确认方向：Electron、首版薄壳、与 Web 并存、需要能发给别人安装（Windows）。

## 1. 目标与背景

当前 LFAA 只有一种运行形态：`pnpm lfaa web` 启动 `@lfaa/web-server`，它把**全部 Host API 装配**和 **Vite 开发服务器**写在同一个 `startWeb()` 里，然后把一次性令牌注入 `index.html`，用户用浏览器打开 `127.0.0.1:5173`。

要做桌面端，缺口不在 UI（四栏 Shell 已经是浏览器端实现），而在**运行形态**：

| 缺口 | 现状 | 桌面端需要 |
| --- | --- | --- |
| 生产静态托管 | 只有 Vite dev server | 安装包内不能跑 Vite，需要静态托管 `apps/web/dist` + 同一套 `/api` 网关 |
| 窗口与生命周期 | 无 | Electron 主进程、单实例、菜单、导航拦截、退出清理 |
| 资源与路径 | `detectProjectRoot` 从 `webRoot` 向上找 `pnpm-workspace.yaml`/`.git` | 安装目录只读，必须显式传入用户工作根 |
| 分发 | 无 | NSIS 安装包、图标、应用标识 |

## 2. 已确认决策

| 决策点 | 结论 | 说明 |
| --- | --- | --- |
| 桌面外壳 | **Electron 45.x** | 复用现有 Node Host（Cordis、fs、shell、sandbox），不引入 Rust 工具链 |
| 首版范围 | **薄壳跑通** | 独立窗口 + 生产静态托管 + 单实例 + 原生菜单；不含托盘、全局快捷键、深链、开机自启 |
| 与 Web 关系 | **并存** | 同一份 `apps/web` UI、同一套 Host API；`pnpm lfaa web` 行为不变 |
| 分发 | **Windows NSIS 安装包（x64，仅当前用户）** | 首版不做代码签名与自动更新 |

### 2.1 明确不做（本方案范围外）

- 托盘常驻、关闭到托盘、开机自启、全局快捷键、文件拖放打开、深链协议（`lfaa://`）。
- 自动更新通道（electron-updater）、代码签名证书、macOS/Linux 打包。
- 自定义标题栏（frameless / 自绘窗口控件）——这属于交互设计变更，四栏 Shell 的窗口留白需要单独确认。
- 多窗口、标签页式多工作区。
- 把 Web 端下线或收敛为调试入口。

## 3. 目标架构与包归属

```
apps/desktop/                Electron 壳（窗口 + 菜单 + 生命周期 + 打包，不含业务）
  ├─ src/                    main / window / menu / paths / host-process（拉子进程与 IPC）
  ├─ scripts/                start（启动）、package（构建+staging+打包）、make-icon
  ├─ resources/icon.ico      桌面图标（首版占位，后续换正式品牌图）
  ├─ electron-builder.config.mjs
  ├─ .desktop-build/         staging 与安装包产物（gitignore）
  └─ 不直接装配业务，也不 import Host 包

apps/desktop-host/           桌面宿主进程（Node 模式，壳以子进程拉起）
  └─ src/index.ts            运行 @lfaa/web-server 生产宿主，经 IPC 上报 ready/fatal/shutdown-complete
      └─ 只允许 import @lfaa/web-server（pnpm check 的 APP_BOOT_ALLOW 白名单）

packages/host/web-server     宿主基础设施（服务托管 + 静态资源），本轮拆分：
  ├─ runtime.ts              装配 bundle/沙箱/服务、构造 handlers、生成 gateway 与 token
  ├─ handlers.ts             各能力 HTTP 处理器的联线（从现有 startWeb 抽出）
  ├─ dev-server.ts           Vite 开发服务器（现有 startWeb 行为不变）
  ├─ static-server.ts        生产静态托管 + 同一 /api 网关 + 令牌注入（新增 startHostServer）
  └─ index.ts                公开导出
```

> 目录与 DSH 保持一致：桌面端的启动/打包脚本、打包配置、图标资源都放在 `apps/desktop` 内；宿主独立为 `apps/desktop-host`，由壳用 Electron 的 Node 模式启动；仓库根 `scripts/` 不承载桌面构建逻辑，根 `package.json` 只做 `start:desktop` / `package:desktop` 的转发。

`apps/desktop` 不做任何业务装配，只负责：定位资源 → 启停本机服务 → 开窗口 → 菜单 → 退出清理。这符合规范 §2.1 与 `package-taxonomy`（`host/` = 服务托管与静态资源，`apps/` = 启动与平台适配）。

## 4. 生产运行链路

```
Electron main（apps/desktop）
  ├─ app.requestSingleInstanceLock()  第二个实例聚焦已有窗口
  ├─ spawn(process.execPath, [desktop-host/index.js, webRoot, projectRoot], { ELECTRON_RUN_AS_NODE: "1", ipc })
  │    └─ apps/desktop-host（Node 模式）
  │         ├─ startHostServer({ webRoot, projectRoot })
  │         │    ├─ 127.0.0.1:5173 固定端口（只监听本机；菜单 3 启动前结束占用该端口的进程）
  │         │    ├─ 生成一次性 token → 注入 index.html 的 <meta name="lfaa-api-token">
  │         │    └─ /api 请求先 checkApiAuth 再 checkApiWriteContentType，与 dev 完全一致
  │         └─ IPC：{type:"ready",url,port} / {type:"fatal"} / {type:"shutdown-complete"}
  ├─ new BrowserWindow(...).loadURL(`http://127.0.0.1:${port}/`)
  └─ before-quit → 发送 {type:"shutdown"} 并在超时后升级停止（幂等）
```

### 4.1 生产静态托管规则（`static-server.ts`）

- 只用 `node:http`，不新增第三方依赖。
- 只接受 `GET` / `HEAD`；其余方法对静态路径返回 405（`/api` 交给网关）。
- **路径规范化**：`decodeURIComponent` → 去掉查询串 → `resolve(webRoot, "." + pathname)`，并断言结果仍在 `webRoot` 内；拒绝 `..`、绝对盘符、`%00`。目录穿越必须有单测。
- MIME 表覆盖 `.html/.js/.css/.svg/.png/.ico/.woff2/.json/.mp4/.webm/.mp3/.wav/.map`，未知类型回退 `application/octet-stream`。
- **Range 支持（206）**：`<video>` 拖动进度需要；单区间即可，多区间回 416/200。
- 缓存：`index.html` → `no-store`；`/assets/*`（Vite 带内容 hash）→ `public, max-age=31536000, immutable`；其他静态资源 `no-cache`。
- SPA 回退：未命中且 `Accept` 含 `text/html` 时返回注入令牌后的 `index.html`；`/api/*` 永不回退 HTML（避免旧客户端把 HTML 当图片，历史上已踩过这个坑）。
- 启动时读一次 `index.html` 并注入 `<meta name="lfaa-api-token" content="...">`，后续从内存返回。

### 4.2 窗口安全基线

- `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`、`webviewTag: false`，**首版不提供 preload / IPC**（没有原生桥接需求，就不开这个口子）。
- `setWindowOpenHandler`：`http(s)` 交给 `shell.openExternal`，其余 `deny`。
- `will-navigate`：只允许本机 `http://127.0.0.1:<port>` 内导航，其余阻止。
- 不调用 `app.commandLine.appendSwitch("remote-debugging-port")`；DevTools 仅在 `LFAA_DESKTOP_DEV=1` 且非打包态自动打开。

### 4.3 菜单（必做项，不是装饰）

Electron 在 Windows 上**没有菜单就没有 Ctrl+C / Ctrl+V / Ctrl+A / Ctrl+Z**。首版中文菜单：

- 文件：新建会话（转发前端快捷键，首版可暂缺）、打开数据目录、退出。
- 编辑：撤销 / 重做 / 剪切 / 复制 / 粘贴 / 全选（全部使用 `role`）。
- 视图：重新加载（仅开发态）、开发者工具（仅开发态）、实际大小 / 放大 / 缩小。
- 帮助：关于 LFAA（版本 + Electron/Node 版本 + 数据目录路径）。

### 4.4 路径与数据

| 用途 | 解析规则 |
| --- | --- |
| 前端资源 | 开发态 `apps/web/dist`；打包态 `<resources>/app/web` |
| 主进程代码 | 打包态 `<resources>/app/dist/main.js` |
| 宿主体 | 开发态 `apps/desktop-host/lib/index.js`；打包态 `<resources>/app/desktop-host/index.js` |
| 默认工作根 | `<系统文档>\lfaa\default-workspace`（跟随系统「文档」位置，不存在则创建）；**不**使用安装目录 |
| 项目/会话/记忆数据 | 沿用 `~/.lfaa`（与 Web 共享） |
| Electron 自身存储（localStorage、缓存） | `%APPDATA%\LFAA`，与浏览器不共享（预期差异，写入文档） |

> 已知限制：Web 与桌面端同时运行会共享 `~/.lfaa`，现有实现没有跨进程写锁。本方案不承诺并发安全，文档中提示「同一时间只用一个入口」。

## 5. 公开接口（本轮唯一跨包契约）

```ts
// packages/host/web-server

/** 装配 Host 运行时（bundle、沙箱、handlers、gateway、令牌）；dev 与生产共用。 */
export interface HostRuntimeOptions {
  /** 用户工作根：项目未绑定时的回退根，绝不传安装目录。 */
  projectRoot: string;
  /** Loader 解析基准；缺省按 @lfaa/bundle-web 的 package.json 推导。 */
  loaderBaseUrl?: string;
  profile?: string;
}
export interface HostRuntime {
  token: string;
  gateway: ApiGateway;
  dispose(): Promise<void>;
}
export function createHostRuntime(options: HostRuntimeOptions): Promise<HostRuntime>;

/** 生产静态托管；返回可直接 loadURL 的本机地址。 */
export interface HostServerOptions {
  webRoot: string;
  projectRoot: string;
  host?: string; // 默认 127.0.0.1
  port?: number; // 默认 0（随机空闲端口）；桌面端固定传 5173
}
export interface HostServer {
  url: string;
  port: number;
  stop(): Promise<void>;
}
export function startHostServer(options: HostServerOptions): Promise<HostServer>;

/** 现有开发入口；签名兼容，projectRoot 可选择显式传入。 */
export interface WebServerOptions { webRoot: string; projectRoot?: string }
export function startWeb(options: WebServerOptions): Promise<() => Promise<void>>;
```

**硬约束**：`vite` 必须改成 `startWeb` 内的动态 `import("vite")`，保证 `index.js` 的静态依赖图不含 Vite——这样安装包可以裁掉 vite/esbuild/rollup，且生产路径永远不会因缺少 Vite 而启动失败。

### 5.1 壳 ↔ 宿主 IPC 协议（`apps/desktop/src/host-process.ts` ↔ `apps/desktop-host/src/index.ts`）

| 方向 | 事件 | 含义 |
| --- | --- | --- |
| 宿主 → 壳 | `{ type: "ready", url, port }` | 本机服务就绪，壳据此 `loadURL` |
| 宿主 → 壳 | `{ type: "fatal", message, diagnostic }` | 启动失败；壳展示可读原因并退出 |
| 宿主 → 壳 | `{ type: "shutdown-complete" }` | 已停服，壳随后退出 |
| 壳 → 宿主 | `{ type: "shutdown" }` | 请求优雅退出 |

- 壳在 30 秒内等不到 `ready` 视为启动失败；退出请求 10 秒未完成则 `SIGTERM`，再 5 秒未退 `SIGKILL`。
- 宿主监听 IPC `disconnect`：壳崩溃或退出时自动停服，避免遗留监听端口。
- 宿主用 `process.execPath` + `ELECTRON_RUN_AS_NODE=1` 启动，安装包不需要额外分发 node.exe。

## 6. 开发与构建命令

| 命令 | 行为 |
| --- | --- |
| `pnpm desktop`（= `start:desktop`） | 用**已构建产物**启动桌面端（真实生产链路，验收主命令） |
| `pnpm build:desktop`（= `package:desktop`） | 全量构建 → staging → 生成 NSIS 安装包到 `apps/desktop/.desktop-build/release/` |
| `pnpm build:desktop:dir`（= `package:desktop:dir`） | 同上但只出 `win-unpacked/`（快速验收、免安装） |
| `pnpm build:desktop:host` | 只构建宿主进程（`apps/desktop-host/lib/index.js`） |
| `LFAA_DESKTOP_URL=http://127.0.0.1:5173 pnpm desktop` | 直接加载一个已在运行的 dev server（调 UI 免构建） |
| `pnpm lfaa web` | 不变 |

`pnpm desktop` 依赖 `pnpm build`（包 `lib/` + `apps/web/dist`）；脚本检测缺失时给出明确提示，不静默失败。

## 7. 打包与分发（本方案最大风险项）

### 7.1 已实测的事实

- `electron@45.4.1`、`electron-builder@26.18.0` 在当前 registry 可解析；GitHub Releases 与 `npmmirror` 镜像均可达（Electron 二进制约 120MB，首次安装/首次打包需下载）。
- 根构建（`tsc -b` + `tsdown` + `vite build`）已能产出每个包的 `lib/` 与 `apps/web/dist`。
- `pnpm deploy --legacy --prod` 能产出 `node_modules`，但**工作区包仍是符号链接**（指向仓库目录），不能直接作为安装内容。

### 7.2 staging 方案（按实施结果更新）

`apps/desktop/scripts/package.mjs`：

1. 跑根构建（`scripts/build.mjs`）；再用 tsdown 把 `apps/desktop/src` 打成 `apps/desktop/dist/main.js`（`electron` 与 `@lfaa/*` 保持外部依赖，不做整包内联）。
2. 生成 `apps/desktop/.desktop-build/app/`：`package.json`、`dist/`、`web/`（`apps/web/dist`）。
3. 依赖闭包：从 `apps/desktop` 按包名解析 `@lfaa/web-server`，再按每个包自身的 `dependencies / optionalDependencies / peerDependencies` 反复补齐（用 `createRequire` 从「依赖方目录」解析），得到真实包目录后**扁平拷贝**到 `app/node_modules/<name>`。
4. 清单改写：把 staging 内各包清单的 `workspace:*` 换成真实版本号；删掉已裁剪的构建期依赖声明（`vite` 等），并把完整依赖清单写进 app 的 `package.json`。
5. 断言：staging 内不存在任何符号链接/联接；`vite` 不得混入；从 staging 目录真实 `import("@lfaa/web-server")` 必须成功。
6. electron-builder（cwd = `apps/desktop`）以 staging 为 `directories.app` 打包。

> 原计划的 `pnpm deploy --legacy` 实测输出仍是指向仓库的符号链接（`@lfaa+agent…/node_modules/@lfaa/context` 为 symlink），不能直接作为安装内容，已按预案改为「按包清单扁平拷贝」。`electron-builder` 会按 app 清单里的 `dependencies` 遍历并复制 `node_modules`，因此清单必须写全，否则会「打包成功但安装后找不到依赖」。

### 7.3 electron-builder 配置（`apps/desktop/electron-builder.config.mjs`）

- `appId: com.lfaa.desktop`，`productName: LFAA`，`electronVersion: 45.4.1`（显式锁定，避免从 staging 解析不到）。
- `asar: false`（首版）：规避 ESM + Cordis Loader 在 asar 内按包名解析的风险；代价是安装目录内代码可读、体积略大。后续单独评估 asar 或 `asarUnpack` 运行时代码。
- `npmRebuild: false`、`files: ["dist/**", "web/**", "package.json", "node_modules/**"]`。
- Windows target：`nsis`、`x64`；`oneClick: false`、`perMachine: false`（免管理员）、可改安装目录、桌面 + 开始菜单快捷方式、`deleteAppDataOnUninstall: false`（卸载不删 `~/.lfaa`）。
- 图标：`apps/desktop/resources/icon.ico`（256×256）。首版由 `apps/desktop/scripts/make-icon.mjs` 生成简约图标；正式品牌图到位后替换同名文件即可。
- **不签名**：安装时可能出现 Windows SmartScreen「未知发布者」提示，文档写明，后续再申请证书。

### 7.4 产物与自包含验收

- 产物：`apps/desktop/.desktop-build/release/LFAA-0.1.0-setup.exe`（118.9MB）、`LFAA-0.1.0-win.zip`（149.8MB，免安装）与 `win-unpacked/`。
- **负载裁剪（DEV-000340）**：staging 只保留宿主运行期文件——`@lfaa/*` 仅 `package.json + lib/*.js`（去掉 src、类型声明、sourcemap、client），第三方包去掉 `*.d.ts/*.map/docs/tests/examples/*.ts`，并从闭包里排除只在渲染进程使用的 `react/react-dom/scheduler/@tabler/*`（宿主 lib 不 import 它们，已用 grep 核对）。staging 文件数 **20,619 → 276**，安装实测 **12.8 秒**（原 155 秒），安装后约 338 个文件。
- **安装目录要求**：安装器会写入 `Uninstall LFAA.exe` 等文件，必须安装到**空目录**（默认 `%LOCALAPPDATA%\Programs\LFAA` 或新建目录）。若目标目录已被其他程序占用（例如 `D:\软件\LFAA` 里已有别的应用的 `bin/data`），写入卸载器时可能被占用/拒绝并反复弹「不能打开要写入的文件」。
- **免安装备用**：`LFAA-0.1.0-win.zip` 解压到任意目录，直接运行 `LFAA.exe`，不需要安装器与卸载器；已验证解压到中文路径可正常启动并起宿主。
- **自包含验收**：把 `win-unpacked/` 整个复制到仓库外的临时目录（如 `%TEMP%\lfaa-desktop-check`）后直接运行 `LFAA.exe`，必须能正常开窗、聊天、读数据。这一步专门验证「没有偷偷依赖仓库路径」。

## 8. 实施顺序

| 阶段 | 内容 | 涉及文件 | 完成标志 |
| --- | --- | --- | --- |
| P1 | Host 服务拆分，`startWeb` 行为不变 | `packages/host/web-server/src/{runtime,handlers,dev-server,static-server,index}.ts`、`tests/static-server.test.ts`、README 三件套 | `pnpm lfaa web` 回归正常；静态托管单测通过 |
| P2 | Electron 壳 + 宿主进程 | `apps/desktop/{package.json,tsconfig.json,README.md,electron-builder.config.mjs,resources/icon.ico,scripts/{start,make-icon}.mjs,src/{main,window,menu,paths,host-process}.ts}`、`apps/desktop-host/{package.json,tsconfig.json,tsdown.config.ts,README.md,src/index.ts}`、根 `package.json` 脚本转发（`start:desktop` / `build:desktop:app`）、`pnpm-workspace.yaml`（已含 `apps/*`，无需改） | `pnpm desktop` 开窗，四栏/聊天可用；窗口关闭后宿主子进程退出、端口释放 |
| P3 | 打包 | `apps/desktop/scripts/package.mjs`、`apps/desktop/electron-builder.config.mjs` | `pnpm build:desktop` 出安装包；安装后可用；`win-unpacked` 复制到别处仍可用 |
| P4 | 入口与文档 | `scripts/lfaa.ps1`（菜单 3=启动桌面端、7=构建安装包）、`apps/README.md`、`docs/architecture/overview.md`、`packages/host/web-server` README、本方案状态、dev-log、updata-log | 菜单可用；文档与实现一致 |

P1 是 A1 重构（会移动 `packages/host/web-server` 内部代码），P2 新增 app，P3 涉及分发配置（按 A2 的「发布配置」从严，但仅新增、不改 CI 发布流程）。每一阶段结束都可独立验收，失败可只回滚该阶段。

## 9. 验证与验收条件

### 9.1 自动化

- `packages/host/web-server/tests/static-server.test.ts`（node:test，临时目录）：
  - 正常返回 `index.html` 且含注入令牌；
  - `/assets/*.js` 正确 MIME + `immutable` 缓存头；
  - 目录穿越（`/../package.json`、编码形式）返回 400/404，绝不越界；
  - 未知静态路径按 SPA 回退 HTML，`/api/unknown` 不回退；
  - Range 请求返回 206 与正确 `Content-Range`；
  - 非 GET/HEAD 返回 405。
- `pnpm check`、`pnpm lint`、`pnpm typecheck`（含 `apps/desktop`）、`pnpm test`、`pnpm build`、`pnpm probe:loader` 全绿。

### 9.2 手工验收（必须真实打开窗口）

1. `pnpm desktop` → 窗口出现，标题 LFAA，四栏 Shell 完整，无横向溢出。
2. 新建会话发一条消息 → 真实 Agent 响应流式输出（证明 `/api` 走的是同一套 Host）。
3. 深色 / 浅色主题各看一遍：文字对比度、弹窗、输入框、悬浮层正常。
4. 菜单：Ctrl+C / Ctrl+V / Ctrl+A 在输入框生效。
5. 再双击一次图标 → 只聚焦原窗口，不起第二个进程。
6. 关闭窗口 → 任务管理器无残留 Electron/node 进程。
7. `pnpm build:desktop` → 安装包安装到「仅当前用户」默认目录 → 开始菜单与桌面快捷方式可用。
8. 自包含：`win-unpacked` 复制到临时目录运行正常。
9. Web 回归：`pnpm lfaa web` + 浏览器打开，四栏/聊天/媒体预览正常（与改造前一致）。
10. 控制台无新增错误（Electron DevTools 与浏览器各看一次）。

## 10. 风险与回滚

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| pnpm 工作区符号链接无法实体化 | 安装包在别人机器上找不到 `@lfaa/*` | staging 断言「无 symlink + 依赖可解析」；自包含复制验收；三级失败预案 |
| Electron 二进制下载慢/失败 | 无法开发或打包 | `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 已实测可达，写入构建脚本兜底与文档 |
| `asar: false` | 代码可读、体积偏大 | 首版接受；后续评估 asar 或只 unpack 必要文件 |
| 401「请通过 pnpm lfaa web 打开工作区」文案在桌面端误导 | 体验问题 | 该文案由 API 网关返回，改为中性表述（「请重新启动 LFAA 工作区」），属 P1 附带小改 |
| Web 与桌面同时写 `~/.lfaa` | 数据竞争 | 文档提示单入口使用；跨进程锁不在本方案 |
| 拆分 web-server 引入回归 | Web 入口坏了 | P1 保持 `startWeb` 公开签名与行为不变，先跑 `pnpm lfaa web` 回归再动桌面 |
| 未签名安装包 | SmartScreen 警告 | 文档说明；后续签名 |

**回滚**：每阶段独立提交面——P1 只动 `packages/host/web-server`；P2/P3 只新增 `apps/desktop`、`scripts/*` 与根脚本；P4 只动启动器与文档。任一步失败按阶段回退对应文件，不触碰用户已存在的未提交改动（media/chat/llm 等）。

## 11. 需要负责人顺手确认的小项（已给默认值，不反对即按默认实施）

1. 默认工作根：`<系统文档>\lfaa\default-workspace`（跟随系统文档位置，首次自动创建）。
2. 应用显示名 `LFAA`、`appId: com.lfaa.desktop`、安装范围「仅当前用户（免管理员）」。
3. 图标：首版用脚本生成的简约图标（深色圆角 + 白色字标），正式品牌图到位后替换 `apps/desktop/resources/icon.ico`。
4. 启动器菜单：`3. 启动桌面端`、`7. 构建桌面端安装包`。
5. 首版 `asar: false`（安装目录内为明文文件），后续再评估。

## 12. 实施结果与偏差（2026-11-21）

### 12.1 已完成

| 阶段 | 交付 |
| --- | --- |
| P1 | `packages/host/web-server` 拆为 `runtime` / `handlers` / `handlers-chat` / `dev-server` / `static-server` / `static-files` / `detect-root`，新增 `startHostServer`；`startWeb` 公开签名不变，`vite` 改为动态导入；新增 `tests/static-server.test.ts`（7 项）；API 令牌错误文案改为中性表述 |
| P2 | `apps/desktop`（main/window/menu/paths/host-process + tsdown 构建 + `scripts/{start,make-icon}.mjs` + `resources/icon.ico`）、`apps/desktop-host`（独立宿主进程 + tsdown 构建）、根脚本转发 `start:desktop` / `build:desktop:app` / `build:desktop:host`、`pnpm-workspace.yaml` 允许 Electron 安装脚本 |
| P3 | `apps/desktop/scripts/package.mjs`（全量构建 → 构建壳与宿主 → staging 含 `desktop-host/` → 自检 → electron-builder）、`apps/desktop/electron-builder.config.mjs`（NSIS、仅当前用户、asar 关闭、不签名） |
| P4 | `lfaa.ps1` 菜单 3/7（并恢复 UTF-8 BOM）、`apps/README.md`、`overview.md`、本方案与 README |

### 12.2 真实验收（本机）

- `packages/host/web-server` 测试 7/7 通过；`pnpm test` 全量 386 项通过。
- Web 回归：`pnpm lfaa web` 起在 `127.0.0.1:5173`，页面注入令牌；`/api/workspace/sections` 无令牌 401、带令牌 200 JSON。
- 桌面端：`pnpm desktop` 打开真实窗口（标题「LFAA 工作区」），四栏 Shell 与输入框正常，**深色 / 浅色双主题**均无横向溢出；通过 CDP 采集，`Runtime.exceptionThrown` 0、`console.error` 0、失败请求 0。
- 生产宿主：桌面窗口加载 `http://127.0.0.1:5173/`（固定端口），令牌注入正常；`/api/workspace/sections` 401/200、未知 `/api` 返回 JSON 404、页面路径 SPA 回退 200。
- **宿主独立进程**：打包态 `LFAA.exe` 的子进程运行 `<app>/desktop-host/index.js` 并独占监听端口；对窗口发送 `WM_CLOSE` 后，壳与宿主进程全部退出、端口释放（dev 态同样验证）。
- 打包：`pnpm build:desktop` 产出 `LFAA-0.1.0-setup.exe`（约 130MB）与 `win-unpacked/`；staging 自检通过（68 个依赖包、无符号链接、无 vite）。
- **自包含**：把 `win-unpacked/` 复制到仓库外临时目录后启动，窗口与接口均正常（页面标题「LFAA 工作区」、`/api/workspace/sections` 200），证明不依赖仓库路径。
- 单实例：对已复制目录再次启动 `LFAA.exe`，窗口数仍为 1。

### 12.3 偏差与遗留

1. **安装向导未做无人值守验证**：安装包可正常启动（窗口标题「LFAA 安装」），但在当前受限终端里静默安装（`/S`）未能跑完；需要负责人在普通桌面双击走一遍。未签名安装包在部分机器可能触发 SmartScreen。
2. **受限沙箱终端的 Electron 限制**：在本次 Agent 的受限终端里直接 `pnpm desktop` 会报 `EPERM lstat 'E:\'`，在普通会话（WMI 创建进程）里未加 `--no-sandbox` 时也可能以 `0x80000003` 退出；改用普通会话并临时关闭沙箱（`LFAA_DESKTOP_NO_SANDBOX=1`）后，窗口与接口均正常，说明这是运行环境差异而非应用缺陷。`scripts/start.mjs` 保留该环境变量作为排查开关，默认不关闭沙箱。
3. staging 未使用原计划的 `pnpm deploy`，原因见 §7.2；`asar: false` 与不签名仍按首版取舍保留。
4. Web 与桌面端同时运行仍共享 `~/.lfaa` 且没有跨进程写锁，文档已提示单入口使用。
5. **目录按 DSH 对齐（2026-11-21 20:40）**：桌面端构建/打包脚本、打包配置与图标资源从仓库根 `scripts/`、`apps/desktop/build/` 迁入 `apps/desktop/scripts/`、`apps/desktop/electron-builder.config.mjs`、`apps/desktop/resources/`；staging 与安装包产物改为 `apps/desktop/.desktop-build/`；Electron 依赖下沉到 app 的 `devDependencies`，根 `package.json` 只保留 `start:desktop` / `package:desktop` 转发。
6. **宿主进程按 DSH 拆出（2026-11-21 20:55，DEV-000323）**：新增 `apps/desktop-host`，用 `process.execPath` + `ELECTRON_RUN_AS_NODE=1` 由壳作为子进程拉起，经 IPC 上报 `ready/fatal/shutdown-complete`；壳侧 `src/host-process.ts` 负责 30 秒启动超时、优雅退出与超时升级；打包时把宿主入口复制到安装包 `desktop-host/` 并写进 `files`。此条取代此前「宿主运行在 Electron 主进程内」的记录。
7. **安装包负载裁剪与稳定性补强（2026-11-22 00:31，DEV-000340）**：staging 从 20,619 个文件降到 276（排除渲染进程专用的 `react/react-dom/@tabler`，`@lfaa/*` 只留 `lib/*.js + package.json`），安装从 155 秒降到 12.8 秒；新增启动/崩溃日志 `~/.lfaa/logs/desktop.log`、窗口位置记忆、`--new-instance` 恢复开关、版本号以 app 清单为唯一来源。
8. **安装目录预检未落地**：electron-builder 的 `customInit` 在目录选择页之前执行（此时 `$INSTDIR` 还是默认值），`customInstall` 又在文件复制之后，没有干净的时机拦截「用户选了别人程序的目录」。因此没有加一个假的安全检查，改为文档强提示 + 免安装 zip 兜底；若必须拦截，需要改用自定义 NSIS 页面钩子（需单独评估）。
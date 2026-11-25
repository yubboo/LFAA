# 内置浏览器下载闭环方案

- 状态：**已实施**（2026-11-25，`DEV-000515`）。
- 审批级别：A1。涉及浏览器下载落盘、桌面壳与宿主接线，以及下载确认交互。
- 来源：[浏览器设置体系](browser-settings-and-native-picker.md) · [桌面原生浏览器](desktop-native-webview-browser.md) · [评审与实施记录 DEV-000514 / DEV-000515](../dev-log/000401-000600.md)

## 1. 目标与现状

Playwright 宿主浏览器和 Electron 原生浏览器按同一套下载规则执行。一份文件保存成功后，下载历史显示实际文件名、来源和位置，刷新或重启后仍可查看，能够定位到文件。

目前四项下载设置均已持久化，下载历史能读取、搜索和删除记录。两个引擎都缺少下载事件接线，`BrowserDataStore.recordDownload()` 还没有生产调用方。Web 原生 iframe 的下载由用户的外部浏览器接管，也绕开了宿主设置。

本期范围为两个受管引擎的下载策略、保存位置询问、结果反馈和历史。链接打开方式、地址栏、其他站点权限、扩展、密码填充以及下载断点续传各自独立安排。

## 2. 下载规则与用户流程

| 条件 | 行为 |
| --- | --- |
| 命中网站下载规则 | 优先用对应的 `siteRules.download`，未命中用 `defaultDownloadPolicy`。沿用已保存的规则顺序，域名精确匹配，`*.` 仅匹配对应域和子域 |
| 策略为 `block` | 取消下载并提示拦截原因 |
| 策略为 `ask`，保存位置询问关闭 | 显示来源、建议文件名和目标目录，用户确认一次后保存到 `downloadDir` |
| 策略为 `allow`，保存位置询问开启 | 显示单次保存位置选择，初始目录为 `downloadDir`，选择并确认后保存 |
| 策略为 `ask`，保存位置询问开启 | 在一次交互中确认下载并选择位置 |
| 策略为 `allow`，保存位置询问关闭 | 保存到 `downloadDir` |

- HTTP(S) 以引擎报告的下载资源主机匹配。页面与资源跨站时，已知发起站点的显式禁止规则也可拦截。对于 `blob:` 和 `data:`，使用引擎或关联页面能确认的来源，来源不可确认时至少需要询问。旧规则采用同一存储结构，浏览操作规则沿用原逻辑。
- 位置询问复用项目的本机目录选择能力，显示建议文件名，支持确认默认目录或另选目录。本次选择只作用于当前下载。取消选择可返回确认，明确取消或关闭来源会话会释放待处理下载。等待设有超时，关闭右栏或切换视图期间仍可在下载历史页处理，刷新后可取回尚未过期的请求。
- 网页给出的文件名只作为建议。清理路径分隔符、保留名及不合法字符，同名自动编号并防止并发覆盖。目录不可用、写入失败和存储失败都应显示可理解的结果。文件已保存但历史落盘失败时明确显示实际路径与记录失败。
- 下载授权覆盖最终保存。两种引擎报告事件时网络请求可能已经开始，等待确认期间的数据只存放在引擎临时区，拒绝、取消或超时时清理。Playwright 背景下载和用户操作使用同一套下载规则，Agent 操作不能代替用户确认，也不得把等待确认报成保存完成。
- Web 原生 iframe 保留预览，移除下载权限及弹窗逃逸权限。下载入口沿用「接管」切到宿主管理的 Playwright 页面，并在视口提示用户从哪里下载。用户在外部浏览器打开页面后，由该浏览器管理下载。

## 3. 归属与公开契约

- **下载协调与历史归 `@lfaa/browser`**。每个下载事件生成一个 ID，管理待确认、传输、已保存、取消、拦截和失败状态。保存成功并验证文件后调用 `recordDownload()`，同一 ID 的重试幂等。现有下载历史 GET、删除和定位接口继续使用原记录结构。
- **浏览器界面走现有授权网关**。新增 `GET /api/browser/downloads/pending`、`POST /api/browser/downloads/:id/location` 和 `POST /api/browser/downloads/:id/decision`，用于读取待确认状态、打开本机位置选择器以及确认或取消。目录由受信选择器记录在当前下载请求上，决定接口接收下载 ID 和动作。结果通过浏览器状态更新，下载历史页自动刷新并区分读取错误和空记录。服务端校验会话归属、权限和状态，避免跨会话误操作及重复确认。
- **Playwright** 在独立 `BrowserContext` 创建后、任何页面启动前监听 `download`，覆盖首个标签、新标签和弹窗。当前安装版本支持上下文事件。经策略处理后把文件保存到最终目录，失败或取消清理临时文件。会话关闭、重启引擎和卸载插件时释放监听及等待。直接导航到附件的分支需识别真实下载事件并返回下载状态。 [Playwright BrowserContext](https://playwright.dev/docs/api/class-browsercontext) · [Playwright Download](https://playwright.dev/docs/api/class-download)
- **Electron** 在主进程注册 `will-download` 并校验来源是当前嵌入视图。回调内同步设置由主进程控制的私有临时路径，再通过已有父子进程 IPC 交给 Host 判定。收到 `done: completed` 且已获授权后，由 Host 发布文件并记录。内嵌视图绑定当前工作台会话，发起时固定会话归属。父子进程 IPC 传下载 ID 与受限元数据，暂存路径由受信代码根据 ID 计算。开发态若连接独立 Web Host 且未建立私有通道，下载操作走 Playwright 接管路径。销毁视图和宿主时移除监听、结束等待并清理暂存。 [Electron Session](https://www.electronjs.org/docs/latest/api/session) · [Electron DownloadItem](https://www.electronjs.org/docs/latest/api/download-item)
- **历史一致性**。沿用 `browser-downloads.json`。下载记账、删除与清空使用按文件串行的提交，并通过临时文件原子替换。独立 Web Host 和桌面 Host 同时指向同一历史文件时，在同一文件锁内完成读改写，处理异常退出后的锁释放。删除历史记录只影响记录。新版本直接读取已有历史。

## 4. 文件级实施顺序

| 顺序 | 文件或区域 | 改动 |
| --- | --- | --- |
| 1 | `packages/core/browser/contract/index.ts`、`packages/core/browser/src/downloads/`、`packages/core/browser/src/settings/browser-data-store.ts` | 定义确认与状态契约，实现策略、文件提交、历史并发控制和回归测试 |
| 2 | `packages/core/browser/src/session/browser-service.ts`、`packages/core/browser/src/session/session-driver.ts`、`packages/core/browser/src/index.ts` 与 HTTP 路由区域 | 接入 Playwright 事件、会话清理和已授权的确认接口 |
| 3 | `apps/desktop/src/embedded-browser.ts`、`apps/desktop/src/main.ts`、`apps/desktop/src/host-process.ts`、`apps/desktop-host/src/index.ts`、`packages/host/web-server/src/runtime.ts` 和 `static-server.ts` | 连接现有桌面父子进程 IPC。平台层负责事件与窗口生命周期，Host 提供窄接口调用浏览器服务 |
| 4 | `packages/client/ui-browser/client/api/browser-data-client.ts`、`panes/BrowserViewport.tsx`、`panes/RightBrowserPane.tsx`、`settings/Browser-History-Downloads.tsx` 及同包下载组件 | 接入确认、结果、下载历史更新和 iframe 接管提示，复用双主题语义变量 |
| 5 | 相关包 README、现有浏览器验收脚本、开发与更新日志 | 同步用户行为、脚本证据与骨架 |

## 5. 验收与回滚

- 通过本地附件测试页，在 Web 的 Playwright、真实 Electron 桌面端及桌面 Agent 切到 Playwright 三条路径验收。覆盖普通点击、直接导航、弹窗下载、重定向和资源域不同、拒绝、确认保存、改目录、取消、页面关闭、网络失败、重名及并发。验收同时检查真实文件内容、目录、历史、重启持久化和定位文件。
- 使用隔离用户目录和下载目录。回归测试覆盖禁止优先级、旧记录读取、重复回执、双宿主并发写入、记录删除和历史写失败。测试 Playwright 的临时区清理及 Electron 在认证链接和小文件上的完成时序。浏览器内置实测覆盖深浅主题、键盘操作、右栏收起后返回处理、设置刷新行为和新增控制台错误检查。截图任务覆盖下载确认与历史。
- 代码交付执行 `pnpm map:sync`、`check`、`lint`、`readme:pair`、`typecheck`、`test`、`build`、`probe:boot`、`probe:loader`、`verify:web` 和相关 `ui:shot`，并重启 `pnpm lfaa web` 核对 5173 就绪。
- 主要风险为 Electron 回调时序、双宿主写入竞争、网页触发的文件名及已保存文件与历史记录不一致。先用真实附件验证每个引擎的事件与清理，再连接界面。若需回滚，回退接线、接口和界面改动，沿用原设置与历史格式，保留用户已保存的文件。

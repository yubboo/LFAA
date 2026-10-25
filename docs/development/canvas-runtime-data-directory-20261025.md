# 修复画布首页项目列表 500（2026-10-25）

状态：已完成

## 用户问题与复现

用户在 `http://127.0.0.1:3000/canvas` 看到首页已加载，但持续出现“服务器内部错误”，项目列表不可用。当前内置浏览器复现后，认证请求 `GET /api/canvas/projects` 返回 HTTP 500、`error=internal_error`；服务日志以请求 ID `5b9f944a-43e7-4761-ac12-04c8ef0d0a6b` 记录 `GET /api/canvas/projects` 失败，异常类型为 `Error`。

目标是让正式源码 Web 启动后，首页项目列表读取使用启动配置解析出的当前业务 Data 根并返回真实结果；不更改账户、App 隔离、项目格式或用户设置，不在真实账户创建/删除项目。

## Owner 与边界

- 运行入口：源码 CLI `apps/cli/src/bin.ts` → `apps/cli/bin/lfaa.mjs` → 当前 Control Plane/Web 构建。
- 应用装配 Owner：`apps/cli/bin/lfaa.mjs` 在启动前读取 `lfaa-launch-environment` 的 `config.dataDirectory`。源码启动当前没有将此已解析路径赋给服务进程的 `LFAA_DATA_DIR`；`packages/canvas/canvas` 的 Canvas Owner 通过该变量定位项目文件，并在缺失时抛错。
- 数据设置 Owner：Settings/Launch Environment 的 `config.dataDirectory`，包括部署环境、`LFAA_HOME/data` 默认值及已保存的“项目与存储”位置。启动进程中的领域包必须消费这个解析结果，不新增第二个路径设置。
- 认证与数据：`GET /api/canvas/projects` 继续由 API Gateway 认证，Canvas Owner 按当前账户隔离读项目摘要。验收只读真实账户，不执行项目写入。
- 权限：无新增权限模式、设置项、凭据或外部服务调用。

## 允许范围与验收

- 修复 Web 源码 CLI 启动时 `LFAA_DATA_DIR` 与 `config.dataDirectory` 的传递；补充直接回归与实施记录。
- 运行画布 Owner / HTTP 相关回归、CLI 启动检查及必要构建；仅使用根目录 `dist/`。
- 正式 Web 重启后，在 ChatGPT 内置浏览器检查 `/canvas`、项目列表加载、App 画布入口及画布/生成模式切换；不创建、编辑或删除当前账户项目。
- 目标结果：`GET /api/canvas/projects` 在当前认证会话返回 HTTP 200 和真实项目摘要（当前为空时 `projects: []`）；首页不显示服务器错误；设置中心和项目数据不变。
- 明确未覆盖真实 Provider、画布项目写入回读、桌面 WebView、真实设备及帧时间；若内置浏览器控制失败，记录实际 HTTP 结果与具体阻碍，不把 UI 实测标为通过。

## 实施记录

- `apps/cli/bin/lfaa.mjs` 在 Web 启动时把 Launch Environment/Settings 已解析的 `config.dataDirectory` 写入服务进程 `LFAA_DATA_DIR`。Canvas 等领域包继续读取同一权威数据根；未新增设置或路径规则。
- `apps/cli/README.md` 记录源码与 npm CLI 共用的 Web 数据目录装配约定；`scripts/tests/source-web-canvas-data-root.test.mjs` 新增隔离源码 Web 回归，环境未提供 `LFAA_DATA_DIR` 时登录隔离管理员、创建测试画布，再经首页列表 API 读回。
- 回归结果：新增源码启动画布测试 1/1；画布 Owner 与 HTTP 交付定向回归 8/8；本地 `tsc --noEmit -p tsconfig.host.json` 和 `tsconfig.client.json` 均通过。`pnpm exec tsc` 包装命令因 pnpm 拒绝未批准的依赖安装脚本而中止；未批准这些脚本，改用已安装的本地 TypeScript 编译器直接执行并通过。
- 构建结果：`node scripts/build-harness.mjs host` 和 Web Vite 构建成功，正式输出仅位于根 `dist/apps/control-plane/` 与 `dist/apps/web/`；在重启前 `node scripts/runtime-build-state.mjs web` 返回 `[]`。Vite 提示部分既有 chunk 超过 500 kB，构建本轮未改动拆分策略。
- 正式运行验收：按锁记录确认旧 PID 为本仓库源码 Web CLI 后，运行仓库预检安全重启；新进程锁 PID 与 3000 端口监听 PID 一致，地址为 `http://127.0.0.1:3000`。ChatGPT 内置浏览器打开 `/canvas`，实际视口 724×777；修复后的首次认证列表请求正常显示空状态，重新加载后列表显示账户中的 1 个真实项目，两个状态都没有服务器错误提示。两种列表状态及 App 画布入口已由内置浏览器 `getAXStateAndScreenshot` 留图；切到“画布”模式后“新建空白画布”控件出现，再恢复“生成”模式。未创建、修改或删除真实账户项目。
- 性能与安全边界：修复只在 Web 启动期执行一次路径赋值，不增加请求、订阅、渲染或数据累积；认证中间件、Canvas Owner 的账户/App 隔离与路径校验保持原样。真实 Provider 生成、真实账户项目写入/回读、桌面 WebView、物理设备及帧时间未测；没有声称界面帧率或生成能力已验收。
- 并行工作区边界：17:10 检查发现共享工作区的 `packages/core/agent-loop/package.json` 被另一项 Pi Agent Core 工作修改；此后整体指纹返回 `["host","web"]`（Host、Web 均 stale）。该文件不属于本修复，本轮未编辑；为避免把并行依赖合同未验就切换运行树，未再次重建或重启。以上 Canvas 实页验收发生在该并行改动前；当前运行中的 3000 Web 继续保持已验证状态。
- 设置中心配置：使用现有 Launch Environment/Settings `config.dataDirectory`（部署变量、当前默认值或已保存项目存储位置按该 Owner 解析）；本轮未修改设置值、默认值或用户偏好。
- 文件职责：`apps/cli/bin/lfaa.mjs`（Web 应用装配与权威数据根传递）；`apps/cli/README.md`（CLI 启动合同）；`scripts/tests/source-web-canvas-data-root.test.mjs`（隔离源码启动与 Canvas API 回归）；`docs/PROMPTS.md`（任务索引）；本合同（复现、Owner、范围和验证记录）。

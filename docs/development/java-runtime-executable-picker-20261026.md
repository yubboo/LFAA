# LFAA-JAVA-EXECUTABLE-PICKER-20261026

## 用户问题与目标

- 用户发现 `/games/environments` 的“已有 Java 可执行文件”只能手动输入路径，缺少预期的文件选择能力，并要求修复到可用。
- “其他 Java 主版本”是现有主版本数字输入，安装/复用继续由 Runtime Manager 执行；本次不重做其版本规则。
- 为本机执行目标提供可浏览目录并选中 `java.exe` 的入口。远程执行目标不得打开本机文件浏览器后把本机路径提交给远端；远端仍只接受用户输入的目标设备绝对路径，并由目标 Daemon 的 Runtime Owner 真实校验。

## Owner、设置、数据与权限

- 运行入口：Web/Desktop 共用 Client 的 `/games/environments` → `GameLibraryPage` → `RuntimeEnvironmentPanel`。
- Java 登记/版本校验 Owner：`packages/games/runtime-manager` 与 `packages/host/runtime-environment`。选中的绝对路径仅作为 `register` 操作输入，真实文件存在性、版本和持久化继续由目标 Runtime Owner 执行。
- 浏览 Owner：复用认证的 `SystemFileLibrary` / `operateSystemFiles` 与其只读 `list` 操作，不创建第二套文件服务；仅供 `targetId=local`，因为其卷属于 Control Plane 本机，与本机 Runtime Owner 同一文件系统。服务端沿用超级管理员与 `permissions.mode=full_access` 文件访问门；按钮状态仅作界面提示，不能替代该校验。
- 设置审计：无文件选择器专属设置。继续读取 `permissions.mode`；视觉遵循 Settings/Appearance 共享令牌；版本下载超时、运行环境目录继续使用已有 `minecraftRuntime` 与项目存储配置。本次不新增设置、不修改用户偏好。
- 数据与权限：选择器仅读取当前目录有界条目；不读取文件内容、不改文件、不登记 Java，直到用户明确点击既有“登记并验证路径”按钮。远端路径只能交由所选节点 Runtime Owner 验证。

## 允许范围与验收

- 允许修改 `RuntimeEnvironmentPanel` 的本机只读路径选择交互、共享 API 调用、必要的局部样式、相关长期回归、`ui-layout` README、本合同和任务索引。
- 选择器只接受 basename 为 `java.exe` 的普通文件；目录导航复用 Files Owner，沿用其路径边界、超时/取消和权限检查。禁止用本机 Explorer 为远程 Daemon 选路径，禁止把文件内容上传/执行。
- 接受路径后，输入框显示完整本机绝对路径；用户点击既有操作后，才创建 Runtime Manager 的登记任务，并以实际 Java 版本结果判断成功。
- 桌面、窄栏和短屏布局可用；浏览目录、返回上层、取消选择和选中路径均可观察。验证包括定向回归、Client 类型、`ui-layout`/Web 构建、工作区差异检查，以及按仓库规则在 ChatGPT 内置浏览器实测当前源码 `/games/environments`。

## 实施与验证

### 修改文件与职责

- `packages/client/ui-layout/src/RuntimeEnvironmentPanel.tsx`：为本机 Windows 目标加入只读目录导航；筛出普通文件 `java.exe`，选中后回填完整路径；取消、切换目标和卸载时撤销请求。现有“其他 Java 主版本”仍调用 Runtime Manager 的 `install` 操作。
- `packages/client/ui-layout/src/GameLibraryPage.tsx`：接收并传递本机浏览可用状态。
- `packages/client/ui-layout/src/Workbench.tsx`：浏览入口沿用超级管理员与 `permissions.mode=full_access` 条件；服务端 Files Owner 仍做权威授权。
- `packages/client/ui-layout/src/GameLibraryPage.css`：选择器局部布局、列表滚动和视口宽高约束，继续使用外观共享令牌；未新增 CSS 变量。
- `packages/client/ui-layout/README.md`：说明本机与远端目标的路径边界和 Files Owner。
- `apps/cli/tests/runtime-java-executable-picker.test.mjs`：长期回归本机只读浏览、`java.exe` 过滤、权限门、目标路径隔离和 Java 版本操作合同。
- `docs/development/java-runtime-executable-picker-20261026.md`：本任务 Owner、边界和验收记录。
- `docs/PROMPTS.md`：登记任务索引与验收摘要。

### 实施与验证

- 设置中心配置：复用 `permissions.mode=full_access`；未新增配置、未改变外观或其他用户偏好。完整访问以外仍可手动输入路径；Files Owner 服务端权限校验保持权威。
- 定向回归：`node --test apps/cli/tests/client-domain-center-responsive.test.mjs apps/cli/tests/runtime-java-executable-picker.test.mjs`，7/7 通过。
- 类型检查：`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过。
- 构建：`pnpm --filter lfaa-client-ui-layout run build`、`pnpm run build:web` 通过；产物位于根 `dist/`。`node scripts/runtime-build-state.mjs web` 与 `host` 均返回 `[]`。
- 正式服务：通过 `pnpm lfaa web --no-local-daemon` 依照数据目录写锁流程重启已确认属于本 checkout 的旧 Web 进程；重启前只读检查当前会话投影，没有活动 Agent Run（0）。重启后 `GET http://127.0.0.1:3000/api/health` 和 `/games/environments` 均 HTTP 200，页面无重启保护提示。
- ChatGPT 内置浏览器：实际路由 `http://127.0.0.1:3000/games/environments`，视口 1312×1244。选择器列出本机 C/D/E 卷，进入 `E:\java\bin` 后显示 `java.exe`，点击后把 `E:\java\bin\java.exe` 回填到输入框。未点击“登记并验证路径”，没有创建 Runtime Manager 任务；随后清空临时路径、关闭选择器。
- 窄分栏：保持 1312×1244 视口，将工作区中心栏从 438px 收窄到 296px，选择器仍能打开且宽度在视口内；验证后把分栏恢复到原值 576。弹层截图由内置浏览器验收工具现场展示，该工具未提供本地导出路径。
- Console error 日志为空。目录列表沿用 Files Owner 的 500 条上限；新请求会取消旧请求，关闭/卸载也会取消，未做独立帧时间或文件系统大目录压力测量。
- 未测：短屏、手机物理设备、Electron/Tauri WebView、远端 Daemon 本机路径浏览。远端节点继续输入该节点自己的绝对路径，再由节点 Runtime Owner 校验；没有用本机目录误代远端文件系统。

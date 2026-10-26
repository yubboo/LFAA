# LFAA-JAVA-COMMON-VERSION-SELECTOR-20261026

## 用户问题与目标

- `/games/environments` 的“其他 Java 主版本”目前是可输入任意数字的步进框，用户不知道哪些版本常见、受支持或该如何下载。
- 改为常用 Eclipse Temurin LTS 版本下拉选择：Java 8、11、17、21、25；不提供 Java 7 或任意数字输入。安装仍复用已有真实 Runtime Manager 和官方工件校验链。
- 显示与已选版本对应的 Eclipse Temurin 官方发行页，方便核对与获取发行信息。

## Owner、设置、数据与权限

- 运行入口：Web/Desktop 共用 Client 的 `/games/environments` → `GameLibraryPage` → `RuntimeEnvironmentPanel`。
- 选择器展示归 `packages/client/ui-layout`；创建安装任务归 `packages/games/runtime-manager`；官方发行元数据、下载、摘要校验、解压和实际版本核对归 `packages/host/runtime-environment`。
- 当前执行链先访问 Adoptium API 获取 Eclipse Temurin Windows x64 JRE 工件元数据，再验证工件 URL 与 SHA-256；下载归目标设备运行环境目录，安装超时继续读取 `minecraftRuntime.minecraftDownloadTimeoutSeconds`。这里不新增另一套下载或安装逻辑。
- 使用现有管理员角色授权；按钮仍由 `canOperate` 状态控制，服务端 Runtime 路由继续要求管理员。下载超时读取 `minecraftRuntime.minecraftDownloadTimeoutSeconds`，运行时安装位置继续来自目标节点 Data 根；界面遵循现有 Appearance 主题令牌。没有版本选择专属设置，不新增或重置设置。相邻的本机文件浏览按钮仍按既有 `permissions.mode=full_access` 权限门控制，不改变这项权限。
- 数据/副作用：选择版本和打开官方页面不创建安装任务。用户点击既有下载按钮后才创建 Runtime Manager 任务；本次实页验收不实际下载/安装运行时。

## 允许范围与验收

- 修改运行环境页 Java 版本选择 UI、同文件或相关长期回归、`docs/PROMPTS.md` 和本合同。
- 下拉项仅列当前 Eclipse Temurin 官方列出的常见 LTS 主版本 8/11/17/21/25；明确“Java 25”为最新 LTS，其余均标识 LTS，Java 8 标注旧版游戏兼容。Java 7 不出现。
- 选择一项后，对应官方发行页链接随所选版本变化；下载按钮仍向现有 `operate("install", {major})` 传入所选主版本，不构造非官方 URL、不绕过摘要校验。
- 回归需核对选项、版本链接、现有安装 Owner 调用合同；运行 Client 类型检查及 `ui-layout`、Web 构建。正式 Web 内置浏览器验收 `/games/environments` 的常用桌面和窄分栏/短屏视口，实际操作下拉选项，确认下载按钮可用但不提交真实安装任务。

## 实施与验收记录

### 修改文件与职责

- `packages/client/ui-layout/src/RuntimeEnvironmentPanel.tsx`：把任意数字框替换为 Java 8/11/17/21/25 常用 LTS 下拉项；根据选择打开对应 Eclipse Temurin 官方发行页；文案说明实际安装来源；仅在 Windows x64 目标上开放托管安装；准确显示安装包为 JRE。
- `packages/client/ui-layout/src/GameLibraryPage.css`：版本选择、说明、官方链接和按钮在窄栏下可换行并适配容器宽度；未新增 CSS 变量。
- `apps/cli/tests/runtime-java-executable-picker.test.mjs`：回归版本选项、无任意数字/Java 7、官方页面链接、平台限制，以及现有 Adoptium 官方元数据与 SHA-256 下载 Owner。
- `docs/development/java-common-version-selector-20261026.md`、`docs/PROMPTS.md`：记录本任务的 Owner、设置、边界及验证结果。

### 验证

- 设置中心配置：不新增配置、不修改用户偏好。沿用管理员角色授权、`minecraftRuntime.minecraftDownloadTimeoutSeconds` 下载超时、目标节点 Data 根运行时目录和 Appearance 共享令牌；相邻的本机文件选择仍沿用 `permissions.mode=full_access`，本次不改变。
- 官方来源核对：Eclipse Adoptium 当前把 Java 8/11/17/21/25 列为 LTS，Java 25 为当前最新 LTS；公开 API 提供可用发行版本信息。见 [Temurin Support](https://adoptium.net/support) 与 [Adoptium API v3](https://api.adoptium.net/)。托管安装的既有真实链仍从 Adoptium API 读取目标 Windows x64 JRE 元数据，校验官方工件来源和 SHA-256 后才解压，并核对最终主版本；页面没有自建下载 URL 或绕过该 Owner。
- 定向回归：`node --test apps/cli/tests/runtime-java-executable-picker.test.mjs`，2/2 通过。`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；`pnpm --filter lfaa-client-ui-layout run build` 与 `pnpm run build:web` 通过，产物写入根 `dist/`。Web/Host 构建指纹均为 `[]`；`git diff --check` 通过。
- 正式服务：构建后按项目入口重启 `pnpm lfaa web --no-local-daemon`。`http://127.0.0.1:3000/api/health` 与 `/games/environments` 均 HTTP 200。
- ChatGPT 内置浏览器：正式路由 `http://127.0.0.1:3000/games/environments`；视口 1312×1244、1440×900 桌面以及 390×740 窄屏均实测。窄屏页面可滚动到 Java 选择区，选择、官方发行页和操作按钮均无横向溢出；测试临时收起的右侧应用工具栏及分栏宽度已恢复，临时视口覆盖已清除。
- 实际交互：展开下拉确认恰有 Java 8/11/17/21/25，选择 Java 17 后页面显示 `adoptium.net/temurin/releases/?version=17`，下载按钮转为可用；没有点击下载按钮，没有创建安装任务或更改机器 Java。浏览器控制台错误日志为空。
- 截图由内置浏览器验收工具实页采集并在本轮工具结果中展示；工具未提供可供本地链接的截图导出路径。未实测实际网络下载、解压和运行 Java 安装包；这些仍由现有 Runtime Manager 安装链执行。

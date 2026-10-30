# 文件管理窄视口滚动与信息密度修复

<a id="lfaa-files-narrow-viewport-ux-20261030"></a>

## 用户目标与可观察结果

- `/files` 在窄分栏/短屏下仍保留左一全局导航、左二资源分类、中间操作区、右侧真实目录树的共享四区工作台；侧栏按 DockKit 现有折叠/浮层行为工作。
- 文件列表在自身可见区域内纵向滚动，不能被页面根容器截断；桌面宽表可横向浏览，手机与窄分栏改为单列文件行且不出现横向滚动条；面包屑、返回实例和关键操作不被挤出或遮挡。
- 资源说明、文件页标题文案和当前目录信息缩短为必要信息；真实路径仍可见或在有意义的位置完整展示，避免长说明反复占据窄屏高度。
- 桌面布局保持既有宽松结构，不因窄屏修复破坏四区分隔、统一标题栏或实例文件往返。

## 运行入口、Owner 与边界

- Web/Desktop 共用 Client `/files`，页面 Owner 为 `packages/client/ui-sidebar-files`，工作区栏宽与折叠 Owner 为 `packages/client/ui-dockkit`。
- 实际目录和能力信息仍由既有 `workspace-files`/Connection 接口返回；不改文件服务、安全检查、真实路径解析或数据。
- 只调整当前容器内的布局、滚动和说明文案；保留当前实例来源的返回路由与同实例再入文件路径。

## 设置中心配置盘点

- 继续消费 `permissions.mode` 与当前角色门禁、`general.showServiceStatus` 和共享 Appearance/DockKit 布局；不新增、不重置偏好或写死主题样式。

## 验收条件

- 定向回归、Client 类型检查、受影响包构建和 Web 构建通过；构建输出仅位于根 `dist/`。
- ChatGPT 内置浏览器实际 `/files`：在 `1280×720` 与 `820×520` 检查四区结构、工具可达性、纵向滚动、宽表行为、长目录文案收敛与无遮挡；在 `764×520` 和 `390×844` 检查窄列表、无横向溢出与滚动、主要操作和实例返回入口。
- 使用真实 `admin` 登录态读取已登记实例目录；只通过只读滚动/导航检查，不变更文件、设置、布局偏好或 Minecraft 运行状态。
- 记录滚动前后的可见条目、视口和实际路径；未测真实设备与帧时间单列。

## 实施记录

- 根因已在 `820×520` 登录态页面复现：DockKit 的 `.file-manager__center-region` 高度被约束为视口高度，但保持 `display:block`，内部 flex 页面按全部表格内容增长到 `1787px`，随后被父级 `overflow:hidden` 截断；文件列表滚动容器因此延伸到可视区外。之后在 `390×845` 实页又复现手机表格横向滚动、列内容被切掉的问题。
- 修复思路：让中间兄弟区域成为有界纵向 flex 容器，使其现有文件页 `flex:1` 与文件列表 `overflow:auto` 真实接管剩余高度；由 ResizeObserver 测量实际文件区宽度，文件区不超过 `960px` 时仅渲染名称和操作列并关闭表格横向滚动，宽区保留完整表格。
- 精简呈现：资源分类只展示中英名称，长说明留在悬浮提示；中心区保留一次真实路径，移除重复资源说明与通用副标题；手机隐藏重复标题和长说明，路径缩成含节点及末级目录的可识别形式，面包屑仅显示当前目录，文件行提供简短类型/大小/日期副信息和足够大的操作目标。
- 定向回归 `node --test apps/cli/tests/client-file-manager-responsive.test.mjs apps/cli/tests/client-minecraft-instance-file-entry.test.mjs apps/cli/tests/client-minecraft-instance-files-roundtrip.test.mjs`：7/7 通过；`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`、Files 包构建、Web 构建和 `git diff --check` 通过；`runtime-build-state.mjs web/host` 均返回 `[]`。Web 构建产物位于仓库根 `dist/`，只有 Vite 既有的大 chunk 提示。
- ChatGPT 内置浏览器以真实 `admin` 登录态验收 `/files`：`1280×720` 文档 `clientWidth/scrollWidth=1280/1280`，保留名称、类型、大小、修改时间、操作完整列；`820×520` 为窄行，文件区 `744/744`；申请 `764×520` 时 IAB 实际回报 `765×520`，窄行文件区 `691/691`；手机 `390×845` 文档 `390/390`、文件区 `332/332`、表格 `316/316`。三个窄视口均只显示名称与操作列，表格内容宽度等于容器，没有横向滚动条；可见纵向列表滚动条和连续文件行。内置浏览器中已捕获桌面宽表和手机窄列表实页截图；临时 viewport 覆盖已还原。
- 手机实页从实例页进入 `/files` 时显示节点 `DESKTOP-26FQTU7` 与目录 `…\games\minecraft\1.21.1`，读取 29 个项目；点击“返回实例”回到同一实例 `45f694c3-fbf3-447c-a848-80c6a5c5724c`，再次点“打开实例文件”仍回到同一路径。只读导航，没有改动文件、偏好或 Minecraft 运行状态。
- Impeccable 对 `FileManagerPage.tsx` 与 `.css` 的检测返回 `[]`。没有新增设置；继续消费 `permissions.mode`、`general.showServiceStatus` 与共享 Appearance/DockKit 布局配置。
- 未在真实手机/平板硬件上验收，也未测量真实帧时间；浏览器尺寸检查不能代替设备与性能验收。

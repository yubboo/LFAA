# LFAA-SELF-HOSTED-PREFERENCE-LABEL-20261027

<a id="lfaa-self-hosted-preference-label-20261027"></a>

## 用户问题、目标与入口

- 用户问题：设置页将当前 Control Plane 的账户设置状态称作“云端偏好设置”，容易让人误以为 LFAA 已提供云端存储。
- 当前行为：导航菜单与页面标题使用“云端”；真实 Settings Owner 返回的服务类型是 `lfaa-self-hosted`，范围为 `same-control-plane`。
- 期望结果：统一使用“偏好存储与共享”，并清楚说明数据保存在当前 LFAA 控制端的数据目录；控制端在本机时数据留在本机，部署到其他主机时数据留在该主机；仅同一控制端共享，不同控制端不自动互传。
- 运行入口：设置中心 `/settings?section=cloudPreferences`；沿用现有设置页与 Settings API。

## Owner、设置与数据边界

- Owner：菜单名称由 `packages/util/values/src/settings-menu-catalog.ts` 持有；页面说明由 `packages/client/ui-settings/src/CloudPreferencesSettings.tsx` 持有；真实状态继续由 Settings Owner 返回。
- 设置：不新增或修改设置项。保留当前账户隔离、持久化和共享行为。
- 数据与权限：只更正文案；不改变 API、路由 ID、数据位置、认证、授权、快照和跨设备行为。

## 修改范围与验收

- 允许修改：设置菜单标签/搜索词、页面标题/说明/状态操作与错误提示、保存状态说明、受影响的包 README、本合同与任务索引。
- 禁止改变：`cloudPreferences` 深链 ID、Settings Owner、API 合同、设置或存储实现；不得新增云端同步或暗示已上线云端存储。
- 可观察验收：导航和标题不再出现“云端偏好设置”；说明准确指出当前 Control Plane 数据目录及同实例共享边界；刷新状态与打开快照入口保持原行为；桌面和窄视口均无遮挡、溢出，页面仍可滚动。

## 实施与验收记录

- 具体方案：菜单名称改为“偏好存储与共享”；页面标题与说明明确当前控制端数据目录、本机/远程主机存放位置和同一控制端的共享范围；状态操作和结果说明使用“保存状态”用语。保留 `cloudPreferences` 深链及原 API、存储行为。
- 变更文件：`docs/PROMPTS.md`（任务索引）；本合同（范围与证据）；`packages/util/values/src/settings-menu-catalog.ts`（设置菜单名称、说明和搜索词）；`packages/client/ui-settings/src/CloudPreferencesSettings.tsx`（页面标题、说明和状态操作文案）；`packages/client/ui-settings/README.md`（页面职责文档）。
- 实际验证：`pnpm run build:web` 与 `pnpm run build:control-plane` 均通过；`node scripts/runtime-build-state.mjs web` 返回空差异，确认 Web 指纹有效；目标文件 `git diff --check` 通过；产品 UI 目录和菜单目录中旧的云端偏好标签与同步状态措辞搜索无匹配。未运行测试套件。
- 实际页面验收：ChatGPT 内置浏览器打开隔离运行实例的 `/settings?section=cloudPreferences`。1280×720 桌面与 390×780 窄视口中，菜单、标题、说明及“刷新保存状态”按钮可见，窄屏文字自然换行且页面可滚动；滚动后“管理快照”入口可见，侧栏“应用快照”可进入快照页。未创建或恢复快照。临时账户当前没有已保存分类；点击保存状态按钮后按钮持续显示加载状态，因此刷新完成状态未确认。该项属于既有刷新行为，本轮不改写其实现。
- 性能/安全/可维护性证据与未测边界：本次仅改标签、说明、搜索词和包文档；没有新增请求、订阅、存储读写或设置项，未改变认证及数据权限。浏览器验收使用独立临时 Home/Data 与临时账户，没有读取或修改用户偏好。未对独立远程 Control Plane 部署、真实用户数据或 Electron 界面进行实测；临时服务已停止，隔离数据目录留在系统临时目录，本机安全策略拦截了递归删除操作。
- 同步的权威文档及链接：设置中心包 README；无设置或存储架构变化。

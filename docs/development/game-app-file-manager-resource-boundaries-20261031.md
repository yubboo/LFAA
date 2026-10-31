# Minecraft 与游戏库文件资源导航边界

<a id="lfaa-game-app-file-manager-resource-boundaries-20261031"></a>

## 用户目标与可观察结果

- 从 Minecraft、Steam 游戏库或游戏实例的文件入口进入 `/files` 时，资源导航只显示游戏应用需要的入口：LFAA 数据、游戏实例、游戏存储、备份、运行环境、工具目录和日志。
- AI 漫剧项目、我的资料库、节点资源、项目缓存、临时文件和本机磁盘只在左一全局文件管理总入口显示，不混入游戏应用内文件导航。
- 左一“更多功能”中的全局“文件管理”仍显示 Files Owner 返回的完整资源导航；过滤只改变游戏上下文中的可见快捷入口，不改变路径解析、授权、文件能力或数据归属。
- 即使当前已经在游戏上下文的 `/files` 页面，点击左一全局“文件管理”也会回到 LFAA 数据总览并恢复完整资源分类。

## 运行入口、Owner 与数据边界

- 运行入口：Minecraft / Steam 游戏库左二文件菜单或 Minecraft 实例文件入口 → `/files`；全局左一“更多功能”→ `/files`。
- 页面与可见性唯一 Owner：`packages/client/ui-sidebar-files`。来源 App 与一次性目录由 `packages/client/connection` 的 File Manager Location 路由状态传递；Minecraft 与 Steam 应用菜单仍由 `packages/client/ui-workspace` 管理，实例文件入口由 Minecraft UI 管理。
- 资源 ID、说明和实际位置仍来自认证后的 `loadFileResourceLocations` 与 Files Owner。UI 不复制服务端资源目录清单，不拼造物理路径；账户、角色、`permissions.mode`、节点能力及文件操作校验保持在现有 Owner。
- 游戏上下文包含明确的来源 App（Minecraft/Steam）或一次性目标位于 `game-instances` / `game-storage` 挂载。直达 `/files` 的左一全局入口没有这些来源上下文，继续显示完整清单。

## 设置与权限

- 不新增设置项。文件操作继续要求现有超级管理员与 `permissions.mode = full_access`，该设置默认值为 `ask`；可见性过滤不改变访问权限。
- `general.navigationLayout` 默认 `three-column`，继续控制现有工作区导航布局。文件页继续复用现有 Appearance 主题、颜色、字体、字号、背景、遮罩、模糊和减少动态效果设置。本任务不写入或重置任何用户偏好。

## 允许、禁止与验收

- 允许：在 `ui-sidebar-files` 增加游戏上下文的资源导航可见性筛选、长期回归、包 README、本合同与索引更新。
- 禁止：从服务端删减或隐藏资源能力、改动 Files 权限或目录 Owner、改变 `/files` 全局总览、修改游戏/Steam 存储设置或真实文件。
- 自动回归应证明 Minecraft、Steam 与实例文件上下文都使用游戏可见清单；普通 `/files` 总入口保留完整清单；允许的备份、环境、工具、日志类别在游戏上下文内保留。
- 正式 Web 重建后在 ChatGPT 内置浏览器分别检查 `/games/minecraft` 左二文件入口、`/games/steamcmd` 左二文件入口、游戏文件页内切回左一全局总入口和独立左一 `/files`。至少覆盖默认桌面视口和一处窄/短视口，记录实际分类、跳转、截图和未测项。
- 检查性能与安全：筛选只处理已读取的有界分类列表，不增加请求、订阅、轮询、缓存或计时器；服务端权限和路径校验保持不变。未测帧时间须明确标注。

## 实施与验收记录

- 状态：已完成。
- 设置盘点：现有 `permissions.mode`、`general.navigationLayout` 和 Appearance 映射保持不变，无设置中心控件/默认值/服务端校验/持久化改动。
- 实现文件：`packages/client/ui-sidebar-files/src/file-manager-resource-visibility.ts` 统一筛选游戏上下文资源；`FileManagerPage.tsx` 应用筛选并在左一总入口重置为 LFAA 数据根；包 README 记录边界；长期回归覆盖 Minecraft、Steam、实例、全局与 AI 漫剧路径上下文。
- 定向回归：`apps/cli/tests/client-game-app-file-manager-resource-boundaries.test.mjs` 3/3 通过；Client TypeScript 检查通过。
- 构建：`lfaa-client-ui-sidebar-files` 包构建通过；正式 Web 构建通过（3951 个模块，保留既有大 chunk 提示）；运行时构建指纹检查返回 `[]`；Web 健康检查为 200，持久化为 ready。
- ChatGPT 内置浏览器：默认 879×849 实际检查 `/games/minecraft/tasks` 左二文件入口进入 `/files`，来源路径为节点 `WIN-20250328BHE` 的 `data\\games\\minecraft`，出现“返回 Minecraft”，分类为七项白名单；在同页点击左一“更多功能 → 文件管理”后仍为 `/files`，路径切到 `data` 根、返回按钮消失，并恢复完整分类，包含 AI 漫剧项目、我的资料库、节点资源、缓存、临时文件和本机磁盘。
- Steam 实际入口：`/games/steamcmd` 左二文件管理进入 `/files`，显示同一组七项白名单和“返回 Steam”。当前节点设置对应 `data\\games\\steamcmd`，目录不存在，文件服务如实返回 ENOENT；没有创建目录，也没有修改节点设置。左一总入口随后成功回到 `data` 根和完整分类。
- 窄视口：760×560 检查 Minecraft 游戏内 `/files` 与全局总览；游戏内仅有七项白名单，左右栏可分别滚动，整页 `document.scrollWidth` 与视口宽度同为 760，没有整页横向溢出。临时视口覆盖已重置。
- 截图证据：本轮内置浏览器已捕获默认总览 879×849 与 Minecraft 窄视口 760×560 的实际页面截图；验收后标签页留在左一全局文件总览。
- 性能与安全：筛选只对已加载的有界分类列表作一次 O(n) 过滤；没有增加请求、订阅、轮询、计时器、缓存或文件写入，不改变 Files Owner 路径和授权校验。未测 Electron/WebView、实体手机和帧时间；Steam 目录列表受当前节点目录缺失限制。

## 2026-10-31 后续修复与复验

- Steam 游戏目录由 SteamCMD Storage Owner 当前设置定位，并由文件 Owner 安全创建缺失的 `C:\Users\Administrator\.lfaa\data\games\steamcmd` 根；SteamCMD 工具目录仍不自动创建。左二文件入口显示真实配置路径与空目录，不把 AI 漫剧、资料库、节点资源、缓存、临时文件或本机磁盘混入游戏上下文。
- 实页发现外层 `ui-workspace` 左一菜单只执行 `/files` 导航，未清掉上次游戏根。现已写入当前账户的 Data 总览位置；从 `/games/steamcmd` 点左一“更多功能 → 文件管理”后，实页显示 `C:\Users\Administrator\.lfaa\data`、完整 13 项资源导航和真实 `games` 目录。内部文件页上的左一切换仍同步清除返回标签。
- 760×560 IAB `/files` 截图确认中心区紧接资源栏与 1px 分隔线，无多余 64px 空白；document/body 宽度均 760。1280×720 下同样无横向溢出，document/body 宽度均 1280。截屏显示的是从 Steam 左一入口返回后的 Data 总览。
- Steam 左二进入真实目录、显示“返回 Steam”、返回 Steam 工作区均已实页复验。新缺根自动创建和真实 create-folder 后重读列表由隔离服务回归覆盖。游戏入口/资源边界 6/6、响应式缩进定向回归 1/1、文件服务隔离回归 11/11；Client 类型、ui-workspace 包及正式 Web 构建通过；官方 Web 入口重启后健康检查与构建指纹通过。
- 没有新增或修改设置与权限。继续使用 `permissions.mode`、`general.navigationLayout`、Appearance 与游戏目录 Owner 的现有设置；自动创建只针对设置指定的游戏根。桌面 WebView、实体手机/平板和帧时间未测。一次全文件响应式回归有 4 条与当前并行 ApplicationWorkspace/CSS 结构不符的既有断言失败，关联改动的窄屏定向用例单独通过；细节见游戏入口合同。

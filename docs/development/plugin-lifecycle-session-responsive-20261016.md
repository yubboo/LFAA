# 插件生命周期、会话菜单与响应式验收（2026-10-16）

实际入口：H:/LFAA1，Web Profile `web`，内置浏览器 `http://127.0.0.1:3000/plugin-manager` 与 `/work`，用户已自行登录管理员账户。只读参考用户补充的 H:/ai/deepseek-harness；旧 H:/deepseek-harness 不存在，不沿用历史路径。保留本轮前已有的脏工作，不提交、不发布、不操作 Steam 原文件。

## DSH 对照与修复

参考 `packages/boot/plugin-manager/src/install-spec.ts`、`operations.ts`、`index.ts`：DSH 将 npm、Git、绝对本地路径交给 pnpm，安装后检查 Bundle 与 Loader，卸载先停止运行项。LFAA 继续使用自己的 Plugin/Permission/Settings Owner，不复制 DSH 服务或权限控制面。三种来源进入同一检查、安装、启停、移除链；本地 tarball 作为额外覆盖。

修复安装/卸载按钮仅生成聊天目标而未直接完成操作的问题；管理员明确点击经既有 Permission Owner 校验，并绑定已检查版本，服务端复核认证、角色、来源与内容，冲突拒绝。自然语言仍走模型与原能力工具。npm 官方包名为 `dsh-plugin-wallpaper-engine`，`dsh-wallpaper-engine` 返回 404，不能伪造别名包的成功。

修复 npm 来源被壁纸 Runtime 拒绝、新版拆分 Host 文件未复制、独立 webwallgl 依赖缺失、gzip 设置响应未叠加账户选择导致刚选壁纸又清空。移除手写依赖遍历，运行依赖由 pnpm 安装完整版本图，禁止自动执行包生命周期脚本；私有包存储和下载缓存安装后清除。GitHub API 限流或 codeload 连接超时后从原官方仓库通过 Git 获取当前引用，临时检出完成清理，不搜索项目旧副本。Git 缺少发布构建时只允许仓库、清单、gitHead 完全对应且通过 SRI 的官方发布内容补齐。

本地来源不再仅因 kind=local 被拒绝；按内容摘要校验并使用同一 Runtime。本地目录忽略 `.git`/`node_modules`，遵循清单 files 范围，file:/link: 绝对路径写法解析为隔离内容快照；它不是持续跟随目录变化的开发热链接。未经构建的上游 Git 工作目录缺少 `lib/client.js`，检查会明确指出缺失；本轮本地实装使用重新从官方 registry 下载并验证的完整 1.3.3 包，不以不完整源码声称运行成功。

卸载等待 Host Fiber 及 Client 清理，再删除当前 Profile 源码、所有适配器修订和插件私有设置/上传/缓存。账户外观偏好、其他 Profile、Steam 原文件保持原归属。外部自定义目录不属于此次 LFAA 项目内清理范围。

## 设置与性能边界

沿用 `permissions.mode`；`plugins.enabled` 只控制 AI 扩展，与 Profile 安装清单分开。使用已有 `appearance.wallpaperEngine.enabled/projectId` 保存账户壁纸选择；主题/颜色/字体/字号/对比度/壁纸/遮罩/模糊/减少动态效果继承共享 Appearance 令牌；语言和快捷键沿用 `general.language`、`shortcuts`。布局沿用现有持久化与 `general.navigationLayout/showServiceStatus/showBottomPanelControl/terminalPosition`。未新增或重置用户偏好。现有 appearance.aiWorkOutputFocusBlurEnabled/Percent/IdleSeconds 在空闲时模糊输出，交互后恢复；这是账户已有设置，不是插件卸载残留，本轮未改写。

页面读取退出时撤销，生命周期串行，未新增轮询、第二个 React 根或第二个 HTTP 媒体监听。GitHub 检查约 30.8 秒，含远端连接；Git 安装及 pnpm 依赖准备约 56.1 秒；活动 Git 卸载约 3.4 秒。重复启用、整页交互帧时间与设备性能须分别评价，不能把渲染器帧率当成整页性能。

## 实际验收

- npm latest 与 GitHub HEAD 当前均为 1.3.3，提交 `01fbb8b8e66fd7e405e9c878d18dbd456187f111`；本轮实时查询。官方 tarball SHA-256 `52d7ababdccf0bfa289196914493af8d61a8802f253c9f6ceefe079e70421c67`，SHA-512 SRI 校验通过。这些仅是来源证据。
- 原 1.2.0 已卸载。npm 1.3.3 在真实页面启用；库显示 39 个可播放壁纸。Dreaming Flamingos Scene 画布生成首帧，停用后 iframe 和壁纸标记撤销，再启用保留选择。清空选择、卸载后清单和三个插件目录均空。
- GitHub `.git` 输入完成检查、安装、启用；真实设置与库加载，Dreaming Flamingos 场景画布 1761×1202，Host 收到实际首帧缓存写入。清空选择后卸载，源码、全部运行副本和私有目录不存在。
- 本地 `.tgz` 为本轮重新下载的官方 1.3.3；安装后我的世界视频 readyState=4、1920×1080，时间由 0.13 推进到 6.88 秒，点击暂停变为 paused=true。卸载后上述三个目录不存在。
- 本地目录实装 1.3.3，真实设置与 39 个壁纸库条目加载，停用 16ms，再启用 291ms；卸载 2.36 秒，清单为空且三个目录均不存在。最终 npm/pnpm 复测重新从 latest 下载，安装启用约 25.7 秒，实际设置页加载，随后卸载，清单与三个目录再次为空。
- 会话三点菜单复用原置顶/归档 Owner；实际置顶后取消，恢复原状态。Web 右键不绑定应用菜单；桌面右键共用同一 Dropdown，Electron 窗口实测未运行。没有归档真实用户会话来伪造操作覆盖。
- 1280×720 菜单与 760×520 工作区已在内置浏览器目视检查；右栏打开时左栏收起，聊天保留约 432px，无横向页面溢出。追加 390×640 与 1355×925 实页验收：菜单宽度约 259px，位置在视口内；Esc 后 aria-expanded=false，点击外部也关闭；Web 右键保持 aria-expanded=false。390×640 右栏最终位于 x=60、宽 330px、右边缘 390，无页面横向溢出；其余聊天内容隐藏，避免透明抽屉下叠读。窄屏与短屏均可滚动。修复验收中发现的 Esc 未关闭问题；菜单打开时才注册键盘/外部 Pointer 监听，关闭与卸载即撤销，布局模式变化同步关闭。
- 五组直接相关回归 29/29；Client/Host 类型检查通过；Web 与 Control Plane 构建通过。workspace-preflight 未运行：当前仓库无该脚本，使用实际 check:workspace，193 包、版本 0.0.8 检查通过。Web 有既存 cpp 501.3kB 分块提示，不是本轮新增模块。

证据保存在根 `dist/acceptance/plugin-lifecycle-20261016/`：npm-enabled.jpg、npm-removed.jpg、github-enabled.jpg、github-scene-playing.jpg、local-enabled.jpg、local-video.jpg、session-menu-desktop.jpg、work-760x520.jpg。该目录为本机验收截图，不打包进产品。

未声称完整 DSH ABI 或所有第三方插件兼容；未运行真实 Electron 右键、移动设备、上传/音频/全部播放列表功能、整页帧时间基准或真实 Provider 自然语言安装回归。三种来源生命周期与具体壁纸运行证据分开报告。

## 本轮逐文件范围

下表只列本轮变更，不把已有脏文件当成本轮交付。

| 绝对路径 | 职责 |
|---|---|
| H:/LFAA1/packages/boot/plugin-manager/src/index.ts | 生命周期、来源一致性与完整移除 |
| H:/LFAA1/packages/boot/plugin-manager/src/dsh-wallpaper-engine-runtime.ts | 新版 Host/Client、账户 gzip 设置、依赖和清理 |
| H:/LFAA1/packages/boot/plugin-manager/src/github-source.ts | GitHub 传输失败后的原仓库 Git 获取 |
| H:/LFAA1/packages/boot/plugin-manager/src/source-resolution.ts | npm 范围与本地 file/link 内容快照 |
| H:/LFAA1/packages/boot/plugin-manager/src/npm-source.ts | registry 内容、兼容版本范围与完整性 |
| H:/LFAA1/packages/boot/plugin-manager/src/npm-archive.ts | 旧类型包单一 TAR 根的安全兼容 |
| H:/LFAA1/packages/boot/plugin-manager/src/package-process.ts | 有界、无 Shell 的 pnpm/Git 子进程 |
| H:/LFAA1/packages/boot/plugin-manager/src/package-content.ts | Git/本地发布内容范围 |
| H:/LFAA1/packages/boot/plugin-manager/package.json | semver 运行依赖及类型 |
| H:/LFAA1/packages/boot/plugin-manager/README.md | 安装、依赖与清理合同 |
| H:/LFAA1/packages/api/plugin-controller/src/index.ts | 管理员手动安装、卸载及权限检查 |
| H:/LFAA1/packages/api/plugin-controller/README.md | 管理 API 合同 |
| H:/LFAA1/packages/client/connection/src/api.ts | 共享安装和卸载请求 |
| H:/LFAA1/packages/client/connection/README.md | Client 请求职责 |
| H:/LFAA1/packages/client/ui-plugin-manager/src/PluginManagerPage.tsx | 三类来源与直接生命周期按钮 |
| H:/LFAA1/packages/client/ui-plugin-manager/README.md | 页面交互与设置边界 |
| H:/LFAA1/packages/client/ui-workspace/src/ApplicationWorkspace.tsx | 会话菜单、窄容器两侧互斥 |
| H:/LFAA1/packages/client/ui-workspace/src/module-workbench.css | 菜单宽高和主题继承 |
| H:/LFAA1/packages/client/ui-workspace/README.md | 会话和布局事实 |
| H:/LFAA1/packages/client/ui-dockkit/src/ResizableWorkbench.tsx | 右 Dock 预算保留中心最小宽度 |
| H:/LFAA1/packages/client/ui-dockkit/src/workbench-layout.config.ts | 容器几何约束 |
| H:/LFAA1/packages/client/ui-dockkit/src/workbench.css | 窄屏 Overlay 的中心可见性 |
| H:/LFAA1/packages/client/ui-dockkit/README.md | 共享 Dock 合同 |
| H:/LFAA1/apps/cli/tests/plugin-manager.test.mjs | 来源、摘要、版本范围、归档和本地路径回归 |
| H:/LFAA1/apps/cli/tests/dsh-wallpaper-engine-runtime.test.mjs | 真实 Loader、清理和 gzip 回归 |
| H:/LFAA1/apps/cli/tests/plugin-manager-api.test.mjs | 安装移除权限、冲突和运行状态 |
| H:/LFAA1/apps/cli/tests/plugin-manager-ui.test.mjs | 生命周期按钮消费者回归 |
| H:/LFAA1/apps/cli/tests/client-workbench-responsive.test.mjs | 中心宽度与窄容器几何回归 |
| H:/LFAA1/docs/PROMPTS.md | 当前任务及用户补充合同 |
| H:/LFAA1/docs/系统总体架构.md | 当前入口、Owner 和响应式事实 |
| H:/LFAA1/docs/harness-packages.json | 受影响依赖的生成登记 |
| H:/LFAA1/pnpm-lock.yaml | 锁定新增 semver 依赖 |
| H:/LFAA1/docs/development/plugin-lifecycle-session-responsive-20261016.md | 本轮证据、限制与逐文件交付 |

## 最终状态与清理

当前 Profile 为空，原 1.2.0 与本轮各来源安装都已由产品卸载；账户外观与 Steam 原文件保留。自动审批拒绝了永久删除临时测试目录的命令，未返回更具体原因。改为可恢复地将本轮下载/准备脚本和旧版一次性 smoke 快照移出 H:/LFAA1，存入 C:/Users/yu/AppData/Local/Temp/lfaa-plugin-acceptance-recovery-20261016；这些副本未永久删除。产品源码、长期回归夹具与验收证据保留。恢复区不是产品安装路径，也不被 Runtime 加载。

最终截图追加 local-directory-enabled.jpg、npm-pnpm-enabled.jpg、final-plugin-empty.jpg、session-menu-desktop-final.jpg、session-menu-390x640.jpg、work-760x520-right.jpg、work-390x640-right.jpg。final-cleanup.json 与 local-directory-cleanup.json 记录清单及实际目录不存在的检查。服务继续在 127.0.0.1:3000 运行；临时视口覆盖结束前撤销。

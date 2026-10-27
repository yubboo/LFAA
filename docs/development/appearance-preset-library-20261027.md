# 外观预设库

<a id="lfaa-appearance-preset-library-20261027"></a>

## 目标

在设置中心“外观”页提供“预设”和“外观设置”页签。用户可应用系统内置风格、将当前外观保存为命名预设、删除自定义预设，并把单个预设导出/导入为版本化文件。应用预设时精确恢复快照所含的外观与常规布局字段，同时保留账户的文件夹、快捷键、通知、权限、模型、会话和其他未纳入预设的设置；不改写系统现有默认值或已保存偏好。

不新增名为“卡片布局”的假字段：当前“卡片式”布局入口实际是常规设置的 `general.navigationLayout` 预览卡片，卡片与弹窗自身效果是 `general.cardMotionEffect`、`general.dialogMotionEffect`。快照覆盖这三项，并按现有界面布局实际关联覆盖 `defaultFullView`、`showBottomPanelControl`、`showServiceStatus`、`terminalPosition` 与 `hiddenApplicationNavigationIds`。其他 General 字段不属于外观，不纳入预设。

## 设置清单与 Owner

- 权威设置类型/默认值：`packages/util/values/src/settings-contract.ts`。General 布局默认 `three-column`、完整视图/底部面板/服务状态为开启、终端位置 `bottom`、应用导航隐藏列表为空、卡片/弹窗动效均为 `fluid`。Appearance 默认系统主题、强调色 `#3457d5`、侧栏跟随主题、六个背景槽位 `none`、全局遮罩 65%、模糊 14px、更新表面不透明度 92%、字号 14/12px、系统减少动态、透明侧栏关闭、对比度 60、其他高级字段沿用共享默认常量。
- 唯一持久化/账户隔离/校验 Owner：`packages/settings/settings`。用户自定义预设作为 `appearance` 设置分类中的有界子列表保存；Appearance 现有验证与持久化继续复用，不复制新配置数据库。
- API Owner：`packages/api/settings-controller` 只认证和适配请求，检查快照引用的账户背景素材后调用 Settings Owner。跨 Appearance/General 应用快照必须由 Settings Owner 在同一配置事务中写入两个分类。
- Client Owner：`packages/client/ui-settings` 负责内置/自定义卡片、保存、应用、删除、导入导出及键盘/窄屏行为；`packages/client/connection` 只增加现有认证 Settings/背景 API 的类型化请求适配。
- 内置预设和背景/布局纯值目录由 `packages/util/values` 持有。`AppearanceSettings` 新增的预设子列表默认为空，因此既有账户偏好与默认外观不变。

## 快照范围与可移植性

- 快照完整复制 Appearance 设置字段（不递归复制自定义预设库），以及上文列出的 General 视觉/布局字段。主题、背景槽位、逐区遮罩/模糊、侧栏色、字体/字号、对比度、减少动态、材质、光线、焦点虚化、壁纸/进入动画引用均按当前 Owner 类型保留。
- 自定义上传背景属于账户私有素材。预设库仅保存已归 Settings Owner 验证的素材 ID，不复制图像字节；删除仍被任一预设引用的背景时显示可读提示并拒绝删除，避免已保存预设失效。导出单个预设时将其引用的每个唯一上传背景和原始 MIME/名称/字节一并打包；导入通过现有 Settings 背景上传 API 写入当前账户，再将素材 ID 映射到新 ID 后保存预设。文件不包含会话、密钥、权限或其他用户数据。
- 背景素材仍遵守 Settings Owner 单图 3 MiB、格式/像素尺寸/账户归属校验。导入文件须版本化、限制格式/体积、只接受快照白名单字段；逐个素材上传失败或预设保存失败时清理本次创建的未引用素材。预设最多 20 个，名称最多 40 字符；不得因导入重置已有预设。
- Wallpaper Engine 项目与登录动画插件只记录既有设置引用；目标账户无相应插件/项目时配置原样保留，效果依赖该 Owner 的能力实际可用。导出/导入不会安装、启停或修改插件。

## 分批实施与验收

### B1：共享合同与 Owner 持久化

完成：新增受限 `AppearancePreset`/快照类型、内置预设纯值、预设列表 Schema、旧账户补空列表与账户背景引用校验；由 Settings Owner 原子应用双分类快照。Appearance 共享默认值未改变。`appearance-preset-owner.test.mjs` 3/3 通过；values、settings、api/remotes、settings-controller 定向构建通过。

完成后先运行设置/路由定向回归、values/settings 类型检查和对应包构建；此批不改用户界面，无浏览器验收项。

### B2：外观预设页签与应用/保存

增加“预设 / 外观设置”可访问页签。内置和账户自定义预设显示主题、背景、强调色及布局预览；应用经原子设置接口，保存当前快照使用现有 Appearance 设置自动保存 Owner，删除只修改预设列表。界面不自动选中/应用预设。

完成：Client 定向类型检查、ui-settings 构建、Host 类型检查和 `client-appearance-presets.test.mjs` + `appearance-preset-owner.test.mjs` 合计 5/5 通过。正式 Web 源指纹重建后，ChatGPT 内置浏览器检查 `http://127.0.0.1:3018/settings?section=appearance`：桌面截图/视口 1270×714，窄短屏 390×640。预设/外观设置点击与左右键切换通过；“林间夜色”内置预设显示服务端成功；保存“验收临时预设”显示成功；常规页四种导航布局卡可见。窄屏侧栏折叠为图标栏、卡片单列滚动，无横向溢出迹象。测试账户在隔离 Home 中恢复为“常规默认”；隔离 Home 随 B3 结束清理。其他 General 字段的保留由双 Owner 定向回归覆盖，没有改真实账户偏好。截图由本轮内置浏览器现场采集（桌面预设与常规布局、390×640 窄屏预设卡片）。

### B3：带素材的预设文件导入/导出

完成：单个内置/自定义预设导出为 `.lfaa-preset` 版本化文件，包含快照引用的唯一私有背景及原始 MIME/名称/字节；导入先完整校验文件、白名单快照和素材边界，再由背景 Owner 上传素材、重映射到当前账户新 ID，并保存为一条独立自定义预设。确定失败时回收本轮上传素材；服务端提交结果无法确认时保留素材，避免破坏可能已保存的预设。删除被自定义预设引用的背景会被拒绝。

文件容器有固定 magic、版本、受限 manifest、素材数量/单图体积上限、严格素材 ID 对应和无尾随字节校验；不接收登录页私有背景。添加 `appearance-preset-file.test.mjs` 覆盖往返、格式/体积/素材匹配、登录页拒绝、ID 重映射、回滚与提交不确定保护。

定向回归 `client-appearance-presets.test.mjs`、`appearance-preset-owner.test.mjs`、`appearance-preset-file.test.mjs` 合计 11/11 通过；Web 构建成功（包含 Client 类型检查），values/settings/remotes/settings-controller/connection/ui-settings 定向构建和先前 Host 类型检查通过。最后重新构建 Control Plane 时被其他并行源码修改阻断：`knowledge-library` 读取当前 `HomePaths` 不存在的 `skills` 字段，`bilibili-video` 有多处可空值类型错误；这些文件不属于本任务，未修改。`runtime-build-state.mjs web` 当前报告 Web 新构建有效、Host 构建指纹过期，因此 Control Plane 当前源码状态未通过完整构建。

内置浏览器实页验收使用隔离 Home 和端口 3018，路由 `http://127.0.0.1:3018/settings?section=appearance`：桌面 1270×714 完成上传 PNG 到设置中心、保存当前外观、导出下载、导入为另一条同名预设并应用。页面显示导入成功；数据库里当前设置引用的私有背景 ID 与导入预设快照 ID 一致，且不同于原素材 ID，验证素材打包、重传、重映射和应用完整。损坏文件显示“文件格式无效；请选择 LFAA 外观预设文件”，自定义预设数保持 3/20。390×640 窄屏下预设卡片单列、操作按钮容纳在卡片内，文档宽度 380px，小于 390px 视口，无横向溢出。结束前已在隔离账号应用“常规默认”，确认设置中心背景槽位为 `none`；该账号与所有测试素材随隔离 Home 一并清理。实页截图由内置浏览器现场采集，涵盖桌面预设页、损坏文件提示与窄屏自定义卡片。

## 验收与风险

- 预设库上限、名称上限、快照字段白名单、账户素材归属、背景资产导入/导出与回滚均须有直接回归。
- 比较应用前后完整设置对象：仅 Appearance 与预设 General 字段可变；API 成功回读后界面才标记选中。未变化设置不触发第二次保存。
- 正式 Web 使用当前源码启动并确认源码/构建指纹，ChatGPT 内置浏览器检查 `/settings?section=appearance`；不使用占用中的用户端口。记录桌面和至少一个窄栏/短屏视口、操作结果、截图及限制。
- 此合同仅批准账户 Appearance 设置库和用户明确触发的导入素材创建；不包含真实账户设置应用、插件变更、工作区初始化或任何与预设无关的数据写入。

## 交付记录

- B1/B2/B3 源码、定向回归、类型检查、构建和浏览器验收：已完成，见分批记录。
- B3 内置浏览器路由为 `http://127.0.0.1:3018/settings?section=appearance`；桌面视口 1270×714、窄屏 390×640；上传素材、保存、导出、导入、应用、错误提示、窄屏操作通过，隔离账户恢复默认。后续 Web 构建及源码指纹复核通过；Control Plane 构建仍受前述并行编译错误阻断，因此最后一次 Web 重建后的完整 Web/Host 组合未重新启动实页验收。
- 当前源码工作区可能存在并行未提交修改；只记录和保留本任务必要变更。

# LFAA 插件管理页

本包实现独立三栏插件工作区：最左复用 `ui-sidebar/GlobalNavigationRail`，二级分类与动态插件入口复用 `ui-sidebar/SecondaryNavigation`，其拖动、宽度、吸附收起和窄屏 Overlay 由 `ui-dockkit/ResizableWorkbench` 管理；分类仍由本页面单一状态源选择。菜单保留全部、插件、应用、工具、技能、提示词、MCP 连接、我的知识库、运行诊断、领域专家；壁纸引擎入口只在 Profile 清单包含固定 Wallpaper Engine 身份记录时显示。以上分类映射到 `ui-settings` 中真实登记的扩展类别与现有 Owner 页面，不重复显示内层分类筛选。Profile 清单按真实安装数据展示插件，可搜索名称/描述/来源并按启用状态筛选，空清单时展示真实的 GitHub、NPM、Host 来源入口，不展示虚构的公共商店条目；应用总览、资料库、MCP 配置及 Cordis 模块启停/重建诊断继续复用原 Owner。启用和停用直接调用受认证的生命周期 API，安装和卸载直接调用受认证的管理 API。卸载并刷新清单后，壁纸引擎菜单和设置面板一起消失。该分区承接 DSH Slot 原生设置，DSH Client 内容未提供壁纸设置页时，由 `ui-settings` 展示真实不可用状态卡，按钮返回插件清单。页面由 Workbench 在 `/plugin-manager` 路由按需装载；保留 DSH Host 的 `/plugins` 静态资源前缀。

插件来源解析、不可变版本、安装事务、真实 Runtime 状态和删除由 `packages/boot/plugin-manager` 持有；启停按钮调用 `packages/api/plugin-controller` 的受认证生命周期 API，由 Permission Owner 将当前明确点击作为单次用户授权并复核管理员身份、目标 App 和固定来源版本，再调用同一 Plugin Manager Owner 并返回真实 Runtime 状态。自然语言启停继续由现有 Agent Loop/Core Tools 按当前 `permissions.mode` 执行；安装和卸载按钮直接调用受认证 Owner API；手动安装后显示“立即启用”，单独调用生命周期 API。安装绑定检查所得固定内容版本，卸载清理 Profile 默认私有数据；插件明确配置到外部的目录继续归对应 Plugin/Runtime Owner 管理。插件源码与清单位于 `<LFAA_HOME>/profiles/<Profile>/`，Wallpaper Engine 适配副本与默认私有运行数据位于该 Profile 的 `runtime-adapters/<plugin-id>/` 与 `runtime-data/<plugin-id>/`。插件自己的存储配置（如果有）由对应 Plugin/Runtime Owner 生效；系统 data 和业务内容存储设置不覆盖它。旧 `<LFAA_HOME>/plugins` 与 `<LFAA_DATA_DIR>/plugins` 不再作为插件入口。账户设置 `plugins.enabled` 只控制 AI 扩展，不改变 Profile 插件。

“添加插件”使用居中、短屏可滚动的 Modal。单一输入自动识别 NPM 包名/版本、GitHub HTTPS 地址与 Host 绝对路径；管理员可为 NPM 检查选择中国大陆镜像、官方源或单次自定义 HTTP(S) registry。检查结果回传解析后的 registry，安装重新读取来源时必须匹配同一 registry、来源类型/位置和固定摘要。自定义 registry 不保存到设置、Profile、`.npmrc` 或日志，不支持需认证源。安装引导可折叠；NPM registry 选择与展开控制并列，展开后显示 `dsh-plugin-whale-pet` 示例、自定义 registry 安全说明和完整插件信任提醒，收起时仍保留精简信任提示。

安装阶段经 `application/x-ndjson` 消费 Plugin Manager 实际回报：读取来源、固定版本/完整性核验、兼容性检查、安全写入暂存区、原子保存 Profile 清单和最终状态。摘要包含真实文件数、体积与 SHA-256；失败/不兼容保持失败或隔离，不呈现伪造的 pnpm 输出、安装百分比或“已启用”。不兼容来源的动作明确标为“保存隔离副本”，并说明插件代码不会运行；兼容来源才显示“开始安装”。“立即启用”只有检查结果和安装清单均确认存在兼容 Runtime 时才可用，且成功状态来自真实 Runtime 回读。NPM tarball 保持 SHA-512 SRI 和同 registry origin 校验；安装器不执行包生命周期脚本。

Host 本机来源输入指运行 LFAA 的 Host 绝对路径，不是浏览器/设备路径。当前只有明确适配的 Runtime 才能启停；无法运行的 DSH Bundle 以真实不兼容状态展示，不会导入控制端或 Client 主 Realm。来源脚本只作声明展示，不由本包执行。

页面读取 `permissions.mode` 显示当前授权模式，并消费现有角色、主题/字体/字号、对比度、壁纸/遮罩、模糊及减少动态效果共享映射；不新增设置或偏好。设置分类导航不再列出插件或 MCP，相关设置表单仅以独立模式嵌入本插件工作区。Profile 清单读取在进入分区时执行一次，用户可显式刷新；退出分区时中止未完成读取，没有后台轮询。

插件目录工具栏的齿轮按钮通过 `ui-layout/Workbench.openSettings("plugins")` 打开设置中心“集成 → 插件”；地址仍为 `/settings?section=plugins`，普通设置页将其解析为 Profile 插件菜单，使用设置中心标准行和真实生命周期开关。Workbench 保存 `/plugin-manager` 返回路由；`ui-settings` 使用同一受认证 Plugin Manager API，不复制插件清单或生命周期规则。旧 AI 扩展、MCP、Skill 与 Cordis 工作区仍由此页面通过 SettingsPage standalone 模式展示，不与 Profile 插件启停状态混用。

添加与详情弹窗的外框、标题、操作区和窄屏滚动由 `ui-theme` 共享样式统一管理；本包只保留来源表单和内容区的布局约束。

包入口：`src/index.ts`；按需客户端注册：`src/client/index.ts`；主消费者：`packages/client/ui-layout`。构建只写仓库根 `dist/packages/client/ui-plugin-manager/`。源代码/类型、包与入口构建、真实 Web 内置浏览器视口验收分别记录；构建不代表真实插件安装或生命周期已实测。

# DSH 与 LFAA 插件扩展方式对照

核对日期：2026-10-17。DSH 源码和用户安装目录只读；本文件记录实际实现和差距，不把参考仓库能力记为 LFAA 已接入。

## DSH 如何让能力可组合、可替换

| 机制 | DSH 实际做法 | 设计作用 |
|---|---|---|
| 安装与组合 | Profile 的 `package.json` 保存依赖；`pnpm-lock.yaml` 固定依赖树；`dsh.profile.bundles` 记录启用的 Bundle；Bundle 通过 `dsh.bundle.patch` 贡献 Cordis Loader 行。 | 安装来源与运行组合分开管理；用户可以保留包但不启用 Bundle。 |
| 覆盖顺序 | Profile Bundle 按列表顺序合成；Profile `cordis.patch.yml`、Harness Home `cordis.patch.yml`、CLI 显式 Patch 继续按层覆盖。以插件 ID 改模块名即可换实现；Patch 也可改配置或启停。 | 先定默认，再让 Profile 和用户按自己的工作组合替换。 |
| 安装事务 | `packages/boot/plugin-manager/src/operations.ts` 通过 pnpm 更新 Profile 清单和锁文件；按 Profile 文件锁串行化；执行后读取实际包清单并检查兼容性。遇到刚装入的不兼容包时，恢复原清单/锁文件并重装原依赖树。 | 安装结果是可复核的 Profile 事实，不能只凭命令退出码报告成功。 |
| 运行期替换 | `packages/boot/plugin-manager/src/index.ts` 保存 Bundle 选择并向 HMR 请求 `reconcileProfile`。能热替换的立即报告应用结果；不能热替换的说明需要重启。 | 磁盘配置已变化不等于当前 Runtime 已切换。 |
| 服务与资源 | 插件经 Cordis Context 提供 Service/Consumer；监听器、路由、适配器和效果由 Fiber 持有。关闭 Fiber 会撤销所属资源。 | 替换服务有明确 Owner 和卸载边界。 |
| 模型 | `ctx.llm.registerAdapter(providerIds, adapter)` 按 Provider 路由登记协议实现；冲突显式失败，返回 disposer。`registerConfigurableProviders` 登记可配置 Provider。 | 一个调用合同能服务多个模型协议，具体实现可由插件替换。 |
| 主题 | Client `ThemeRuntime.register` 增加可选择主题；`overrideTokens` 以 Light/Dark 双值叠加主题令牌，Fiber/插件 disposer 移除准确一层。 | 主题包贡献受限外观令牌，停用后回到前一层。 |
| 管理界面 | Plugin Manager 声明并消费 9 类类型化 Slot：新增操作、标签、Bundle 激活、插件项、Bundle 配置、单行配置、详情操作、详情徽标、详情区段。 | 插件可以增补管理入口和配置界面；Host 仍负责清单和生命周期。 |

DSH 的要点不是在每个页面手写一个“插件开关”，而是把可变实现放在 Loader/Service/Registry/Slot 的合同边界内，再由单一 Owner 管来源、运行状态、设置和清理。插件仍使用 Host 权限和真实服务，不因已登记就自动获得访问权。

## 用户的 `.dsh` 安装目录核对

检查对象为 `C:\Users\Administrator\.dsh`。已核对根目录、Profile 清单、用户 Profile 的 Patch、锁文件和存储目录名称；没有读取凭据内容、会话正文或运行日志。

| 路径/文件 | 观察到的用途 | LFAA 对应 Owner |
|---|---|---|
| `.dsh/profiles/web/package.json` | 安装依赖及有序 Bundle 列表；当前含 DSH 基础/实验 Bundle、`dsh-ops`、`opencode2dsh`，以及两个本机链接的子 Agent 包。 | `apps/cli/config/profiles/*/package.json` 是随 LFAA 发布的基线；`<LFAA_HOME>/profiles/<Profile>/package.json` 可作为用户 Profile 覆盖。LFAA 不会在 Profile 内自动安装任意依赖。 |
| `.dsh/profiles/web/pnpm-lock.yaml`、`pnpm-workspace.yaml` | 固定安装版本和本机 workspace 包查找规则。 | LFAA 插件清单固定来源摘要；产品源码依赖仍由根 `pnpm-lock.yaml` 管。LFAA 当前不为用户插件运行任意包安装脚本。 |
| `.dsh/profiles/web/cordis.patch.yml` | 用户按插件 ID 覆盖模型/Provider 与模型目录、禁用 Wallpaper Engine、修改实验插件开关。 | `<LFAA_HOME>/profiles/<Profile>/cordis.patch.yml`；基线 Bundle 后依次叠加 Profile、Home 与显式 Patch。本轮允许 required 插件替换实现，仍禁止停用 required 插件。 |
| `.dsh/profiles/web/cordis.yml` | Profile 的 Loader 配置文件。 | LFAA 运行组合以 Profile/Bundle Patch 为权威，不复制 DSH 专有序列化格式。 |
| `.dsh/profiles/web/.plugin-manager/` | 用户安装目录存在 Plugin Manager 操作状态目录。 | LFAA `<LFAA_HOME>/profiles/<Profile>/inventory.json` 是安装状态权威；真实运行诊断由 Runtime/Diagnostics Owner 提供，不伪造一份 DSH 日志树。 |
| `.dsh/.credentials.yaml` | 用户凭据文件；本次只确认文件存在，未读取其值。 | LFAA Settings/Credentials 加密账户与插件凭据 Owner。 |
| `.dsh/storages/workspace.json` | 用户工作区持久化数据。 | LFAA Workspace/Storage Owner。 |
| `.dsh/node_modules/`、`logs/`、`sessions/` | 已安装依赖、运行日志和会话数据目录。本次没有逐项读取其内容。 | LFAA 分离产品代码、运行插件快照、日志和用户数据。 |

该安装目录证明真实用户通过 Profile 清单、锁文件、用户 Patch 来组合不同来源的插件；`node_modules` 里的文件或 `.plugin-manager` 操作日志本身并不拥有安装/启停合同，真实事务逻辑在 DSH Plugin Manager 源码中。

## DSH Home、LFAA 数据根与自定义位置

| 数据 Owner | 默认/可配置位置 | 本机观察与 LFAA 处理方式 |
|---|---|---|
| DSH Harness Home | DSH 源码 `packages/util/home-paths` 以 `DSH_HOME` 优先覆盖、最后回退到系统账户 `~/.dsh`；一个 Home 承载 Profile、安装依赖、锁文件、日志、会话、Storage 和凭据。 | 本机 `C:\Users\Administrator\.dsh` 有 `profiles/web`、Profile `node_modules`、`pnpm-lock.yaml`、workspace 清单、Cordis 配置与独立的 logs/sessions/storages。凭据文件仅核对存在与大小，未读内容。DSH Home 属于独立 DSH 进程的 Owner，LFAA 不读取其凭据、不移动其依赖或改写 DSH_HOME。 |
| LFAA 安装 Home | `LFAA_HOME`；未配置时默认 `%USERPROFILE%\.lfaa`（非 Windows 为 `~/.lfaa`），可用绝对路径覆盖。Profile 覆盖在 `<LFAA_HOME>/profiles/<Profile>`；插件源码、清单、受控运行适配副本和默认私有运行数据都归各自 Profile。 | 与系统 data/业务内容根分离；插件配置按对应 Plugin/Runtime Owner 生效，默认运行数据不会因更改 `LFAA_DATA_DIR` 而移动。旧 `<LFAA_HOME>/plugins` 与 `<LFAA_DATA_DIR>/plugins` 不再创建、读取或迁移，旧文件留在原处。Profile 只写入空 Cordis Patch 模板，不会复制 DSH 配置、依赖、凭据或会话。 |
| LFAA Harness 数据根 | `LFAA_DATA_DIR`；未配置时默认 `<LFAA_HOME>/data`。设置中心可选默认、推荐或自定义绝对路径；Windows 开发/桌面通过完整启动器登记系统复制、手动复制后核验采用或 ZIP 导入，停止服务后验证再切换。 | 当前 checkout 的 `.env` 显式指向 `E:\lfaa1\lfaa\data`；这是本机文件的当前内容，不证明另一个运行进程的环境变量。 |
| LFAA 子目录 | `packages/util/home-paths/src/data-layout.mjs` 从唯一有效数据根派生 `database`、`users`、`sessions`、`credentials`、`games`、`environments`、`lib`、`cache`、`tmp`、`logs`、`backups`、`models`、`connectivity` 与 `storages`。用户背景/知识/工作流等再由账户哈希目录隔离。 | 只有未配置/默认选择时数据根才是 `<LFAA_HOME>/data`；显式推荐 `data` 或自定义位置会作为唯一根，不会再生成一份空的 `.lfaa/data`。插件安装快照与默认私有运行数据都位于 `<LFAA_HOME>/profiles/<Profile>`；插件自身存储配置由对应 Runtime Owner 使用。 |

因此 LFAA 的安装插件文件由 `LFAA_HOME` 管理，用户数据由单个可自定义的 `LFAA_DATA_DIR` 管理；DSH 的完整 `~/.dsh` 保留在它自己的 `DSH_HOME` Owner 下，避免两个程序共用同名目录。LFAA 的三种迁移仅切换用户数据，不操作 DSH Home 或插件安装根。

## LFAA 现状与逐页差距

| LFAA 页面/能力 | 当前唯一 Owner 与已存在扩展面 | 对照状态及差距 |
|---|---|---|
| 全部/插件 | `boot/plugin-manager`、`capability-installs`、`ui-plugin-manager`。GitHub/NPM/Host 本机来源固定到不可变快照并检查 SRI/归档；权限、状态、Runtime 由 Host 回读。 | **安全安装已做，执行兼容不等价。** LFAA v1 外部插件仍限 AppContainer 内无额外 capability 的进程；官方 Wallpaper Engine 是专用适配。任意 DSH/npm Bundle 不会进入 Host/Client 主 Realm。 |
| 管理器插件自定义 UI | `client/modules`、`ui-renderer`、`DshSlotRoot` 与 `PluginManagerPage`。本轮增加 DSH 对齐的 9 个管理器 Slot 消费，并保留 LFAA 自己的安装清单和设置 Owner。 | **已打通部分 UI 接缝。** DSH Host ConfigForm / Bundle Row / Profile 运行时不能直接冒充 LFAA；缺少适配器就显示可见的空状态，不应显示按钮已生效。 |
| 应用 | `ui-plugin-manager` 的 Applications 视图映射到 Settings/App Owner 与 App 路由。 | **内置应用可用，外部应用热替换并未全量提供。** App 页面、导航、权限与数据须由当前 Owner 注册；不允许以插件卡片替代真实服务。 |
| 工具 | `core/tools` 的 `registerAiBusinessTool`/Factory；完整参数解析、范围、风险、审批和执行合同；Permission Owner 保持唯一。 | **已有可撤销工具注册。** 目录声明本身不等于执行能力；工具生产者/消费者不应另造平行权限层。 |
| Skills | `core/agent` AI Extension Registry 与 `capability-skill` 项目快照安装。正文按需加载、卸载后重验所属身份。 | **已有目录和安全安装；任意脚本/资源包不是已支持的 Runtime。** 更新、启停和二进制 Skill 仍见 Capability Installer README 的实际差距。 |
| 提示词 | `core/agent` AI Extension Registry / `core/system-prompt` 与实际 Run 拼装。 | **已有按 App 范围的 Prompt/Expert 内容登记。** 任何可替换系统规则都必须归唯一 System Prompt Owner，不接受绕过授权或伪造未接入能力的插件贡献。 |
| MCP 连接 | Settings 保存服务配置，`mcp-client` 负责发现和受控调用。 | **连接/执行已由原 Owner 实现，新增 MCP 服务安装不是通用插件安装。** MCP 管理页面必须反馈配置校验、可达性和真实发现结果；当前 Capability Installer README 明确列出尚无 MCP 安装适配器。 |
| 我的知识库 | Settings/Knowledge Library 与本机 Storage Owner。 | **用户资料属于账户数据 Owner。** 插件只能调用对应 API，不能自行复制/重置知识库或凭目录登记假称已索引。 |
| 运行诊断 | Plugin Runtime/Plugin Manager diagnostics 与 Health Owner。 | **真实状态可查询。** 不可兼容、待重启、安装失败和运行异常必须区分，不能将依赖存在当成已启用。 |
| 领域专家 | AI Extension Registry、各领域能力包及 System Prompt 拼装。 | **已有可登记专家元数据和内容。** 专家声明不能增加工具权限、改变数据范围或将自然语言建议冒充业务能力。 |
| 壁纸引擎 | 固定官方 DSH Wallpaper Engine 来源、专用 Host/Client 适配和受控 Appearance 映射。 | **当前有真实可运行的专用插件。** 它不是通用第三方 Client Bundle Runtime；其它壁纸、主题包不能假称已兼容。 |
| AI Provider / 模型 | 本轮将 Settings Provider Catalog 设为可由 Cordis 插件登记，并允许 Provider 自有模型发现/真实测试；统一 `lfaaLlm` Adapter 服务由 `agent-loop`、摘要和分支记忆共用。 | **核心接缝已补，外部接入仍受现有插件 Runtime 支持范围限制。** 默认 OpenAI-compatible 请求保持原路径；插件注册的 secret 继续经 Settings 输入，API 不回显密钥。 |
| 外观/主题 | `ui-theme`、Workbench 共享令牌、Appearance Settings；Dsh Wallpaper Bridge 映射官方插件 token。 | **共享设置映射已有，通用用户主题包注册/选择仍缺失。** 当前 `dsh-theme-bridge` 仅接受受限 DSH 文本色与字体角色；全局 CSS/Ant Design 固定值和浮层对比度是本轮修复项。 |

## 本轮已落实的可验证改变

- App Boot 仍保持 Profile → Bundle → Profile/Home/显式 Patch 的顺序；同一个必需插件 ID 可换包名实现，必需行仍禁止停用。替换实现未提供被消费的 Cordis Service 时，后续启动合同会失败，不静默降级。
- `lfaaLlm` 现在有 Cordis 服务注册表；Agent 主请求、回复后记忆、摘要压缩、分支记忆共用 Provider Adapter 接口，适配器重复 ID 会明确冲突，disposer 可准确撤销。
- Settings Provider 支持按插件生命周期登记模型目录定义、验证后的配置选项、HTTPS 连接解析，并可为非通用目录/协议注册真实模型发现及测试处理器。Provider 列表返回副本，插件不能通过改返回值篡改 Owner 目录。模型密钥只传给 Provider 测试处理器，不进入目录元数据。
- React 根 Ant Design Token 改读共享强调色、正文/次要文字和界面字体令牌。AI Work 输入框不再把 caret-color 写死为当前文字色，Wallpaper Engine 提供的光标颜色可以应用到该输入框。
- 新账户的 `appearance.overlay` 默认 65%（原 37%）；Slider 仍由设置中心控制 0–75%，旧账户显式保存的值原样保留。Workbench 的 blur 仍读取账户 `appearance.blur`。这修复的是背景图下低对比表面默认，不能代替真实浏览器目视检查。
- Plugin Manager 9 个 Slot 的列举/渲染回归已经在 `apps/cli/tests/dsh-slot-outlet.test.mjs`。Provider Adapter、Provider Catalog、Profile Required Plugin 替换与设值保留均有隔离回归。

## 仍须逐批补齐和验收的边界

1. 通用主题包登记、用户选择、服务端设置值/持久化和完整语义令牌校验尚未实现；不能把 Wallpaper Engine 的逐面控制误报为全产品主题包支持。
2. 外部插件 Runtime 继续沿用当前 AppContainer/官方 Wallpaper 专用合同。本轮没有放开任意第三方 Node/React 代码加载、安装脚本、网络、主进程或特权工具。
3. Applications、MCP、Knowledge、Diagnostics、Experts 等视图仍由原 Owner 提供真实能力；本轮扩展 UI Slot 不会自动让这些类型都变成任意可替换执行包。逐领域迁移须保持包 Owner、权限、设置、数据和节点运行边界。
4. 真实 Provider 账户、用户 `.dsh` 插件的迁移、HMR/重启运行状态、桌面安装包、壁纸插件开启时的视觉表现均未由隔离回归证明。需要分别记录实页和实运行验收。

## 验收建议

每批先登记目标 Runtime、唯一 Owner、使用的 Settings、实际消费者与失败态；先加替换/撤销/重复登记/无效配置回归，再实现 UI 和调用路径。先验收提供者，再验收消费者；确认卸载撤销监听、回滚配置并且当前安装状态反映 Runtime 实况。Web 页面使用 ChatGPT 内置浏览器实页检查实际路由与桌面、窄视口；构建通过不能代替实页、Provider 或桌面实测。

# 插件清单对齐 DSH（内置插件页 + Loader 全量装配）

- 状态：**P0/P1 已完成（DEV-000647）；P2 部分完成（DEV-000648）；P3/P4 待排期**。实施进展见 §9。
- 日期：2026-11-27（Asia/Shanghai）
- 提出人：负责人（「完全按照 DSH 那样做，新功能也照 DSH 学」）
- 涉及包：`packages/extension/plugins`、`packages/bundle/web`、`packages/client/ui-plugins`、各 `packages/*/*`（新增 locale 元数据）、`packages/host/web-server`、`scripts/check-workspace.mjs`

## 1. 现状与差距

| 项 | LFAA 现在 | DSH 0.2.2-rc.5 |
|---|---|---|
| 清单来源 | `plugin-catalog.ts` 手写 31 条 `INSTALLABLE_PACKAGES` | `ctx.loader.entries()` 实时投影，没有第二份清单 |
| 覆盖 | 仓库 38 个可装配插件只显示 31 个 | 每个 Loader 条目一条，含失败条目 |
| 状态 | 只有「已装配 / 已安装」二值角标 | 配置状态（启用/停用/条件启用）+ 运行相位（等待依赖/加载中/运行中/启动失败/卸载中）+ 失败诊断 |
| 描述 | 手写一句话；每张卡再重复同一句 `providedHint` | 每个包 `locale/<lang>.json` 的 `meta.title` / `meta.description`，按界面语言取 |
| 分组 | 会话插件 / 全局插件（按预设切分目录） | 会话插件（按 Agent 预设，带切换器）+ 全局插件（默认折叠） |
| 启停 | 静态装配的 31 个模块既不能停用也不能重装；能操作的只有外部插件和记录态内置项 | 设置里的清单**只读**；启停在侧栏 Plugins 页（`pluginManager` 写 profile 补丁），Loader 重组 |

结论：差距不在「描述没写」，而在**唯一真相的位置**——DSH 相信 Loader，我们相信一张手写清单。要真正对齐，必须把装配权从 `bundle/web` 的静态 `ctx.plugin` 交给 Loader。

## 2. 调研与参考

DSH 侧（本机安装 0.2.2-rc.5，ASAR 内源码，逐文件读过）：

- `@deepseek-ai/dsh-host-plugin-inventory/src/index.ts`：`readPluginInventory(ctx)` 每次调用遍历 `ctx.loader.entries()`，跳过 group 条目，映射 `enabled`、root Fiber 相位与失败诊断；`meta` 取自 `pluginPackages.metaOf(moduleName, baseUrl)`；Agent 预设由 `agentPresets.compositionInventory()` 提供。**不做缓存**，避免第二份生命周期真相。
- 同包 `src/types.ts`：`PluginInventoryEntry { entryId, moduleName, meta?, enabled, fiberPhase, diagnostic? }`、`AgentPresetPluginGroup { id, name?, isDefault, broken?, rows[] }`、`PluginFiberPhase = pending | loading | active | failed | unloading | null`。
- `@deepseek-ai/dsh-client-ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.tsx`：卡片 = 标题 + 两行描述（折叠）+ 条目 id chip + 启用状态标签（只有偏离默认时才显示）+ 相位圆点；展开后是 `完整名称 / 来自（预设）/ 配置状态 / 运行状态 / 禁用条件`；分组为「会话插件」（默认展开，右上预设切换器）+「全局插件」（默认折叠，搜索时自动展开）。
- 同包 `src/client/locales.ts`：文案键 `presetTitle 会话插件`、`globalTitle 全局插件`、`moduleLabel 完整名称`、`fromPreset 来自`、`configuration 配置状态`、`runtime 运行状态`、`enabledTag 已启用`、`presetEnabledTag 预设中启用`、`failedTag 启动失败`、`unobserved 未运行` 等。
- `@deepseek-ai/dsh-plugin-manager/README.md`：**Settings Plugin list stays read-only**；启停是把 `disabled` 写进 profile 的 `cordis.patch.yml`（无匹配则追加），Loader 重组后生效；管理页在侧栏 Plugins。
- 每个包自带 `locale/zh.json`、`locale/en.json`：例如 `dsh-tool-schedule` 的 `meta` 是「任务调度工具 / 提供自动化任务的创建、查看、修改和删除工具。」——这正是截图里描述各不相同的原因。

仓库内现状（读过代码）：

- `packages/bundle/web/src/index.ts`：35 个核心模块 `ctx.plugin(...)` 静态挂载，Loader 只负责后续启用外部/记录态插件。
- `packages/extension/plugins/src/catalog/plugin-catalog.ts`：手写清单 31 条；`buildCatalog` 供前端。
- `packages/extension/plugins/src/manager/plugin-manager.ts`：已装配模块 `enablePlugin` 直接抛「已由当前应用装配」（:243），`installPlugin` 同样拒绝（:186），所以已装配项无法启停。
- `packages/extension/plugins/src/manager/profile-packages.ts`：`cordis.yml` 只写「已启用记录」，不是完整装配清单。
- `packages/client/ui-plugins/client/components/Catalog-Card.tsx:32`：`providedHint` 每卡无条件渲染，造成 31 张卡同一句描述。

## 3. 目标架构

```
profile 装配清单（cordis.yml / cordis.patch.yml）
        │  bundle 只负责：Loader、插件管理、聊天装配、跨服务联线
        ▼
Cordis Loader（全部插件都是条目：内置 + 外部，含 disabled 覆盖）
        │
        ├── pluginInventory 投影（只读）──► 设置中心「内置插件」页（会话插件 / 全局插件 / 展开详情）
        └── pluginManager（写 disabled）──► 插件中心「插件」页（启停、外部安装）
```

元数据：每个插件包新增 `locale/zh.json`、`locale/en.json`，内容为 `{ "meta": { "title", "description" } }`；Host 投影时按包名解析包目录读出，界面按当前语言取，缺失回落 `package.json.description` 并带元信息诊断。

## 4. 分步实施

### P0 数据面：元数据 + 只读投影（低风险）

1. 新增 `packages/extension/plugins/src/catalog/package-meta.ts`：`metaOf(moduleName, packageDir)` 读 `package.json` 与 `locale/*.json`，返回 `{ title, description, error? }`。
2. 新增 `packages/extension/plugins/src/inventory/plugin-inventory.ts`：`readPluginInventory(ctx)` 投影 `ctx.loader.entries()`（跳过 group），补上 bundle 自身引导条目；静态装配模块的相位由它们所在 fiber 的真实状态给出，失败时带 `diagnostic`。
3. `packages/extension/plugins/contract/index.ts`：新增 `PluginFiberPhase`、`PluginInventoryEntry`、`PluginInventorySnapshot`、`PluginInventoryPresetGroup`。
4. `packages/extension/plugins/src/routes/plugin-routes.ts`：新增 `GET /api/plugin-inventory`（本机令牌校验沿用 `checkApiAuth`）。
5. 38 个插件包各加 `locale/zh.json` + `locale/en.json`（标题取现有手写名称，描述改写为该插件真实能力的 1–2 句，中英各一份）。
6. 单测：投影字段完整、失败条目带诊断、group 条目被跳过、无 locale 时回落。

### P1 设置中心「内置插件」只读页（低风险，用户可见）

1. `packages/client/ui-plugins/client/settings/PluginInventoryView.tsx` + `PluginInventoryView.module.css`：DSH 同构卡片与分组；搜索覆盖标题、描述、包名、条目 id。
2. `packages/client/ui-plugins/client/locales.ts`：对齐 DSH 文案键（会话插件 / 全局插件 / 完整名称 / 来自 / 配置状态 / 运行状态 / 等待依赖 / 加载中 / 运行中 / 启动失败 / 卸载中 / 未运行 / 预设中启用 / 启动失败）。
3. `packages/client/ui-plugins/client/index.tsx`：注册设置中心视图「内置插件」，卸载时撤销。
4. 删除 `CatalogCard` 的 `providedHint` 重复渲染。
5. 验收：38 个插件全部出现；展开任意卡片字段与 DSH 一致；浅色/深色、窄屏可用。

### P2 装配 Loader 化（高风险，单独一轮）

1. 新增 `packages/bundle/web/src/loader-composition.ts`：由 `PRESETS` / `CORE_MODULES` / `OPTIONAL_MODULES` 生成 Loader 条目（id、模块名、disabled 覆盖），替换 `ctx.plugin` 静态挂载。
2. `packages/bundle/web/src/index.ts` 收缩为：先挂 Loader，再用 Loader 装配核心模块，最后挂插件管理与聊天、联线。
3. profile 的 `cordis.yml` 改为完整装配快照（不再是「已启用记录」），与 `cordis.patch.yml` 覆盖合并。
4. 处理 Cordis 服务可见性：Loader 条目在 loader 子树，bundle 自身不能再 `ctx.get` 子服务，跨服务联线继续放独立 wiring 插件。
5. 门禁：`probe:boot`、`probe:loader`、`pnpm test` 全绿；旧 profile 的 `cordis.yml` 需迁移策略（缺条目时按预设补齐）。

### P3 启停闭环（高风险）

1. `plugin-manager`：改为对 Loader 条目写 `disabled`（profile 补丁），不再要求「先有记录」；`enable/disable` 对内置项同样生效。
2. `POST /api/plugins/builtin/enable` 等接口复用同一路径；错误文案去掉「已由当前应用装配」。
3. 插件中心改为管理页：内置项只做启停、外部插件保留安装/卸载；状态一律取 inventory。
4. 验收：停用一个内置工具插件后工具立刻消失、重启后仍停用；重新启用后工具回来。

### P4 清理与门禁

1. 删除 `INSTALLABLE_PACKAGES` 与 `buildCatalog`；`toRecordId` / `MODULE_ALIASES` 保留（历史记录迁移仍需要）。
2. `scripts/check-workspace.mjs` 新增 `plugin-locale-meta`：所有带 `export default` 的插件包必须有 `locale/zh.json` 与 `locale/en.json` 且含 `meta.title` / `meta.description`。
3. 新增清单一致性检查：Loader 条目集合 == 插件包集合（排除装配包）。
4. 重写 `docs/features/plugin-inventory.md`，把状态改成「已按 DSH 同构落地」。

## 5. 需要负责人确认的决定

- **D1 装配权**：核心 35 个模块是否全部改为 Loader 条目（DSH 同构，启停才真实）？备选是保留静态装配、只做「伪条目」投影——页面能看，但停用仍是假的。**推荐前者**。
- **D2 入口分工**：设置中心「内置插件」只读（与 DSH 一致），启停放侧栏「插件中心」。确认？还是希望设置页里也能直接开关（DSH 明确没做）？
- **D3 描述来源**：每个包自带 `locale/*.json` 元数据（DSH 同构，装外部插件也自动有描述），而不是集中维护一张表。确认？
- **D4 节奏**：先做 P0+P1（低风险，本轮可见效果），P2+P3 另起一轮评审后实施。还是 P0–P3 一次做完？

## 6. 验收标准

- 「内置插件」页列出全部插件（当前 38 个），每张卡标题与描述各不同，来源是包元数据而非手写清单。
- 卡片展开后显示：完整包名、来自（预设名）、配置状态、运行状态、禁用条件（有则显示）。
- 运行状态取自真实 Fiber：启动失败的条目显示「启动失败」与该条诊断。
- 停用/启用一个内置插件后，它注册的工具与服务随 Loader 重组即时消失/恢复，刷新与重启后状态保持（P3）。
- 不再出现重复的 `providedHint`；浅色/深色与窄屏下均可读。
- `pnpm check`、`lint`、`typecheck`、`test`、`probe:boot`、`probe:loader`、`verify:web` 全绿，并完成内置浏览器实测与截图自查。

## 7. 风险与回滚

- **启动顺序与服务可见性**（P2 最大风险）：Loader 条目不再共享 bundle 的 fiber 祖先链，`ctx.get` 型联线会失效；先用一个模块试挂，确认 `inject` 校验通过再铺开。
- **旧 profile 兼容**：现网 `cordis.yml` 只有已启用记录，需一次性迁移；迁移失败要能回落到静态装配（保留开关一个版本）。
- **HMR 与重载**：Loader 重组期间的资源释放顺序要补测试，避免工具注册残留。
- 回滚：P0/P1 纯增量，删文件即可回退；P2/P3 以独立提交存在，可按阶段 revert。

## 8. 工作量估算

| 阶段 | 预估 | 说明 |
|---|---|---|
| P0 | 0.5–1 轮 | 投影 + 路由 + 38 份 locale + 单测 |
| P1 | 1 轮 | 设置页 + 文案 + 视觉验收 |
| P2 | 2–3 轮 | 装配改造 + 启动期排障 |
| P3 | 1–2 轮 | 启停写入 + 重组 + 回归 |
| P4 | 0.5 轮 | 清理与门禁 |

## 9. 实施进展

| 阶段 | 状态 | 说明 |
|---|---|---|
| P0 | 完成（DEV-000647） | `package-meta.ts`、`plugin-inventory.ts`、`GET /api/plugins/inventory`、38 份 locale 元数据 |
| P1 | 完成（DEV-000647） | 设置中心「内置插件」只读页；侧栏插件中心的重复提示与内置目录卡已移除 |
| P2 | **完成（DEV-000648 / 000649 / 000651 / 000659）** | 38 个插件全部是 Loader 条目；多插件包用默认导出的组合 bundle（`web` / `goal` / `compaction` / `agent-profile`）；`sandbox` 默认导出改为只挂策略，本地沙箱仍由根上下文提供 |
| P3 | **完成（DEV-000659）** | 设置页每张卡展开后可「启用 / 停用」：写 profile 的 `builtin-disabled.json`，随即 `entry.update({disabled})` 让 Loader 装载或卸载；启动时联线插件应用该清单 |
| P4 | **完成（DEV-000650）** | 手写目录 `INSTALLABLE_PACKAGES` / `buildCatalog` 已删除；安装记录改用包内 locale 元数据生成清单；新增 `plugin-locale-meta` 门禁（38 个插件包必须有双语 locale meta） |

P2/P3 已完成：清单与启停都以 Loader 为唯一真相。剩下的收尾是把「停用」的入口从卡片展开区提升到更显眼的位置（如果需要），以及删掉 `PluginManager` 里已无调用者的 `enableBuiltin` 旧路径。
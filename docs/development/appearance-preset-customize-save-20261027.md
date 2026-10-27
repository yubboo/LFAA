# 外观预设自定义与恢复默认体验合同（2026-10-27）

<a id="lfaa-appearance-preset-customize-save-20261027"></a>

## 用户目标与 Owner

- 用户希望内置预设可以作为可编辑的起点：应用后在外观设置中调整，返回预设页另存为个人预设；也能一键恢复常规默认，提升预设使用的灵活性。
- 现有能力 Owner：`packages/client/ui-settings` 管预设界面；`packages/util/values` 提供内置快照；`packages/settings/settings` 通过账户 `appearance.presets` 持久化个人预设，并原子应用 Appearance 与白名单 General 布局字段。
- 设置：沿用 `appearance.presets`、现有 Appearance 与 General 字段。不得新增设置、覆盖内置模板或重置用户的非视觉偏好；导入/导出和账户素材合同不变。

## 实施批次与验收

### B1：明确“应用—调整—另存”与恢复默认

- 在预设页说明：内置预设只是起点；应用后可进入外观设置自由修改，再保存当前外观为一条个人预设，原内置项不会被覆盖。
- 将“常规默认”内置模板的应用操作清楚标为恢复默认。它精确应用共享默认的 Appearance 与预设范围内的 General 布局项，其他账户设置与个人预设库保持原值。
- 增加直接 UI 回归，覆盖提示文案与默认模板恢复入口；现有 Settings Owner 回归继续验证快照范围与个人设置保留。
- 运行定向回归、Client 类型检查、ui-settings/正式 Web 构建、差异检查；在正式 Web 当前源码服务上使用 ChatGPT 内置浏览器检查外观预设桌面与窄屏页面。不得写入真实账户或触发真实数据操作；实页修改只使用隔离数据。

## 实施与验证记录

- 开始前确认：已有“保存当前外观”会把编辑后的状态作为新个人预设保存；标准内置预设已精确映射共享默认值。此次聚焦于让流程和恢复入口更容易发现，不复制另一套预设编辑器或设置存储。
- B1 实施：预设页说明“内置模板 → 外观设置继续调整 → 保存当前外观为我的预设”，明确原模板不会被覆盖；`builtin-standard` 卡片按钮显示“恢复默认”。其应用仍由 Settings Owner 精确恢复快照内 Appearance 与视觉布局字段，其他 General 偏好与个人预设列表原样保留。
- 定向回归 `client-appearance-presets.test.mjs` 与 `appearance-preset-owner.test.mjs` 6/6 通过；`pnpm --filter lfaa-client-ui-settings build`、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm run build:web` 和 `git diff --check` 通过。正式 Web 构建输出在仓库根 `dist/apps/web/`。
- 复核构建：定向回归 `client-appearance-presets.test.mjs` 与 `appearance-preset-owner.test.mjs` 6/6 通过；`pnpm --filter lfaa-client-ui-settings build`、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm run build:control-plane`、`pnpm run build:web` 和 `git diff --check` 通过；Web 与 Control Plane 输出均在仓库根 `dist/`。最终 `node scripts/runtime-build-state.mjs web` 返回 `[]`。
- 实页验收：使用当前仓库正式 Web 入口及 `dist/.tmp/appearance-presets-acceptance/home` 隔离数据，在 ChatGPT 内置浏览器打开 `http://127.0.0.1:3000/settings?section=appearance`。页面展示应用—调整—另存提示、5 款内置预设、“常规默认”卡片的“恢复默认”入口和 0/20 自定义预设状态；未点击应用、保存或导入，不改动任何真实账户偏好。截图证据留在本轮内置浏览器记录：默认视口 1280×720，双列卡片；窄屏 390×844，导航收起、预设单列、按钮可达且未见横向溢出。最后恢复默认浏览器尺寸并将预设页留在窗口中。
- 启动限制：正式入口命令曾以退出码 1 报告 `127.0.0.1:3000 已被占用`，但随后由该入口创建的控制端 PID 监听 3000，`/api/health` 返回 200、`persistence=ready`，实页成功渲染。服务在构建期间退出后重启并完成目视验收；最终健康检查时服务再次退出，已加载的内置浏览器页面仍保留显示，但刷新需要重启服务。启动器返回码/端口判断与实际服务状态不一致的问题保留为独立现象。
- `pnpm run check:workspace` 上次未通过，共 9 项：Client/Host 路径映射及包清单待同步、两张既有临时截图链接缺失，以及三个先前合同锚点不存在；本合同的索引锚点无报错。该 Gate 未在本次实页复验后重跑，也未为本任务清理无关问题。
- 未测范围：未在真实账户上应用预设或保存个人预设；未用窄屏做偏好写入；未测桌面打包版及设备帧时间。导入导出及 Owner 精确恢复行为由本轮既有定向回归与预设库合同覆盖，本次目视验收未重复操作。

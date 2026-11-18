# DEV-000012｜设置中心升级与苹果液态玻璃外观系统

- 任务编号：000012
- 开始时间：2026-11-17 19:50:17 +08:00
- 完成时间：2026-11-17 19:59:15 +08:00
- 类型：feat
- 状态：完成（`typecheck`、`build` 及桌面端/手机端内置浏览器全流程验收通过）
- 审批级别及批准证据：A0/A1（负责人提供 3 张参考图要求升级设置中心与外观高级能力，并指定苹果液态玻璃背景与光学质感）
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：
  - 参照参考图升级左二设置中心侧栏（搜索过滤框 + `个人 / 集成 / 编码` 分组目录），未接入设置项保持透明状态展示。
  - 升级中央“外观”设置页，新增主题预设与 JSON 导入/复制、强调色下拉与自定义色板、背景/前景色值编辑与取色、字体切换，以及可展开的“高级”面板（界面/代码字号、减少动态效果、浅/深色独立配置、字重、内容/代码字体、半透明侧边栏、对比度滑块、差异标记、指针光标）。
  - 构建苹果液态玻璃（Liquid Glass）视觉体系：柔和一两种主色暗调/柔雾背景（压低文字下方亮度）、毛玻璃模糊与增色（`blur + saturate`）、轻微叠白高光、顶边亮边与内描边折射感。
- 不在范围：伪造后端账户/计费/云电脑服务数据、改动 `G:\lfaa` 备份目录。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 新增文件 | `packages/ui/layout/client/appearance-types.ts` | 定义主题预设、强调色盘、字体栈、高级设置类型及配置校验工具 |
| 新增文件 | `packages/ui/layout/client/settings-catalog.ts` | 定义设置中心 `个人 / 集成 / 编码` 三组目录与中英文映射 |
| 修改文件 | `packages/ui/layout/client/navigation.ts` | 支持 `appearance` 与 `settings:*` 动态设置路由 |
| 修改文件 | `packages/ui/layout/client/useAppearance.ts` | 注入主题变量、液态玻璃开关、字体/字号/对比度/减弱动画/指针光标状态及 JSON 导入导出 |
| 修改文件 | `packages/ui/layout/client/locales.ts` | 317 行（中英文对照字典，≤ 500；集中维护无重复）；补充完整外观与高级设置文案 |
| 修改文件 | `packages/ui/layout/client/components/NavigationIcon.tsx` | 新增 `IconCopy`（`copy`）与 `IconDownload`（`import`）图标 |
| 修改文件 | `packages/ui/layout/client/components/SettingsMenu.tsx` | 实现带实时搜索过滤的分组设置菜单 |
| 修改文件 | `packages/ui/layout/client/components/SettingsMenu.module.css` | 设置搜索框与分组列表液态玻璃样式 |
| 新增文件 | `packages/ui/layout/client/components/AccentSelect.tsx` | 实现强调色下拉与自定义取色器，通过 `createPortal` 挂载至 Shell 容器避免被毛玻璃卡片 `backdrop-filter` 形成包含块导致定位偏移与裁切 |
| 新增文件 | `packages/ui/layout/client/components/AccentSelect.module.css` | 强调色触发胶囊与液态玻璃下拉列表样式 |
| 新增文件 | `packages/ui/layout/client/components/AppearanceAdvanced.tsx` | 拆出“高级”设置子面板（字号、动态效果、独立明暗、字重/字体、半透明侧边栏、对比度、差异标记、指针光标） |
| 新增文件 | `packages/ui/layout/client/components/AppearanceAdvanced.module.css` | 高级设置数值框、分段器、开关与滑块样式 |
| 修改文件 | `packages/ui/layout/client/components/AppearanceSettings.tsx` | 292 行（≤ 400；已拆分 `AccentSelect` 与 `AppearanceAdvanced`）；实现模式胶囊预览、主题导入/复制、强调色、背景/前景、字体与高级折叠区 |
| 修改文件 | `packages/ui/layout/client/components/AppearanceSettings.module.css` | 283 行（≤ 400）；实现液态玻璃卡片、模式缩略预览与窄屏自适应 |
| 修改文件 | `packages/ui/layout/client/components/WorkbenchShell.tsx` | 289 行（≤ 400）；接入 `findSettingsCatalogItem` 与完整 `appearance` 控制器 |
| 修改文件 | `packages/ui/layout/client/components/WorkbenchShell.module.css` | 376 行（≤ 400；Shell 统一承载全套明/暗/液态玻璃/对比度/环境光 CSS 变量）；定义柔和双色氛围背景与模糊/增色/叠白/亮边/折射变量 |
| 修改文件 | `packages/ui/layout/client/components/NavigationRail.module.css` | 254 行（≤ 400）；应用液态玻璃侧栏与浮层质感 |
| 修改文件 | `packages/ui/layout/client/components/NavigationSidebar.module.css` | 302 行（≤ 400）；应用液态玻璃背景与模糊增色 |
| 修改文件 | `packages/ui/layout/client/components/ContextPanel.module.css` | 应用右侧栏与上下文卡片液态玻璃质感 |
| 修改文件 | `packages/ui/layout/client/components/UserMenu.module.css` | 浮层应用液态玻璃模糊、叠白与亮边 |
| 修改文件 | `packages/ui/layout/client/components/AppMenu.module.css` | 更多菜单应用液态玻璃模糊、叠白与亮边 |
| 修改文件 | `packages/ui/layout/client/components/SearchDialog.module.css` | 搜索弹层应用液态玻璃模糊、叠白与亮边 |
| 修改文件 | `apps/web/src/app.css` | 绑定全局界面字号、字体、字重、对比选区、指针光标与减弱动态效果属性 |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-0LFDp3O4.css`、`apps/web/dist/assets/index-D6LjerXP.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000012-20261117-1959-liquid-glass-appearance-and-settings.md` | 记录本轮功能新增、Portal 定位修复及多端验收 |
| 新增文件 | `docs/updata-log/000012-20261117-1959-liquid-glass-appearance-and-settings.md` | 记录设置中心与苹果液态玻璃外观功能 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm run typecheck` | 通过 | `apps/cli`、`apps/web`、`@lfaa/ui-layout`、`@lfaa/workspace` 全部通过（`createPortal` 修复后复测通过） |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6611 个模块，耗时 `838ms` |
| 内置浏览器验收（`http://127.0.0.1:5173/`） | 通过 | HTTP 200，全程 0 条控制台/页面错误：<br>- **桌面 `1440×900`**：设置侧栏搜索过滤（输入“通知”精确筛出、清空恢复）、分组目录渲染、主题预设切换（`LFAA 液态玻璃` / `静谧夜蓝`）、强调色切换、浅/深色切换、`高级` 展开及 `半透明侧边栏` 开关实时切换 `data-glass-sidebar` 均正常；经 `createPortal` 修复后复测 `强调色` 下拉菜单紧贴触发按钮下方 `6px` 展开（`y=368.77..659.45 <= 900`），右边缘对齐误差 `-0.01px`，9 个选项完整无裁切。<br>- **手机 `390×844`**：展开“高级”面板后整页宽度 `390px`，28 个交互控件全部在 `10.50px..356.83px` 范围内，零横向溢出 |

## 风险、回滚与遗留问题

- 风险：设置中心中除“外观”外的 24 项目录目前为真实未接入占位，点击后均在工作区展示诚实的“暂未接入”说明，后续需随业务插件逐步接入。
- 回滚办法：删除新增的 6 个文件与本轮两份日志，恢复已修改的 `packages/ui/layout/`、`apps/web/src/app.css` 文件后重新运行 `pnpm run build`。
- 遗留问题：无已知阻塞问题。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：新增设置中心分组搜索与苹果液态玻璃外观系统，已新增同编号 `updata-log`。

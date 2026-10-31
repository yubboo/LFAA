# 文件管理响应式窄栏操作区整理

<a id="lfaa-file-manager-responsive-toolbar-20261031"></a>

## 用户目标与验收

- 根据用户截图修整 `/files` 中间栏红框区域：收纳路径与回收站/操作记录，稳定排列搜索、筛选、刷新、新建和上传。
- 所有现有操作继续直接可见、文案可读、顺序符合页面 DOM/键盘顺序；窄栏内不出现单独掉行的按钮、水平溢出或小于现有触控目标的操作。
- 目录导航、搜索提交、筛选、刷新、创建、上传、回收站和操作记录行为保持原 Owner 与权限合同；不写入真实文件、不改用户偏好。
- 使用当前 checkout 启动正式 Web，在 `/files` 检查桌面和窄分栏/短屏的实页渲染、相关按钮可达和相邻列表/目录树行为，并记录截图及未测边界。

## Owner、设置与修改范围

- 页面结构及容器响应式样式由 `packages/client/ui-sidebar-files/src/FileManagerPage.tsx`、`FileManagerPage.css` 持有；包构建与共享装配仍归 `lfaa-client-ui-sidebar-files`。
- 文件数据、读写能力和操作授权继续由现有 Files/Connection/Host Owner 校验；本轮只改变控件分组与布局，不改变 API、持久化、权限或数据范围。
- 外观继续消费 Workbench 注入的 Settings/Theme 配置：主题、强调色、字体/字号、对比度、区域背景遮罩/模糊、壁纸及减少动态效果。布局不新增 CSS 自定义属性和设置项，不重置 DockKit 尺寸/开合偏好。
- 允许范围：文件页标题下路径与快捷操作行、目录面包屑行、搜索及目录操作区的语义包装/容器查询、对应响应式回归和任务记录。禁止改动相邻列表、目录树、后台执行、其他应用或主题 Owner。

## Skill 前置与设计判断

- 六项必需 UI Skill 均从当前用户 Codex Skills 目录读取：`design-taste-frontend`、`impeccable`、`audit-skills`、`ui-motion`、`ui-ux-pro-max`、`baseline-ui`。本页是 Operate 型文件工具；沿用 LFAA 现有深色/强调色、字体和 Ant Design 控件，按容器把相关操作排成一致网格。
- Taste app-screen 的 `data-terminal` 是最接近的暗色开发工具列表参考；只采纳搜索占满窄栏、操作集中成组的结构建议。其 1px 强调线整套风格和更换色板/字体会超出用户的局部整理范围，继续采用 LFAA 现有外观。
- Impeccable 的布局审查关注操作分组、节奏、容器变化及键盘顺序；安全审计技能只支持 Java/.NET/PHP，TypeScript/CSS 不声明专项审计，仅复核本轮没有改变权限调用链。UI Motion 本轮不加动效。UI/UX Pro Max 复核文本重排、目标尺寸与窄容器不裁切；Baseline UI 复用现有 Ant Design 原语，不引入 Tailwind、动画库或第二套控件。
- 已完成独立视觉方向提问，用户选择“保留全部操作，改成紧凑对齐的几行”。

## 修改前检查

- 截图中的阅读顺序是存储路径与回收站/记录、目录位置、搜索、筛选/刷新/新建/上传；操作区使用 flex 自然换行，窄栏下“上传”独自落到下一行，其余按钮宽高和空隙不成组。
- 主次关系调整为：路径与页头快捷项同组，面包屑独立一行，搜索占完整一行，四个目录操作在同一规则网格；很窄时改为两列。只在必要宽度下重排，不降低字号或触控高度。
- 页面实际容器由 `file-manager` 容器查询控制。回归目标包含触发宽度边界、用户放大字号下的标签可读/无溢出，以及列表与目录树相邻行为保持。
- 基线由本轮用户截图和当前 JSX/CSS 核对；Impeccable `detect --json --scope layout` 编辑前对 `FileManagerPage.tsx`、`FileManagerPage.css` 返回 `[]`。

## 分批记录

### 批次 1：窄栏快捷操作分组

- 实施：待记录。
- 定向回归、类型与构建：待记录。
- ChatGPT 内置浏览器：待记录（桌面及窄分栏/手机短屏）。
- 设置、权限、性能与未测范围：待记录。

# `lfaa-client-ui-dockkit`

本包提供 Web/Desktop 共用的布局组件 `ResizableWorkbench`，只负责区域几何、容器响应式模式、分隔条交互、收起吸附与底部区域排布。业务页面通过 `leading`、`left`、`center`、`right` 插槽提供同级内容区域，并可为每个区域传入独立 class；`overlay` 用于放置不参与列宽预算的浮层。

公共样式放在 `src/css/`，由 `common.css` 汇总导入：`common-layout.css` 管容器与区域定位，`common-pane.css` 管折叠状态，`common-pointer.css` 管拖动与分隔条，`common-bottom.css` 管底部区域交互，`common-responsive.css` 管 Compact/Mobile 排布。这里不设置页面内容区的背景、文字色、边框或阴影；每个 UI 包在对应页面 CSS 中定义自己的盒子外观。

`ResizableWorkbench` 的尺寸、拖动和开合状态默认按 `storageKey` 保存在本机。临时工作区可传入 `persistState={false}`，使布局不读取或写入 `localStorage`；容器首次测量完成后使用真实尺寸计算初始栏宽，用户手动调整后只在当前组件实例内记住。

局部可调整尺寸的 Client 组件复用 `src/ui-resize/use-pointer-resize.ts`。它负责 Pointer 捕获、按动画帧合并拖动增量，并在释放、取消、失焦、页面隐藏或卸载时完成清理；调用方负责尺寸约束及布局更新。不要在表格或其他组件内另写 Pointer/RAF 生命周期。

常规使用者默认在 Mobile 将左右侧栏作为 Overlay。应用工作区可启用 `responsiveLeftDock`：当容器宽度至少达到中心区最小宽度、左栏最小宽度和分隔列之和时，左导航进入 Grid 并推动中心区；不足时仍使用 Overlay。`responsiveRightDock` 仅控制右侧 Dock；Compact/Mobile 右栏在右栏、当前 Surface 声明的最小中间区与分隔条可共存时，沿用与 Desktop 相同的 Grid、标准分隔条和拖拽 Owner，打开后推动中间区且不低于其最小宽度；空间不足时回退到共享的可拉伸 Overlay。Overlay 不改写已记忆的右栏宽度。Desktop 仍沿用原有两侧宽度预算。

Mobile Overlay 侧栏根据布局根节点的可用宽度铺展，并保留 12px 的另一侧内容间距，最大宽度为 320px；极窄容器下不使用固定的 240px 最小宽度挤压剩余内容。尺寸由共享布局组件计算，不覆盖使用者保存的桌面侧栏宽度。

Mobile 左侧 Overlay 从工作台顶边开始展开；右侧 Overlay 仍避开所属 Surface 的顶栏。左侧栏没有额外的顶栏占位行。

布局断点首帧在布局提交前同步测量工作台真实外框，之后由 `ResizeObserver` 尺寸变化更新，不依赖浏览器窗口宽度；这避免内嵌窄分栏短暂沿用整窗宽度而错排。样式使用共享外观令牌，不创建主题或设置副本。

`ApplicationWorkspace` 启用 `responsiveRightDock` 时，AI Work 中间区在 Desktop/Compact/Mobile 使用 300px 下限，右栏最大值允许覆盖该容器剩余宽度并在拖动时由动态预算保护中心下限。启用中心列吸附时，阈值按“中心列 + 右 Dock”的完整可用宽度计算，不受右 Dock 自身静态最大值截断；收起中心列后右 Dock 才接管容器剩余空间。AI Work 左栏使用专属最大值规则（比例 0.26、320px 下限、440px 上限），其最小值、默认初始宽度和用户持久化格式不变。上述左右栏规则只用于这一模式；未启用它的 Settings、Plugin Manager 等共享 Surface 保留通用宽度计算。

中心列普通拖动到 `minCenterWidth` 后保持该宽度；可选 `centerCollapseEnabled` 会让右 Dock 在中心下限后继续累积超拖，达到统一 `snapCaptureRatio` 阈值才进入中心吸附预览，未达到阈值松手仍保持中心下限。`onCenterCollapsePreviewChange` 只在进入/退出阈值和手势结束/取消时通知调用方，不跟随每帧尺寸变化；页面可在按住期间即时展示吸附目标。吸附后同一手势可反向拖回，释放收起时由 `onCenterCollapsedChange` 通知调用方，中心列归零后由右侧 Grid Dock 接管剩余空间；Overlay 模式不启用该手势。中心折叠状态由 `centerCollapsed` 受控，应用标签/路由仍由上层工作区管理；吸附收起不会改写已保存的右 Dock 宽度。未启用 `centerCollapseEnabled` 的 Settings、Plugin Manager 等共享 Surface 继续将中心最小宽度作为硬保护。

分隔条拖动先等待 3px 指针位移，纯点击不会开始拖动、提交宽度或截断布局过渡；确认开始拖动时，以侧栏当下的实际显示宽度为起点并冻结过渡。固定布局顺序为左栏、中心区、右栏；左栏向左拖动收窄并向左吸附，右栏向右拖动收窄并向右吸附。吸附预览期间 Pointer Capture 保持到释放，同一次按压中可反向拖回并展开；pointerup 时若仍在吸附预览才提交为完全收起。完全收起并松开后不再接受新的拖动会话，普通点击也不会改变宽度。键盘方向键随轨道边缘调整，Home 收起、End 恢复。中心内容在拖动期间持续按真实可用宽度响应，列宽仍受当前布局最小中心宽度保护。

正常展开、收起和阈值内松手归位共用 180ms 缓出时长，尽快结束窄分栏里中间内容的逐帧重排；侧栏位移与 Grid 列宽共用同一曲线。拖动捕获、反向释放仍使用各自的交互时长，系统减少动态效果时继续遵循既有规则。

Mobile 应用工作区进入左 Dock 时，沿用大屏列顺序：二级导航、标准分隔条、中间区；分隔条使用同一个 1px 布局轨道、扩展热区和拖动方向，触屏仅常显这条标准分隔线以便发现。该模式向右拖动或按向右键加宽二级导航；桌面及其他 Surface 保持原有交互。

Mobile 左 Dock 或右 Dock 已为终端分配独立 Grid 行时，中间区不会再重复预留同一段底部高度。Overlay 终端模式仍由中间区让出对应高度。

构建输出位于仓库根 `dist/packages/client/ui-dockkit/`。

左栏静态范围与中心区动态预算在同一个尺寸协调 effect 内求交，预算不足最小宽度时只提交一个稳定结果；收起或采用 Overlay 的左栏不占 Grid 预算，保留展开宽度供恢复和 hover 预览使用，避免中心区拖窄/吸附时反复回写栏宽。

2026-10-23：桌面三栏同时展开时，右栏的可用宽度先为左侧第二栏保留设置计算出的最小值，再保护中心列下限，避免历史右栏宽度将左栏压成竖排文字。

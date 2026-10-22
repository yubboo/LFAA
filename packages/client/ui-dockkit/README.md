# `lfaa-client-ui-dockkit`

Web/Desktop 共用的可调整工作台布局 Owner。`ResizableWorkbench` 负责窗格尺寸、容器响应式模式、拖动分隔条、收起吸附与底部 Dock；页面与业务组件通过 Pane 插槽提供内容。

局部可调整尺寸的 Client 组件复用 `src/ui-resize/use-pointer-resize.ts`。它负责 Pointer 捕获、按动画帧合并拖动增量，并在释放、取消、失焦、页面隐藏或卸载时完成清理；调用方负责尺寸约束及布局更新。不要在表格或其他组件内另写 Pointer/RAF 生命周期。

常规使用者默认在 Mobile 将左右侧栏作为 Overlay。应用工作区可启用 `responsiveLeftDock`：当容器宽度至少达到中心区最小宽度、左栏最小宽度和分隔列之和时，左导航进入 Grid 并推动中心区；不足时仍使用 Overlay。`responsiveRightDock` 仅控制右侧 Dock；Compact/Mobile 右栏在右栏、当前 Surface 声明的最小中间区与分隔条可共存时，沿用与 Desktop 相同的 Grid、标准分隔条和拖拽 Owner，打开后推动中间区且不低于其最小宽度；空间不足时回退到共享的可拉伸 Overlay。Overlay 不改写已记忆的右栏宽度。Desktop 仍沿用原有两侧宽度预算。

Mobile Overlay 侧栏根据工作台自身可用宽度铺展，并保留 12px 的另一侧内容间距，最大宽度为 320px；极窄容器下不使用固定的 240px 最小宽度挤压剩余内容。宽度继续由该共享 DockKit 的几何样式决定，不覆盖使用者保存的桌面 Dock 宽度。

Mobile 左侧 Overlay 从工作台顶边开始展开；右侧 Overlay 仍避开所属 Surface 的顶栏。左侧栏没有额外的顶栏占位行。

布局断点由工作台实际容器的 `ResizeObserver` 尺寸决定，不依赖浏览器窗口宽度。样式使用共享外观令牌，不创建主题或设置副本。

`ApplicationWorkspace` 启用 `responsiveRightDock` 时，AI Work 中间区在 Desktop/Compact/Mobile 使用 300px 下限，右栏最大值允许覆盖该容器剩余宽度并在拖动时由动态预算保护中心下限。启用中心列吸附时，阈值按“中心列 + 右 Dock”的完整可用宽度计算，不受右 Dock 自身静态最大值截断；收起中心列后右 Dock 才接管容器剩余空间。AI Work 左栏使用专属最大值规则（比例 0.26、320px 下限、440px 上限），其最小值、默认初始宽度和用户持久化格式不变。上述左右栏规则只用于这一模式；未启用它的 Settings、Plugin Manager 等共享 Surface 保留通用宽度计算。

中心列普通拖动到 `minCenterWidth` 后保持该宽度；可选 `centerCollapseEnabled` 会让右 Dock 在中心下限后继续累积超拖，达到统一 `snapCaptureRatio` 阈值才进入中心吸附预览，未达到阈值松手仍保持中心下限。`onCenterCollapsePreviewChange` 只在进入/退出阈值和手势结束/取消时通知调用方，不跟随每帧尺寸变化；页面可在按住期间即时展示吸附目标。吸附后同一手势可反向拖回，释放收起时由 `onCenterCollapsedChange` 通知调用方，中心列归零后由右侧 Grid Dock 接管剩余空间；Overlay 模式不启用该手势。中心折叠状态由 `centerCollapsed` 受控，应用标签/路由仍由上层工作区管理；吸附收起不会改写已保存的右 Dock 宽度。未启用 `centerCollapseEnabled` 的 Settings、Plugin Manager 等共享 Surface 继续将中心最小宽度作为硬保护。

分隔条拖动先等待 3px 指针位移，纯点击不会开始拖动、提交宽度或截断布局过渡；确认开始拖动时，以侧栏当下的实际显示宽度为起点并冻结过渡。固定布局顺序为左栏、中心区、右栏；左栏向左拖动收窄并向左吸附，右栏向右拖动收窄并向右吸附。吸附预览期间 Pointer Capture 保持到释放，同一次按压中可反向拖回并展开；pointerup 时若仍在吸附预览才提交为完全收起。完全收起并松开后不再接受新的拖动会话，普通点击也不会改变宽度。键盘方向键随轨道边缘调整，Home 收起、End 恢复。中心内容在拖动期间持续按真实可用宽度响应，列宽仍受当前布局最小中心宽度保护。

Mobile 应用工作区进入左 Dock 时，沿用大屏列顺序：二级导航、标准分隔条、中间区；分隔条使用同一个 1px 布局轨道、扩展热区和拖动方向，触屏仅常显这条标准分隔线以便发现。该模式向右拖动或按向右键加宽二级导航；桌面及其他 Surface 保持原有交互。

Mobile 左 Dock 或右 Dock 已为终端分配独立 Grid 行时，中间区不会再重复预留同一段底部高度。Overlay 终端模式仍由中间区让出对应高度。

构建输出位于仓库根 `dist/packages/client/ui-dockkit/`。

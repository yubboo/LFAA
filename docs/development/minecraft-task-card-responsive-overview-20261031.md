# Minecraft 任务状态短文案与总览卡片布局（2026-10-31）

<a id="lfaa-minecraft-task-card-responsive-overview-20261031"></a>

## 用户目标与可观察结果

- 任务卡片在窄容器中把“已完成 / 失败 / 异常 · 结果未确认”缩短为“完成 / 失败 / 异常”，卡片宽时仍显示完整文案；无障碍名称保留完整状态。
- 任务信息留在卡片左侧，状态徽标与查看/取消/删除等已有操作作为一个整体放在右侧；卡片窄时整体移到信息下方，状态在操作上方。
- Minecraft 总览“最近任务”面板横跨仪表盘双栏并保持单列卡片，避免窄列挤压任务标题、说明、状态和操作。
- 不改变任务状态解析、实例/任务数据、操作权限、排序或通知。

## Owner、设置与边界

- 页面入口：任务页 `/games/minecraft/tasks`；Minecraft 总览页 `/games/minecraft` 的“最近任务”面板。
- 唯一界面 Owner：`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx` 内的 `TaskList`；卡片和面板布局由 `packages/client/ui-minecraft/src/MinecraftWorkspace.css` 负责。
- 任务状态继续来自真实 Minecraft 任务快照；本轮只调整展示与布局，不改 Minecraft 领域服务、API、任务数据或任何任务/实例操作。
- 设置沿用 Appearance 的主题、强调色、字号、语义状态色、表面透明度，以及现有 `general.cardMotionEffect` 和 `appearance.advanced.reducedMotion` 映射；不新增/修改设置，不改用户偏好。
- 保留工作区已有改动；不点击任务详情、取消、删除、批量删除或实例启停。

## 验收条件

- 任务卡片足够宽时显示“已完成”“失败”“异常 · 结果未确认”；窄卡片显示“完成”“失败”“异常”。屏幕阅读器标签仍包含完整状态语义。
- 桌面与平板卡片呈信息在左、状态和操作在右；窄卡片改为状态/操作整体置于信息下方、状态在按钮上方。查看详情与删除等按钮不受影响、仍可达。
- 总览最近任务卡片按信息区和状态操作区的职责布局；宽容器不产生多列挤压，窄容器不越界、不遮挡、不产生横向溢出。
- 在 ChatGPT 内置浏览器用当前源码构建的正式 Web 检查 `/games/minecraft/tasks` 和 `/games/minecraft`，覆盖桌面与窄分栏/短屏；记录独立手机设备或手机视口是否实测。运行 Minecraft UI 包、Client 类型检查、Web 构建、运行指纹检查及目标文件 `git diff --check`。
- 不运行自动化测试，除非用户明确要求；不触发实际任务或实例操作。帧时间、实体设备与屏幕阅读器未实测时单独说明。

## 实施与验收记录

- 状态：完成。
- 实现：任务卡使用独立信息区与状态操作区；任务页和总览共用相同任务卡，状态根据卡片容器宽度显示完整或短文案。总览最近任务面板跨越仪表盘两栏，任务列表维持单列。
- 设置接入：不新增或改写设置；继续使用外观设置的语义色、表面透明度、主题/字体映射及卡片动态效果设置。
- 构建与静态检查：`pnpm --filter lfaa-client-ui-minecraft run build` 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；`pnpm run build:web` 通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`；本轮目标文件 `git diff --check` 通过。没有运行自动化测试。
- 内置浏览器实页：正式 Web `http://127.0.0.1:3000`。桌面 1280×720 检查 `/games/minecraft/tasks` 和 `/games/minecraft`：宽卡片保留完整状态文案，任务卡的信息在左、状态和操作组在右，总览最近任务横跨内容区且保持单列。窄分栏仍在 1280×720 外层视口下检查，任务卡实际可用宽度约 350px：任务页“已完成 / 异常 · 结果未确认”显示为“完成 / 异常”，失败显示“失败”；状态与按钮整体置于内容下方并靠右。总览最近任务在窄工作区改为纵向堆叠，显示短状态，无横向溢出或遮挡。对应内置浏览器截图已作为本轮验收记录保留。
- 页面检查只读浏览了任务数据，没有触发任务详情、取消、删除、批量删除或实例启停。两台 Minecraft 实例保持停止，任务队列与执行中数量为 0。
- 性能与边界：本轮只增加 CSS 容器布局与静态状态文案选择，没有轮询、订阅、计时器或新增请求；没有进行帧时间测量。没有实际手机设备或独立 390px 视口验收，窄分栏的约 350px 卡片宽度覆盖了本轮短文案与换行断点。
- 变更文件：`docs/PROMPTS.md` 更新任务索引；本合同记录实现和验收；`packages/client/ui-minecraft/README.md` 说明任务卡及总览的响应式规则；`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx` 提供短/完整状态标签与总览面板标记；`packages/client/ui-minecraft/src/MinecraftWorkspace.css` 负责卡片内布局、容器断点和总览面板跨栏。TSX 文件中另有工作区既存的实例控制台状态徽标修改，与本合同无关且本轮未改动该处。

# LFAA-JAVA-ENVIRONMENT-FORM-LAYOUT-20261026

## 用户问题与目标

- 用户提供 `/games/environments` 页面截图，指出 Java 环境面板存在布局问题。
- 复现表现：中心列变窄、表单切换为竖排时，“其他 Java 主版本”和“已有 Java 可执行文件”的输入控件被拉高，表单及已发现 Java 区域被额外空白撑开。
- 修复仅调整该表单在窄容器下的布局，让输入框保持正常单行高度、按钮和标签紧凑可达，并保留宽容器布局。

## Owner、设置、数据与权限

- 入口：`/games/environments` → `packages/client/ui-layout/src/GameLibraryPage.tsx` → `RuntimeEnvironmentPanel`。
- 布局 Owner：`packages/client/ui-layout/src/GameLibraryPage.css`；Java 安装、登记和检测仍通过现有 Runtime Manager 操作合同。
- 设置审计：没有 Java 表单布局设置；表面、文字、强调色、字体字号与减少动态效果继续读取 Appearance 共享令牌。节点环境存储和 Minecraft 运行时等待预算属于运行配置，不决定此表单的宽度或高度。本次不新增配置、不写入用户偏好。
- 数据与权限：不改变目标设备、运行时状态、安装/登记操作、数据、授权或路由。

## 允许范围与验收

- 允许修改 Java 环境表单的局部响应式 CSS、现有直接布局回归、`ui-layout` README、本合同和 `docs/PROMPTS.md`。
- 根因：窄容器将表单 flex 主轴改为纵向，但标签仍保留横排使用的 `15rem` `flex-basis`，把两个控件容器撑高。
- 窄容器输入控件恢复正常单行高度，不产生横向溢出；宽容器布局及运行环境行为保持有效。
- 运行直接布局回归、Client 类型检查、`ui-layout` 与 Web 构建、`git diff --check`；在 ChatGPT 内置浏览器实测当前源码 `/games/environments` 常用桌面、窄中栏和短屏视口。记录宽高、表单控件尺寸、滚动/溢出、交互可见性和证据；临时视口结束后恢复。

## 实施与验证结果

- `packages/client/ui-layout/src/GameLibraryPage.css` 在游戏库容器宽度不超过 `39rem` 且管理表单转为竖排时，将非工具栏表单标签的 `flex-basis` 重置为 `auto`；桌面横排继续使用原有 `15rem` 基准。
- `apps/cli/tests/client-domain-center-responsive.test.mjs` 增加该断点规则的回归断言；`packages/client/ui-layout/README.md` 记录窄栏控件按内容高度布局。
- 设置：沿用当前 Appearance 共享表面、文字、强调色、字体字号和减少动态效果令牌；无 Java 布局设置，未新增设置或改变账户偏好。环境存储与 Minecraft 运行时等待预算没有参与本次布局改动。
- 数据、权限和运行时动作合同未改。内置浏览器仅读取页面、调整视口/分栏并滚动中心栏；没有执行安装、登记或校验动作。

### 验证记录

- `node --test apps/cli/tests/client-domain-center-responsive.test.mjs`：5/5 通过。
- `pnpm exec tsc --noEmit -p tsconfig.client.json`：通过。
- `pnpm --filter lfaa-client-ui-layout run build`：通过，输出位于根目录 `dist/packages/`。
- `pnpm run build:web`：通过，Web 产物输出位于根目录 `dist/apps/web/`。
- `node scripts/runtime-build-state.mjs web`：返回 `[]`；`git diff --check`：通过。
- ChatGPT 内置浏览器当前源码路由 `http://127.0.0.1:5173/games/environments`：
  - 2048×1114 桌面视口，中心内容 966px，表单横排、输入框约 31px，无页面横向溢出。
  - 1312×1244 窄中栏，中心内容 323px；修复前两行标签各 240px 高、输入框约 124px 高，表单共 592px；修复后标签各 55px、输入框约 31px，表单共 223px，页面可同时显示已发现 Java 条目。
  - 1280×520 短屏，中心内容 224px；输入框约 31px，中心栏纵向滚动可到达路径登记区和已发现 Java 条目，页面无水平溢出。
- 390×740 手机视口，移动布局模式下表单宽 269px、输入框约 31px，页面与 Workbench 均无水平溢出；为目视应用内容，临时收起遮挡中心区的上下文栏，完成后已重新打开。
- 四个视口的页面截图均在内置浏览器验收时观察；该浏览器控制接口未提供截图导出到仓库路径的能力。测试结束已恢复默认 1312×1244 视口及两条分栏宽度 200px/641px，重新打开上下文栏；页面停留在修复后的 Java 表单与设备发现结果可见位置。

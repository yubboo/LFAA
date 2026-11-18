# Dev Log 000052 — 聊天输入栏上方工作位置与项目选择挂载条

- **时间**：2026-11-18 08:43:41 +08:00
- **任务编号**：000052
- **任务目标**：对照参考图实现聊天输入框上方挂载条：展示「此计算机」工作位置入口与「选择项目 / 已选项目名」切换入口，以及各自弹出搜索浮层（工作位置选择、项目实时搜索、直接新建项目并绑定、不在项目中工作）。

## 变更文件清单

- `e:\lfaa\packages\core\chat\client\components\ComposerScopeBar.tsx`（272 行，仅负责输入栏上方挂载条及两个关联弹层，保持单组件内聚且未超 400 行上限）：
  - 导出纯函数 `filterComposerProjects` 支持按项目名称与 `rootPath` 实时过滤。
  - 左侧「此计算机」按钮弹出工作位置浮层：支持过滤、`此计算机`（选中态勾选）与`云端 默认环境`（点击诚实提示暂未接入，不伪造远端执行）。
  - 右侧项目按钮：未选时呈浅胶囊态 `📁 选择项目`；已选时呈紧凑态 `📁 <项目名>`；点击弹出项目浮层，支持顶部 `搜索项目`、可滚动列表高亮及 `✓` 标记、`+ 新建项目` 与 `✕ 不在项目中工作`，支持 Esc 与外部点击关闭。
- `e:\lfaa\packages\core\chat\client\components\ComposerScopeBar.module.css`（231 行）：使用 `ShellTheme` 语义变量实现嵌套挂载条、玻璃浮层与响应式适配。
- `e:\lfaa\packages\core\chat\client\components\ChatWorkspace.tsx`（203 行）与 `ChatWorkspace.module.css`（244 行）：挂载 `ComposerScopeBar` 至输入框顶部、移除底部重复 `<select>`、接入 `projectProvider.renderCreateDialog` 在聊天区直接新建并自动绑定项目。
- `e:\lfaa\packages\core\chat\client\index.tsx`：向 `ChatWorkspace` 透传 `workbench.getSnapshot().projectProvider`。
- `e:\lfaa\packages\core\chat\client\locales.ts`：补充工作位置与项目选择器中英文词条。
- `e:\lfaa\packages\core\chat\tests\chat-lifecycle.test.ts`：新增 `filterComposerProjects` 单元测试。

## 验证结果

1. **单元测试**：`pnpm exec tsx --test packages/core/*/tests/*.ts packages/ui/*/tests/*.ts packages/workspace/*/tests/*.ts` — **28/28 通过**。
2. **类型检查与构建**：`pnpm run typecheck`（12 个工程）与 `pnpm run build`（Vite 构建 `built in 440ms`）均以退出码 `0` 通过。
3. **内置浏览器实测验收（`http://127.0.0.1:5173/`，`1440×900`）**：
   - 控制台报错 `0`，网络错误 `0`。
   - 验证未选状态呈现 `[💻 此计算机]` + `[📁 选择项目]`；打开工作位置浮层可见 `此计算机 ✓` 与 `云端 默认环境 >`，点击云端显示未接入提示；打开项目浮层可见 `搜索项目`、`+ 新建项目`、`不在项目中工作`。
   - 点击 `+ 新建项目` 成功完成创建与目录信任并自动切换为已选项目态，右侧 `Agent 核心能力 -> 手脚 (工具)` 同步更新；测试过滤与点击 `不在项目中工作` 后成功恢复未选态；测试后已清理临时项目并关闭临时 Web 服务释放 `5173` 端口。

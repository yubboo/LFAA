# Browser Accessibility Tree Host 构建类型修复（2026-10-27）

<a id="lfaa-browser-accessibility-tree-host-build-20261027"></a>

## 目标与边界

- 用户目标：修复 Harness 菜单选择完整 Web 后，Control Plane/Harness Host 编译因 Browser Accessibility Tree 类型处理而失败的问题。
- 运行入口：Windows 工作台菜单 `2` → 默认完整 Web `1` → `pnpm run build:control-plane`；入口会完整编译 Control Plane Host，成功后才继续 Web 构建和启动。
- Owner：`packages/browser-use/browser-use` 持有 Browser Snapshot 与无障碍树类型；`tsconfig.host.json` 的严格编译配置核验 Host 的实际消费者合同。
- 设置、数据与权限：不新增设置、不改变用户偏好、权限、认证、数据归属或持久化；无障碍树仍只在当前观察请求中短暂使用。
- 允许：修正无障碍状态的索引赋值类型和 Browser Snapshot 可选字段的精确类型收窄；更新本合同与任务索引；运行 Browser 包与 Control Plane 的直接构建及差异检查。
- 禁止：修改无关功能、放宽 TypeScript 严格选项、改变快照运行时语义、扩大页面数据采集、添加设置或权限门。
- 验收：`lfaa-browser-use` 构建、`pnpm run build:control-plane`、`pnpm run build:web`、Web 构建指纹核验及 `git diff --check`；构建产物只写仓库根 `dist/`。本任务不改 UI，浏览器实页、Provider、Daemon 和帧时间不适用/不测。

## 实施与验证记录

- 实施：`accessibility-tree.ts` 将 `checked/pressed` 与纯布尔状态分组处理，让 `"mixed"` 只进入声明支持该值的状态；`session-manager.ts` 与 `tabbit-provider.ts` 根据最终快照值是否为 `undefined` 决定省略可选字段。`null`、超限降为 `null`、未请求时省略的运行语义保持不变。
- 验证：`pnpm --filter lfaa-browser-use run build` 通过，产物位于根 `dist/packages/`；`pnpm run build:control-plane` 通过，产物位于根 `dist/apps/control-plane/`；`pnpm run build:web` 通过，产物位于根 `dist/apps/web/`；`node scripts/runtime-build-state.mjs web` 返回 `[]`，当前 Host/Web 指纹有效；`git diff --check` 通过。Vite 输出有大于 500 KB 的 chunk 提示但构建成功。未运行单元/集成测试或 Harness 菜单完整服务启动；本次未改变 UI，真实浏览器验收不适用。
- 性能、安全、可维护性：仅修复静态类型合同；不增加运行时工作、订阅、请求、存储或副作用；快照边界和既有 Permission Owner 不变。运行时性能未单独测量。

## 变更文件与职责

- `packages/browser-use/browser-use/src/accessibility-tree.ts`：让状态字段赋值与无障碍节点类型精确对应，保留 `"mixed"` 的支持。
- `packages/browser-use/browser-use/src/session-manager.ts`：仅在最终树快照值已定义时加入可选字段。
- `packages/browser-use/browser-use/src/tabbit-provider.ts`：为 Tabbit 快照使用相同的可选字段收窄规则。
- `docs/PROMPTS.md`：记录本次任务状态和验证结果。
- `docs/development/browser-accessibility-tree-host-build-20261027.md`：记录修复范围、Owner、验收边界与证据。

# LFAA Repository Skeleton Maintainability

<a id="lfaa-repository-skeleton-maintainability-20261112"></a>

## 用户问题与目标

用户反馈项目骨架不好维护，并同意先优化入口级包依赖视图、整理清单导航、核查静态扫描发现的未引用包。降低读者回答“这个运行入口实际装配哪些能力、哪些目录只是源码/工程支持”所需的检索成本。

## 运行入口与 Owner

- Web 界面：`apps/web`，静态客户端包由 Web 构建读取。
- 控制端：`apps/cli`；`apps/cli/config/profiles/{web,desktop,daemon}/package.json` 选择 Profile，Profile 引用 `packages/bundle/*/cordis.patch.yml` 中的能力包。
- 独立节点：`apps/daemon`，直接依赖 `lfaa-daemon-app` 与共享启动器。
- 桌面外壳：`apps/desktop-electron`、`apps/desktop-tauri`；本轮不改变打包或运行行为。
- 工作区目录、包入口和生成清单的 Owner 为 `scripts/harness-workspace.mjs` 与 `scripts/check-workspace.mjs`；Profile 与 Bundle 清单仍是装配事实的唯一源。

## 设置、数据与权限边界

- 不涉及设置中心配置、账户/项目/节点数据、凭据、权限策略或真实服务状态。
- 不改变 Profile 内容、插件顺序、包公开入口、依赖关系、构建产物路径或产品运行树。
- 不移动、删除、合并包，不添加运行时抽象或依赖。静态无消费者只形成核查结果，不作为删除依据。
- 生成报告只证明源码中的声明，不证明运行时加载、功能可用或宿主实测。

## 允许范围

- 扩展现有工作区检查器和生成式清单，记录 App 入口、Profile、Profile 选择的 Bundle、Bundle 直接声明的插件/包、必需标记及可解析的工作区依赖。
- 核查静态扫描提示的候选包，区分 Profile 装配、源码依赖、工程期/测试期支持和没有当前产品消费者的源码实现。
- 在系统架构和开发导航中加入生成入口图链接；保留既有任务合同与产品事实，不批量搬动历史文档。
- 添加工作区 Gate 指出的三个缺失合同锚点，不改写其合同内容。

## 可观察验收条件

1. 从当前 Profile `package.json` 与实际 Bundle patch 生成入口关系；不手写第二份 Bundle/包名单。
2. 检查器验证 Profile 引用的 Bundle、Bundle 声明的工作区包均可解析；外部插件与工作区包分别标识。
3. 清单明确区分静态导入、Profile 装配、源码实现、占位、测试/工程支持；不把目录存在或静态声明说成运行验收。
4. 对候选包逐项给出证据与结论；没有充分迁移/退役证据时保留源码和行为。
5. 文档入口指向生成报告，生成内容与工作区/Bundle/Profiles 当前源码一致。

## 实施与验证记录

已完成。生成 [运行入口与包装配图](../workspace-entry-map.md)，并从[系统总体架构](../系统总体架构.md)与[包清单](../harness-packages.md)提供入口。`docs/harness-packages.json` 现区分代码导入、测试引用、package.json 消费关系和 Profile 角色；Workspace Gate 会校验 Profile Bundle 与 LFAA 插件包引用。

当前声明概况：Web 与 Desktop Profile 各选 3 个 Bundle、164 条插件声明、190 个 workspace 依赖闭包包；Daemon Profile 选 1 个 Bundle、1 条插件声明、28 个 workspace 依赖闭包包。三个 Profile 的包名、顺序和依赖集合均从源码生成，闭包按 Bundle 插件包的 `dependencies` 与 `optionalDependencies` 递归计算。

静态消费者核查结论：

- 四个 Bundle（`lfaa-base`、`lfaa-web-app`、`lfaa-desktop-computer-use`、`lfaa-daemon-app`）由 Profile 明确选择，原先扫描结果将它们误列为无消费者。
- `lfaa-client-file-upload` 只在 CLI 测试中被引用；其 README 说明输入框接线尚未完成。保留源码。
- `lfaa-compaction-image-offload` 与 `lfaa-compaction-tool-result-pruner` 未发现产品源码、清单、Profile、Bundle 或测试消费者；目前仍随控制端运行树打包。缺少退役/替代合同，保留并标为后续接入或排除核查项。
- `lfaa-sdk-client` 只在 CLI API 测试中被引用；README 定义了独立 SDK 用途，保留。
- `lfaa-typert-generator` 已由 `runtime: false` 和 account-controller 的工程依赖标明为工程期包；`lfaa-test-support-api` 由 CLI 测试依赖使用。

本轮同时修复了 3 个现存任务合同的显式锚点，恢复工作区 Gate 的引用检查；合同正文未改。首次 `pnpm run sync:workspace` 报出这 3 个缺失锚点，修复后再次同步通过。

验证：`node --check scripts/check-workspace.mjs`、`pnpm run sync:workspace`、`pnpm run check:workspace`、`git diff --check` 均通过。未新增或运行产品测试，未运行产品构建；本轮只改工程清单和文档，没有运行时行为、设置、数据或权限变化。真实 Profile 插件加载及 Web/Daemon/Desktop 宿主验收未执行，也不由静态入口图推断通过。

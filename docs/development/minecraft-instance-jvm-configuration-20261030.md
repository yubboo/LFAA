# LFAA-MINECRAFT-INSTANCE-JVM-CONFIGURATION-20261030

## 目标

把实例概览中的“运行环境”内容改为真实可保存的 JVM 参数编辑器。实例卡展示当前 Java/core，提供推荐、高性能、低内存和自定义配置；参数由实例 Owner 持久化，并由目标 Daemon 启动当前实例时实际消费。该区域不展示 Java 下载或安装入口。

## Owner 与配置边界

- 实例状态、Java 版本、最大堆、JVM 参数归 `packages/games/minecraft` 的 Minecraft Service；数据库归 `packages/storage/storage-sqlite`；运行参数由 `packages/host/daemon` 与 Sandbox Host 消费。
- `lfaa-util-values/src/minecraft-jvm-contract.mjs` 是纯值参数合同的唯一 Owner，供 Minecraft Service、Daemon 和界面共用；允许项不含任意主类、JAR、argfile、Java agent 或系统属性。
- 参数修改须管理员身份、节点在线、实例已停止或错误且无活动任务。单次事务保存内存上限、初始堆和已验证参数；启动/重启从事务内读取同一份最新值。
- 目标 Daemon 使用实例当前选择的 Java 对保存参数运行有时限的 `-version` 预检；JVM 拒绝参数时启动器不派生服务端进程。Native 与 AppContainer 启动使用同一组参数。
- 不新增设置中心字段。实例堆与参数属实例数据；新实例最大堆初值继续读取现有 `minecraftDefaultMemoryMb`。页面外观继续消费 Appearance、减少动态效果与共享 Minecraft 壁纸令牌。

## 分批实施与验收

1. 添加纯值 JVM 参数解析/约束、SQLite 向前迁移、Minecraft API 保存路径，以及仅在实例停止时的写入合同。验证缺失字段旧数据迁移、无效/不支持参数、堆上下限、忙碌/运行实例拒绝与成功回读。
2. 将保存的最新值接入 Native 和 AppContainer 启动，并为目标 Java 增加有界 `-version` 预检；验证参数位置位于固定服务端入口前、未知参数/预检失败时不启动服务端、原生命周期和安全停止合同不变。
3. 把实例概览红框改为深色 LFAA 风格的紧凑参数预设与编辑器；检查桌面和窄屏布局、保存/刷新恢复、只读及运行中禁用状态，不触发实例启停或配置写入。

Paper 的旧版 GC 参数仅针对 Paper 且 Java 8–16 可选择，参考 Paper 官方 Aikar 参数文档；现代 Java 优先显示 JVM 默认配置。预设会排除官方文档提示可能受高磁盘延迟影响的共享内存选项及会预先触碰全部堆页的选项。预设不承诺具体 TPS/GC 性能提升；低内存项只降低启动初始堆，保留最大堆上限并明确其 GC 频率权衡。

Web 实页路由为 `/games/minecraft/instance/<实例 ID>/overview`，覆盖桌面、窄分栏/手机视口；源码回归、类型检查、构建与真实页面证据分别记录。不得为了验收改动用户偏好、实例参数或启动真实 Minecraft 服务端。

## 运行中发现的实例管理页回归

用户报告实例安装与启动成功，但打开具体实例概览时工作区显示 `Cannot read properties of undefined (reading 'join')`。崩溃点位于 JVM 设置视图对该实例 `jvmArguments` 的直接读取。修复必须继续按 URL 中的实例 ID 读取/展示该实例自己的核心、版本、Java、堆与参数；不得回退到第一张卡片、默认核心或其他实例数据。若运行中的 API 返回不完整对象，隔离 JVM 编辑区并给出可恢复错误，保留同页其他实例操作；不得以空值保存覆盖可能存在的参数。

回归条件：两个核心/运行环境/内存/参数不同的实例分别打开时，显示与保存只绑定各自 ID；当前实例数组或 JVM 字段缺失时页面不崩溃、不串用另一实例数据、不允许写回；正常完整响应及新建的空参数数组仍可编辑。

## 实施记录

- 本轮内置浏览器分别打开 CatServer 实例 `bd7c58bb-a1e1-4d20-b7f6-d66f23841e2d` 与 Paper 实例 `17e265c3-a9a8-419b-b43c-ae4592d2480d`。概览各自显示 CatServer/Java 8/4096 MB/25566 与 Paper/Java 11/4096 MB/25565；没有点击保存、启停服务器或改动实例数据。
- 不完整字段保护、两个核心各自渲染、路由 ID/编辑器 key/保存 ID 绑定回归均通过；TypeScript 与 Web/Control Plane 构建通过。窄视口在本轮未重复验收。
- 已在目标实例 `17e265c3-a9a8-419b-b43c-ae4592d2480d` 的概览 `/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/overview` 完成实页验收。实例原配置为 Xms 1024 MB、Xmx 4096 MB、无额外 GC 参数；没有点击保存、启停服务器或改动实例数据。
- 推荐预设在本地编辑草稿中显示 4 项 Paper 旧版 G1 参数；高性能预设的参数集通过该实例使用的 Temurin 11 `java.exe -Xms1024M -Xmx4096M ... -version` 实测，退出码 0。启动器还会在真正启动前用实例选定 Java 做有界预检；拒绝参数时不创建服务端进程。Paper 官方建议现代 Java 17 及以上先使用默认 GC，并列出 Aikar 参数及各自用途；界面把易受磁盘延迟影响的共享内存项和启动时预触全部堆的选项排除在预设外。[Paper Aikar 参数文档](https://docs.papermc.io/paper/aikars-flags/) [Paper 启动脚本生成器](https://docs.papermc.io/misc/tools/start-script-gen/)
- 实例 ID 与不完整字段回归覆盖：具体 ID 查找、编辑器按 ID 重置/绑定、缺少 JVM 字段时保护性错误且不出现保存控件、当前实例自身 core/Java/堆/参数展示。
- 内置浏览器实际路由在 1750×1244 和 1440×900 桌面视口及 390×600 手机/短屏视口查看。桌面无横向溢出；390×600 下工作区主栏可纵向滚动，JVM 编辑器与摘要自动单列，卡片内宽约 295 px、编辑区域约 261 px、无横向溢出，滚动后保存操作可达。点击推荐预设后参数与摘要更新；离开并重新进入后恢复真实已保存值，保存按钮禁用。
- 验证通过：Minecraft JVM/启动/多核心相关回归 25/25；JVM 设置实例隔离回归另行运行；Web 与 Control Plane 构建、TypeScript 检查、`cargo check --manifest-path native/system/Cargo.toml`、`git diff --check`。浏览器控制台只保留组件调整前的两条 `InputNumber addonAfter` 历史弃用提示；调整后页面使用 `Space.Compact` 的单位输入方式。实际 Minecraft 启动未用于验收，Java 参数预检和“参数被目标 Java 拒绝则不派生服务端”的回归覆盖启动安全边界。

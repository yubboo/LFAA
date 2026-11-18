# Update Log 000056 — 资料库与资产库上线，支持设置中心存储路径切换与无损迁移

- **编号**：000056
- **时间**：2026-11-18 09:19:09 +08:00
- **对应 Dev Log**：[000056-20261118-0919-library-assets-and-storage-migration.md](file:///e:/lfaa/docs/dev-log/000056-20261118-0919-library-assets-and-storage-migration.md)

---

## 新功能与体验更新

1. **资料库与资产库（左侧导航「资料库」）**
   - 将「资料库」升级为 **Agent 长期记忆 + Agent 生产产物 + 本地工作区资产** 统一管理中心。
   - 支持按「全部 / Agent 产物 / 本地资产 / Agent 记忆」分类筛选、关键词搜索、导入本地文件、快捷写入长期记忆、预览文本内容、一键复制路径/内容以及打开本地存储目录。
   - 右侧上下文面板同步联动展示当前记忆统计与存储路径状态。

2. **内置 Agent 资料库认知与自动产物归档**
   - 内置 Agent 系统提示词实时注入当前资料库根目录与近期资产索引，清楚了解资料库用途与位置。
   - 为内置 Agent 注册 `list_library_assets`、`read_library_asset`、`save_library_artifact` 与 `save_memory` 工具，后续 Agent 生成的报告、脚本等产物可直接归档至资产库目录。

3. **设置中心 → 存储（路径管理与无损迁移）**
   - 默认存储位置为 `C:\Users\Administrator\.lfaa\data`；支持一键切换至项目推荐目录（如 `E:\lfaa\data`）或用户自定义目录（若路径末尾不是 `data`，自动补全 `\data`）。
   - 切换位置时执行 **Copy-Verify-Switch** 无损迁移：完整复制会话、长期记忆、Agent 产物与本地资产，并校验文件数量与总字节数后热切换生效路径，同时提供迁移校验回执与 5 项存储统计指标。

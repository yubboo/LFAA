# Dev Log 000059 — 修复存储路径动态检测（用户目录/项目根目录）、迁移状态保持及网络失败提示

- **编号**：000059
- **时间**：2026-11-18 09:35:47 +08:00
- **任务名**：`dynamic-storage-paths-and-migration-fix`
- **状态**：已完成修复、单元测试、类型检查、构建与内置浏览器实测验收

---

## 1. 问题排查与根因

1. **项目根目录与系统用户目录静态写死风险**：
   - [server.ts](file:///e:/lfaa/apps/web/src/server.ts) 之前仅依赖 `process.cwd()` 拼接推荐目录；若从子目录或他处启动服务，无法识别 LFAA 项目真正存放的根目录。
   - [StorageSettingsView.tsx](file:///e:/lfaa/packages/core/chat/client/components/StorageSettingsView.tsx) 与 [locales.ts](file:///e:/lfaa/packages/core/chat/client/locales.ts) 的占位/描述文案存在硬编码示例路径 `"E:\\lfaa\\data"`。
   - [storage-manager.ts](file:///e:/lfaa/packages/core/memory/src/storage-manager.ts) 此前在模块加载期静态缓存 `DEFAULT_LFAA_HOME` / `DEFAULT_DATA_ROOT`，且在 `default` 模式下会复用旧 `storage-config.json` 中落盘的 `dataRoot`/`defaultDataRoot`。
2. **UI 状态回弹与 `Failed to fetch` 未生成 `data` 目录原因**：
   - `StorageSettingsView.tsx` 的 `useEffect` 误将 `customInput` 列入依赖并无条件重置 `selectedMode`，导致输入自定义路径或异步刷新后单选状态被重置。
   - 当浏览器页面与后台服务断开（如测试后临时开发服务器已关闭）点击迁移时，[chat-store.ts](file:///e:/lfaa/packages/core/chat/client/chat-store.ts) 中的 `fetchJson` 直接抛出原始英文 `"Failed to fetch"` 且请求未能到达 Host（因此磁盘不会生成 `data` 目录）。
   - 项目根目录下新迁移出的 `/data/` 亦需加入 `.gitignore`，避免随 Git 推送提交大资产。

---

## 2. 实际变更清单

- 修改 [server.ts](file:///e:/lfaa/apps/web/src/server.ts)：新增 `detectAppProjectRoot` 沿 `appRoot` 向上定位 `pnpm-workspace.yaml` / `.git`，使推荐目录与未绑定项目时的回退路径始终自动识别当前项目实际存放位置。
- 修改 [storage-manager.ts](file:///e:/lfaa/packages/core/memory/src/storage-manager.ts) 与 [index.ts](file:///e:/lfaa/packages/core/memory/src/index.ts)：提供动态函数 `getCurrentUserHomeDir()`、`getDefaultLfaaHome()`、`getDefaultDataRoot()`；`default` 模式下实时按当前操作系统登录用户目录解析，同路径迁移分支也强制调用 `ensureSubdirs(toRoot)` 确保 `data` 及其子目录落地。
- 修改 [StorageSettingsView.tsx](file:///e:/lfaa/packages/core/chat/client/components/StorageSettingsView.tsx)：引入 `syncedStorageKeyRef` 仅在服务端持久状态变更时同步 `selectedMode`；移除所有 `"E:\\lfaa\\data"` 硬编码回退显示。
- 修改 [locales.ts](file:///e:/lfaa/packages/core/chat/client/locales.ts)：更新存储模式说明与占位提示文案，去除固定盘符路径示例，补充 `storageDetectingUserPath`、`storageDetectingProjectPath`。
- 修改 [chat-store.ts](file:///e:/lfaa/packages/core/chat/client/chat-store.ts)：在 `fetchJson` 捕获网络 `TypeError` 并转换为明确中文提示（提示确认 `pnpm lfaa web` 运行状态后重试）。
- 修改 [.gitignore](file:///e:/lfaa/.gitignore)：新增 `/data/` 忽略规则，防止「跟随项目走」本地数据目录被意外推送。
- 修改 [memory-service.test.ts](file:///e:/lfaa/packages/core/memory/tests/memory-service.test.ts)：补充 `getDefaultDataRoot()` 动态用户目录校验及任意路径下迁移创建 `data/` 与 `data/sessions/` 的断言。

---

## 3. 验证记录

| 检查项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 全部单元测试 | `pnpm exec tsx --test packages/core/*/tests/*.ts packages/ui/*/tests/*.ts packages/workspace/*/tests/*.ts` | **33/33 通过**（`duration_ms 1578.2899`） |
| TypeScript 类型检查 | `pnpm run typecheck`（12 个 tsconfig） | **exit code 0** |
| Web 生产构建 | `pnpm run build`（`vite build`） | **exit code 0**（`✓ built in 465ms`） |
| 内置浏览器实测 | `browser` 子代理实测 `http://127.0.0.1:5173/`（`1440x900`） | **通过**（控制台 error = 0，网络失败 = 0） |

内置浏览器双向迁移实测验证详情（已检视截图 [final_step_14.png](file:///C:/Users/Administrator/.gemini/antigravity/brain/6802e411-f569-44da-8e24-b1a6955c35fb/browser_evidence/990048d4-0cc9-42a6-aa87-6cec2b63a8b7/final_step_14.png)）：
1. 动态识别 `默认位置`（`C:\Users\Administrator\.lfaa\data`）与 `项目推荐目录`（`E:\lfaa\data`）。
2. 在自定义目录输入 `D:\TempCheck` 后单选框保持选中 `自定义目录`，未再回弹，预览显示 `D:\TempCheck\data`。
3. 选中 `项目推荐目录` 点击 `应用并无损迁移数据`，无 `Failed to fetch` 错误，实际生成 `E:\lfaa\data`（`2 files, 1010 B, verified: true`）并展示绿色完成回执；随后无损迁移回 `C:\Users\Administrator\.lfaa\data` 并清理退出测试服务释放 `5173` 端口。

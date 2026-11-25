# UPDATE-000491｜启动 Web 不再被锁文件顺序卡死

- 日期：2026-11-25（Asia/Shanghai）
- 修复菜单 2 / 菜单 3 的启动死锁：依赖其实已经装好，但预检拿仓库 `pnpm-lock.yaml` 和 pnpm 自己写的 `node_modules/.pnpm/lock.yaml` 做逐字节比对；只要锁文件里的包块顺序被手改过，两份就永远不相等，于是每次都被判成「已安装依赖与 pnpm-lock.yaml 不一致」，Web 与桌面端都起不来。
- 现在依赖预检按内容（YAML 语义）比较：只差包块顺序、换行或 BOM 时直接放行，并在正常启动时把 `pnpm-lock.yaml` 回写成 pnpm 的规范顺序，依赖版本没有任何变化。
- 新增 `pnpm check` 门禁 `lockfile-order`：以后再有人手改锁文件顺序，会在提交前被拦下并提示让 pnpm 重新生成，而不是等到启动器卡死才发现。
- 规则同步写进 `AGENTS.md`：锁文件只能由 `pnpm add` / `pnpm install` 写出，禁止手改或脚本补条款。
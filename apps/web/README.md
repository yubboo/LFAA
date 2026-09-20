# @lfaa/web

LFAA Web 产品薄入口。

- `src/main.ts`：启动 `@lfaa/client-web`；
- `vite.config.ts`：把产品级路径/端口交给 `@lfaa/bundle-web-app`；
- 不包含 Agent/AI/Plugin/Terminal 业务。

如这里再次出现 `dev/bridges` 或 Host business，视为架构回退。

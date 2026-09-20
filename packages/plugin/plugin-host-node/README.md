# @lfaa/plugin-host-node

Node Host 的插件包管理 Provider。

负责：inspect 来源、事务安装、精确 build-script 审批、验证、回滚，以及 Runtime Home 中独立 plugin profile 的维护。

不负责：Plugin contract（`plugin-sdk`）、generation/lifecycle（`plugin-runtime`）、浏览器 UI、Agent capability execution。

插件 Profile 使用 `@lfaa/home-paths` 的 `LFAA_HOME/plugins/profile`，不修改 LFAA 仓库根 `package.json` / `pnpm-lock.yaml`。旧项目 `.lfaa/state/plugin-profile` 只允许由同步兼容逻辑迁移。

# Plugin Manager Bridge

本目录只负责 Web 开发宿主到 `@lfaa/plugin-runtime` / `@lfaa/plugin-host-node` 的薄桥接。

- 浏览器不能直接调用 pnpm、文件系统或动态 import 第三方插件。
- 所有写操作要求 `127.0.0.1/localhost` 同源 Origin。
- 插件安装写入独立 `.lfaa/state/plugin-profile`，绝不修改 LFAA 根 `package.json` / `pnpm-lock.yaml`。
- 安装、取消、回滚、启用与移除必须共用唯一 `PluginManager` 事务。
- Secret 值禁止进入该 API；Manifest 只能声明 credential requirements。

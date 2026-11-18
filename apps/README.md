# 应用入口

此目录存放平台启动器与插件装配代码。当前首个运行目标为 Web，并由 CLI 统一分发启动命令。

Windows 菜单的 Web 启动项使用 `apps/cli/src/bin.ts`，由根 `package.json` 的 `lfaa` 命令调用；Vite 应用与页面挂载位于 `apps/web/`。

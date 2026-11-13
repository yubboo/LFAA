# LFAA 工作区 HTML 本地预览错误恢复

<a id="lfaa-workspace-html-preview-error-recovery-20261113"></a>

## 用户目标

修复隔离 Agent 浏览器打开当前本机工作区 HTML 时出现的 `ERR_HTTP_HEADERS_SENT`，恢复本地预览，并保留路径、符号链接、数据目录和只读访问边界。

## Owner 与边界

- 入口：AI Work `/work` 的 `lfaa_browser_open_workspace_file`；本机预览 HTTP 服务由 `packages/host/project-files` 提供，页面生命周期由 Browser Session Owner 管理。
- 数据与权限：只预览已授权当前会话工作区内的 HTML/HTM 和同目录资源。既有 Permission Owner、Project Files 路径校验、LFAA 数据目录保护及 Browser Session 关闭回收规则保持不变。
- 设置：沿用现有 `browserUse.enabled`（默认关闭）与 Browser Settings；不新增或修改用户设置，不改变账户数据。
- 允许范围：只修复 Project Files Owner 的响应错误处理，并维护其直接预览回归及本合同/索引。
- 禁止范围：不读取、写入或清理用户项目文件；不重启正在运行的 Web/Daemon；不改 Browser Owner、认证、权限、设置、UI 或无关工作区改动；不提交或发布。

## 验收条件

1. 有效 HTML 与同工作区静态资源可由本机只读预览正常读取。
2. 越界路径、越界符号链接、LFAA 数据目录、非 HTML 入口和写请求仍按现有边界拒绝。
3. 响应头已发送或连接已结束后发生异常时，不再尝试写入第二组响应头，也不产生未处理异常；响应以安全方式结束。
4. 隔离 Agent 工具闭环能够打开 HTML、观察页面并完成按钮交互，Browser Session 结束后回收短期服务。

## 实施与验证

- 根因与修复：预览请求先发送 200 响应头，再调用缺少导入的 `createReadStream`，触发 `ReferenceError`；异常处理随后试图发送 403/404，掩盖原始错误并报 `ERR_HTTP_HEADERS_SENT`。现从 `node:fs` 导入该函数；错误分支在响应已销毁、已结束或已发送头时安全返回/关闭连接，原有未发送响应时的 404/403 映射、路径与数据边界保持不变。
- Project Files Owner 回归：`pnpm --filter lfaa-host-project-files run test` 5/5 通过，覆盖 HTML/CSS 读取、只读请求、入口限制、越界路径和越界符号链接。
- Browser Owner 回归：隔离 `workspace-preview.test.mjs` 实际打开临时工作区 HTML，标题/正文/无障碍控件观察、点击、输入/滚动和会话资源关闭用例 1/1 通过；测试进程在测试体结束后延迟退出，最终 TAP 汇总为 1/1。
- Agent Loop 全链路：`agent-browser-preview.test.mjs` 5 项中 2 项通过、3 项失败；预览响应错误已消失，但当前测试夹具与 Agent Loop 行为不一致（实际模型请求各多一轮，另有用例找不到已登记预览工具），因此整套 Agent Loop 不标记为通过，也未扩大本次修复范围。
- 包构建：`pnpm --filter lfaa-host-project-files run build` 通过，产物在仓库根 `dist/packages/host/project-files/`。`git diff --check` 通过。
- 未验：没有重启现有 Web/Daemon，没有登录态 `/work` 页面操作、Desktop WebView 或帧时间验收；未更改 `browserUse.enabled`、其他 Browser Settings、账户数据或用户项目文件。


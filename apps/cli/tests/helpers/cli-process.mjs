/**
 * 功能：为长期 CLI 回归测试提供跨平台的正常停止请求。
 * 作用：通过测试进程专用 IPC 触发真实 SIGINT 生命周期，不给产品增加调试接口或认证旁路。
 * 关联文件：harness-cli.test.mjs、apps/cli/bin/lfaa.mjs；本文件不进入发布包。
 */
process.once("message", (message) => {
  if (message !== "stop") throw new Error("测试停止请求无效。");
  process.emit("SIGINT");
  process.disconnect();
});
// 启动失败时 IPC 不应阻止真实 CLI 退出。
process.channel?.unref();

// 解析 LFAA 启动目标并负责在退出信号到来时关闭 Web 服务。
import { startWeb } from "@lfaa/web-server";
import { fileURLToPath } from "node:url";

// 当前只暴露 Web 启动目标，后续应用入口由 CLI 集中分发。
async function main() {
  const target = process.argv[2];

  if (target === "web") {
    // Web 前端根目录固定在 apps/web；服务实现位于 @lfaa/web-server，apps 只做启动。
    const webRoot = fileURLToPath(new URL("../../web/", import.meta.url));
    // 菜单 2 传 --open：启动完成后自动用默认浏览器打开本地地址；后台任务/探针默认不弹窗。
    const open = process.argv.includes("--open") || process.env.LFAA_OPEN_BROWSER === "1";
    const stop = await startWeb({ webRoot, open });
    let isStopping = false;

    // SIGINT 与 SIGTERM 可能连续到达；幂等标记保证 Vite 服务只关闭一次。
    const shutdown = () => {
      if (isStopping) return;
      isStopping = true;
      void stop().catch((error: unknown) => {
        console.error("LFAA 关闭 Web 服务时发生错误：", error);
        process.exitCode = 1;
      });
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    return;
  }

  console.error("用法：pnpm lfaa web [--open]");
  process.exitCode = 1;
}

// 把启动阶段错误转换为可见日志和非零退出码。
main().catch((error: unknown) => {
  console.error("LFAA 启动失败：", error);
  process.exitCode = 1;
});

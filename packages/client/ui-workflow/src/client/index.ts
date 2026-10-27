/** 功能：登记通用应用工作流面板。作用：通过当前 Client Module Owner 延迟加载工作流画布。关联文件：ApplicationWorkflowCanvas.tsx、package.json、ui-workspace。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-client-modules/src/client/index.js";

export const inject = ["clientModules"];

export function apply(ctx: Context): void {
  ctx.clientModules.register(ctx, "lfaa-client-ui-workflow/src/ApplicationWorkflowCanvas.js", () => import("../ApplicationWorkflowCanvas.js"));
}

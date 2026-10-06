/** 功能：启动浏览器 Harness。作用：先装配界面插件，再挂载现有 React 界面。关联文件：client/modules、各 ui 包、ui-renderer/render.tsx。 */
import { Context } from "@deepseek-ai/cordis";
import * as modules from "lfaa-client-modules/src/client/index.js";
import * as ui_commands from "lfaa-client-ui-commands/src/client/index.js";
import * as ui_connectivity from "lfaa-client-ui-connectivity/src/client/index.js";
import * as ui_chat from "lfaa-client-ui-chat/src/client/index.js";
import * as ui_dockkit from "lfaa-client-ui-dockkit/src/client/index.js";
import * as ui_layout from "lfaa-client-ui-layout/src/client/index.js";
import * as ui_minecraft from "lfaa-client-ui-minecraft/src/client/index.js";
import * as ui_primitives from "lfaa-client-ui-primitives/src/client/index.js";
import * as ui_renderer from "lfaa-client-ui-renderer/src/client/index.js";
import * as ui_settings from "lfaa-client-ui-settings/src/client/index.js";
import * as ui_settings_account from "lfaa-client-ui-settings-account/src/client/index.js";
import * as ui_settings_general from "lfaa-client-ui-settings-general/src/client/index.js";
import * as ui_sidebar from "lfaa-client-ui-sidebar/src/client/index.js";
import * as ui_sidebar_files from "lfaa-client-ui-sidebar-files/src/client/index.js";
import * as ui_workspace from "lfaa-client-ui-workspace/src/client/index.js";
import * as ui_writing from "lfaa-client-ui-writing/src/client/index.js";
import { bootDshClientModules } from "lfaa-client-modules/src/client/index.js";
const context = new Context();
await context.plugin(modules);
await context.plugin(ui_commands);
await context.plugin(ui_connectivity);
await context.plugin(ui_chat);
await context.plugin(ui_dockkit);
await context.plugin(ui_layout);
await context.plugin(ui_minecraft);
await context.plugin(ui_primitives);
await context.plugin(ui_renderer);
await context.plugin(ui_settings);
await context.plugin(ui_settings_account);
await context.plugin(ui_settings_general);
await context.plugin(ui_sidebar);
await context.plugin(ui_sidebar_files);
await context.plugin(ui_workspace);
await context.plugin(ui_writing);
try {
  await bootDshClientModules(context);
} catch (error) {
  // Keep LFAA's own interface available if the independently reported DSH
  // graph fails; do not mark the DSH runtime ready or suppress its cause.
  console.error("LFAA DSH Client Runtime 未就绪。", error);
}
const { mountClient } = await import("lfaa-client-ui-renderer/src/render.js");
mountClient(context);
window.addEventListener("pagehide", () => { void context.fiber.dispose(); }, { once: true });

import type { ApplicationId } from "lfaa-util-values/src/application-id.js";
import type { ManagedPluginRecord, ManagedPluginInspection } from "lfaa-client-connection/src/api.js";

export type PluginAction = "enable" | "disable" | "remove";

export function buildPluginInstallGoal(sourceType: ManagedPluginInspection["sourceType"], source: string, ref = ""): string {
  const normalizedSource = source.trim();
  if (!normalizedSource) throw new Error("请输入插件来源。");
  const normalizedRef = ref.trim();
  const sourceLabel = sourceType === "github" ? "GitHub 仓库" : sourceType === "npm" ? "NPM 包/版本" : "LFAA Host 绝对路径";
  return [
    `请在 LFAA 当前 Profile 中安装一个第三方插件。来源类型：${sourceLabel}。`,
    `来源：${JSON.stringify(normalizedSource)}。`,
    ...(normalizedRef && sourceType !== "local" ? [`请求版本或引用：${JSON.stringify(normalizedRef)}。`] : []),
    "目标 App 为 workspace（通用工作台）。",
    "按当前 Agent Core Tools 与 Permission Owner 流程执行，并根据 Owner 回读报告安装、兼容性和真实运行状态；未得到运行状态确认时不要说插件已启用。不要修改其他插件。"
  ].join("\n");
}

export function buildPluginRemoveGoal(plugin: ManagedPluginRecord, targetApplicationId: ApplicationId): string {
  if (!plugin.applicationIds.includes(targetApplicationId)) throw new Error("该插件没有登记到所选目标 App。");
  return [
    `请卸载当前 LFAA Profile 中 ID 为 ${JSON.stringify(plugin.id)} 的第三方插件。`,
    `目标 App：${targetApplicationId}。`,
    `其来源记录为 ${JSON.stringify(plugin.source.repository)}，固定内容为 ${JSON.stringify(plugin.source.commit)}。`,
    "只操作这个 ID 与目标 App；按当前 Agent Core Tools 和 Permission Owner 流程执行，完成后回读并报告真实状态。不要安装、更新或移除其他插件。"
  ].join("\n");
}

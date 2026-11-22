// Agent 媒体生成指引与产物链接合并，仅处理运行上下文和工具输出。
import type { ToolsService } from "@lfaa/tools";

const IMAGE_TOOL = "generate_image";
const VIDEO_TOOL = "generate_video";
const MEDIA_TOOLS = new Set([IMAGE_TOOL, VIDEO_TOOL, "get_video", "generate_speech"]);
const MEDIA_PREVIEW = /!\[[^\]\n]*\]\((\/api\/media\/file\?path=[^\s)]+)\)/gu;

/** 只有会话实际可用的工具才写入模型指引。 */
export function buildMediaHint(tools: ToolsService): string {
  const commands = [
    tools.getTool(IMAGE_TOOL) && "用户要求生成或改图时调用 generate_image，延续修改时把会话参考图作为 referenceImages。",
    tools.getTool(VIDEO_TOOL) && "用户要求生成视频时调用 generate_video，任务未完成时报告真实状态。",
  ].filter(Boolean);
  if (!commands.length) return "";
  return `${commands.join("\n")}\n对于明确的生成请求，尽量用合理默认参数直接生成。对于询问用法、讨论模型或索要提示词，只回答问题。generate_video 默认只使用当前会话的模型配置，不得静默改用其他厂商或套餐。若当前配置没有视频模型、或厂商拒绝该模型，工具会返回其他可用视频配置：先向用户说明当前套餐不可用并列出备选，询问是否切换；用户同意后再调用 generate_video（或 get_video）并传对应的 profileId。用户已明确授权完全访问并要求自动处理时，可以直接使用备选配置，但最终回复必须写清实际使用的套餐与模型。保留产物预览和实际模型，失败就解释工具错误，未经用户要求不要重试。\n严禁编造媒体链接或声称「图片/视频已生成」：回复里出现的 ![](...) 必须原样来自本轮工具返回；本轮没有调用生成工具时，直接说明尚未生成或先调用工具，不要给出任何 /api/media/file 链接。`;
}

/** 产物来自已完成的生成工具，避免模型总结遗漏本地预览。 */
export function collectMediaPreviews(previews: Map<string, string>, toolName: string, output: string): void {
  if (!MEDIA_TOOLS.has(toolName)) return;
  for (const match of output.matchAll(MEDIA_PREVIEW)) {
    if (match[1]) previews.set(match[1], match[0]);
  }
}

/** 按文件地址去重，同一结果只需要一张预览。 */
export function appendMediaPreviews(content: string, previews: ReadonlyMap<string, string>): string {
  const visible = new Set(Array.from(content.matchAll(MEDIA_PREVIEW), (match) => match[1]));
  return [content, ...[...previews].filter(([url]) => !visible.has(url)).map(([, markdown]) => markdown)]
    .filter(Boolean).join("\n\n");
}

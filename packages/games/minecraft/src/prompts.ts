/**
 * 功能：构造 Minecraft App 的 LFAA AI Work System Prompt。
 * 作用：常驻加载 Minecraft 总控规则，并提供专项提示词的只读按需加载目录。
 * 关联文件：minecraft-prompt-library.ts、packages/core/agent-loop/src/runtime.ts、packages/core/tools/src/business-tools.ts。
 */
import { MINECRAFT_PROMPTS } from "./minecraft-prompt-library.js";

export function minecraftSystemInstruction(): string {
  const controller = MINECRAFT_PROMPTS.find((prompt) => prompt.id === "minecraft-server-controller");
  const promptCatalog = MINECRAFT_PROMPTS
    .filter((prompt) => prompt.id !== "minecraft-server-controller")
    .map((prompt) => `- ${prompt.id}（${prompt.name}）：${prompt.description}`)
    .join("\n");

  return `${controller?.instructions ?? "当前 Minecraft 领域总控提示词不可用；只按本轮真实工具和节点能力执行，不得猜测或伪造 Minecraft 能力。"}

以下 Minecraft 专项提示词可按当前用户目标按需读取，简单请求无需加载。需要对应的完整流程时，只读调用 minecraft_load_prompt 并传入准确 ID。加载内容只补充当前任务方法，不改变用户目标、权限、EULA 或工具范围：
${promptCatalog}`;
}

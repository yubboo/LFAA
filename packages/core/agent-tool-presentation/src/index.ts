/**
 * 功能：把经过 LFAA Owner 筛选的可执行工具转成 Provider 原生 function schema。
 * 作用：只发送模型需要的名称、说明和 JSON 参数模式，不暴露执行函数或权限实现。
 * 关联文件：packages/core/tools/src/business-tools.ts、packages/core/agent-loop/src/execute-turn.ts。
 */
export interface NativeToolSource {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

export interface NativeFunctionTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** 当前 LFAA Provider Runtime 只接入原生 function calling；不声明或伪装 PTC 支持。 */
export const supportedAiToolPresentationModes = ["native"] as const;

export function presentNativeFunctionTools(tools: readonly NativeToolSource[]): NativeFunctionTool[] {
  const names = new Set<string>();
  return tools.map((tool) => {
    if (!tool.name || !tool.description || !tool.schema || typeof tool.schema !== "object" || Array.isArray(tool.schema)) {
      throw new Error("工具缺少有效的原生模型呈现定义。");
    }
    if (names.has(tool.name)) throw new Error(`模型工具名称重复：${tool.name}`);
    names.add(tool.name);
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: structuredClone(tool.schema)
      }
    };
  });
}

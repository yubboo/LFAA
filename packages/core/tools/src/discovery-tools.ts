/**
 * 功能：提供 Run 内工具摘要目录和按需合同加载。
 * 作用：仅从当前已授权、已登记候选中选择；刷新会撤销卸载或配置失效的工具。
 * 关联文件：Agent Loop/execute-turn.ts、registry.ts、tool-contract.ts。
 */
import Joi from "joi";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { makeTool, strictObject, parseWithSchema, type AiBusinessTool } from "./tool-contract.js";

export function createToolDiscoveryTools(readAvailable: () => AiBusinessTool[], load: (names: string[]) => void): AiBusinessTool[] {
  return [
    makeTool({ id: "tools.list", name: "lfaa_tools_list", coreManaged: true, applicationIds: [...APPLICATION_IDS],
      description: "按需发现当前真实工具摘要；query 可按名称、说明或领域筛选，不返回全部参数合同。随后调用 lfaa_tools_load 明确选择需要的工具。目录不授予新的权限。",
      schema: strictObject({ query: { type: "string", maxLength: 120 }, offset: { type: "integer", minimum: 0 }, limit: { type: "integer", minimum: 1, maximum: 40 } }),
      parse: value => parseWithSchema(Joi.object({ query: Joi.string().max(120).allow(""), offset: Joi.number().integer().min(0).max(100000).default(0), limit: Joi.number().integer().min(1).max(40).default(20) }).unknown(false), value),
      execute: async (parameters, context) => {
        context.signal.throwIfAborted();
        const query = String(parameters.query ?? "").toLocaleLowerCase();
        const found = readAvailable().filter(tool => !query || `${tool.id} ${tool.name} ${tool.description}`.toLocaleLowerCase().includes(query));
        return { total: found.length, tools: found.slice(Number(parameters.offset), Number(parameters.offset) + Number(parameters.limit)).map(({ id, name, description, onDemand }) => ({ id, name, description: description.slice(0, 500), onDemand: onDemand === true })), readOnly: true };
      }
    }),
    makeTool({ id: "tools.load", name: "lfaa_tools_load", coreManaged: true, applicationIds: [...APPLICATION_IDS],
      description: "按精确工具名把当前目录中真实能力加载到本 Run 的下一次模型请求。只加载所选合同，不执行业务；执行仍使用当前权限、设置、数据归属和原 Owner。",
      schema: strictObject({ names: { type: "array", items: { type: "string", maxLength: 120 }, minItems: 1, maxItems: 20, uniqueItems: true } }, ["names"]),
      parse: value => parseWithSchema(Joi.object({ names: Joi.array().items(Joi.string().min(1).max(120)).min(1).max(20).unique().required() }).unknown(false), value),
      execute: async (parameters, context) => {
        context.signal.throwIfAborted();
        const names = parameters.names as string[];
        const tools = readAvailable();
        if (names.some(name => !tools.some(tool => tool.name === name))) throw new Error("所选工具不存在、已卸载或不在当前继承/账户范围，未加载任何合同。");
        load(names);
        return { loaded: names, tools: tools.filter(tool => names.includes(tool.name)).map(({ name, description, schema }) => ({ name, description, parameters: schema })), executed: false };
      }
    })
  ];
}

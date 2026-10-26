/**
 * 功能：提供 Run 内工具摘要目录和按需合同加载。
 * 作用：仅从当前已授权、已登记候选中选择；刷新会撤销卸载或配置失效的工具。
 * 关联文件：Agent Loop/execute-turn.ts、registry.ts、tool-contract.ts。
 */
import Joi from "joi";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { makeTool, strictObject, parseWithSchema, type AiBusinessTool } from "./tool-contract.js";

const CJK_SINGLE_CHARACTER = /^\p{Script=Han}$/u;
const CJK_WORD = /^\p{Script=Han}+$/u;
const CJK_SEGMENTER = new Intl.Segmenter("zh-CN", { granularity: "word" });
const QUERY_STOP_WORDS = new Set(["请", "请问", "帮", "帮我", "我", "你", "看看", "一下", "当前", "这个", "怎么", "如何", "能否"]);

/** 将自然语言查询拆成词；保留中文分词，并把连续单字组合成双字词（如“读”“取”→“读取”）。 */
function extractQueryTerms(query: string): string[] {
  const terms = new Set(query.match(/[\p{L}\p{N}_-]+/gu) ?? []);
  const segments = [...CJK_SEGMENTER.segment(query)];
  for (let index = 0; index < segments.length; index += 1) {
    const current = segments[index];
    if (!current.isWordLike) continue;
    if (!CJK_SINGLE_CHARACTER.test(current.segment)) terms.add(current.segment.toLocaleLowerCase());
    if (CJK_WORD.test(current.segment)) {
      const next = segments[index + 1];
      if (next && next.index === current.index + current.segment.length && CJK_WORD.test(next.segment)
        && (CJK_SINGLE_CHARACTER.test(current.segment) || CJK_SINGLE_CHARACTER.test(next.segment))) {
        terms.add(`${current.segment}${next.segment}`.toLocaleLowerCase());
      }
    }
  }
  return [...terms].filter(term => !CJK_SINGLE_CHARACTER.test(term) && !QUERY_STOP_WORDS.has(term));
}

export function createToolDiscoveryTools(readAvailable: () => AiBusinessTool[], load: (names: string[]) => void): AiBusinessTool[] {
  return [
    makeTool({ id: "tools.list", name: "lfaa_tools_list", coreManaged: true, applicationIds: [...APPLICATION_IDS],
      description: "按需发现当前真实工具摘要；query 支持自然语言和中英文表达，中文按词语分段，名称/说明中命中任一词的工具会按命中数排序并列出 matchedTerms。query 为空时按原顺序分页列出全部摘要。随后调用 lfaa_tools_load 明确选择需要的工具。目录不授予新的权限。",
      schema: strictObject({ query: { type: "string", maxLength: 120 }, offset: { type: "integer", minimum: 0 }, limit: { type: "integer", minimum: 1, maximum: 40 } }),
      parse: value => parseWithSchema(Joi.object({ query: Joi.string().max(120).allow(""), offset: Joi.number().integer().min(0).max(100000).default(0), limit: Joi.number().integer().min(1).max(40).default(20) }).unknown(false), value),
      execute: async (parameters, context) => {
        context.signal.throwIfAborted();
        const query = String(parameters.query ?? "").trim().toLocaleLowerCase();
        const queryTerms = extractQueryTerms(query);
        const found = readAvailable().flatMap((tool, index) => {
          const searchableText = `${tool.id} ${tool.name} ${tool.description}`.toLocaleLowerCase();
          if (!query) return [{ tool, index, matchedTerms: [], exactMatch: false }];
          const matchedTerms = queryTerms.filter(term => searchableText.includes(term));
          if (matchedTerms.length === 0) return [];
          // 多词采用任一词匹配；完整短语优先，其次命中词更多者优先，同分保留注册顺序。
          return [{ tool, index, matchedTerms, exactMatch: searchableText.includes(query) }];
        }).sort((left, right) => Number(right.exactMatch) - Number(left.exactMatch)
          || right.matchedTerms.length - left.matchedTerms.length || left.index - right.index);
        return { total: found.length, tools: found.slice(Number(parameters.offset), Number(parameters.offset) + Number(parameters.limit)).map(({ tool: { id, name, description, onDemand }, matchedTerms }) => ({ id, name, description: description.slice(0, 500), onDemand: onDemand === true, matchedTerms })), readOnly: true };
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

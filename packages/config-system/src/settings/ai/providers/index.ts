/**
 * 文件：index.ts
 * 作用：集中注册 LFAA 内置 AI Provider 配置插件。
 * 负责：汇总内置插件列表，不实现任何厂商分支逻辑。
 * 不负责：动态市场安装、UI、网络请求、Secret。
 * 状态归属：静态只读数组。
 * 对外接口：builtinAiProviderPlugins。
 * 关联文件：各 providers/<id>/plugin.ts、../core/provider-registry.ts。
 * 修改注意事项：新增内置 Provider 只新增子目录并在此注册；Core 不得修改厂商分支。
 */
import { openAiProviderPlugin } from "./openai/plugin.ts";
import { deepSeekProviderPlugin } from "./deepseek/plugin.ts";
import { zhipuProviderPlugin } from "./zhipu/plugin.ts";
import { kimiProviderPlugin } from "./kimi/plugin.ts";
import { qwenProviderPlugin } from "./qwen/plugin.ts";
import { xiaomiProviderPlugin } from "./xiaomi/plugin.ts";

export const builtinAiProviderPlugins = [
  openAiProviderPlugin,
  deepSeekProviderPlugin,
  zhipuProviderPlugin,
  kimiProviderPlugin,
  qwenProviderPlugin,
  xiaomiProviderPlugin,
] as const;

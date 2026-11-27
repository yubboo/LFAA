// 测试期样式桩：Node 不能直接加载 *.module.css，这里把样式模块统一替换成类名代理，
// 让 client 组件在 node:test 里可直接渲染。由 scripts/test.mjs 以 --import 注入，
// 全部 *.test.ts(x) 共享，用例文件不必再各自注册（详见 AGENTS.md §6 测试门禁）。
import { registerHooks } from "node:module";

/** 样式模块桩源码：任意属性访问都返回属性名，等价于 CSS Modules 的类名映射。 */
const STYLE_STUB_SOURCE = "export default new Proxy({}, { get: (_, key) => String(key) });";

/** 拦截样式模块加载；其余请求原样交回 tsx 与 Node 默认加载链。 */
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", shortCircuit: true, source: STYLE_STUB_SOURCE };
    }
    return nextLoad(url, context);
  },
});

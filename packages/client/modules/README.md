# Client Modules

本包装配当前浏览器模块，不另建 Session、鉴权或业务 Runtime。外部 DSH 库按现有声明使用；LFAA 仍通过现有 Cordis/Profile 与受认证页面注入加载。

数学渲染器直接依赖与 Markdown 扩展间接依赖统一锁定 KaTeX 0.18.2，修复 `GHSA-238p-pmpm-9mq7`：其他库污染原型时不能使默认 trust 限制失效。依据 [维护者公告](https://github.com/KaTeX/KaTeX/security/advisories/GHSA-238p-pmpm-9mq7)。该修复不证明 LFAA 本身存在原型污染漏洞，不启用受信任 HTML/外部资源。

长期回归 `scripts/tests/math-rendering.test.mjs` 覆盖直接/间接版本、公式 AST、显示公式和污染原型后的默认拒绝；客户端类型检查和隔离 Web 构建验证现有引入路径。实际浏览器视觉排版另行验收。

/**
 * 文件：css-modules.d.ts
 * 作用：为 App Shell 内部局部 CSS Module 提供 TypeScript 类型声明。
 * 负责：把 `*.module.css` 映射为只读 className 字典。
 * 不负责：样式内容、主题 Token、运行时 CSS 注入策略。
 */
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

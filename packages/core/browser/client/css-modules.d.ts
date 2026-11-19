// 声明 CSS Modules 模块类型供 TypeScript 检查。
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

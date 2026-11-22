// 为图标包 Client 侧 CSS Modules 提供类型声明。
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
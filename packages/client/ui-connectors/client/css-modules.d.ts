// 浏览器端 CSS Modules 类型声明，由 Vite 处理实际样式。
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

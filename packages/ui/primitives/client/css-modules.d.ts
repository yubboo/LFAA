// 浏览器组件使用的 CSS Modules 声明，将导入的局部类名暴露为字符串映射。
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

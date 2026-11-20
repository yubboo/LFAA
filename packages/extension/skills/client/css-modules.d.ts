// 声明 CSS Modules 类型导出，供 @lfaa/skills 浏览器端组件安全导入样式。
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

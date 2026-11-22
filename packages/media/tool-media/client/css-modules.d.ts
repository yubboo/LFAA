// 声明 @lfaa/tool-media/client 中 CSS Modules 的类型定义。
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
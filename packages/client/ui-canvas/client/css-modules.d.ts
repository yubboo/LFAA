// 为无限画布的 CSS Modules 提供浏览器侧类型。
declare module "*.module.css" {
  const styles: Record<string, string>;
  export default styles;
}

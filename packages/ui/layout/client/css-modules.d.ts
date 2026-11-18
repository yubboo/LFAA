// 为 Client 中的 CSS Modules 提供静态类名类型。
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

# Typert 插件加载桥接

`lfaa-typert-loader` 为插件提供 `lfaaTypertLoader` 服务，并提供 `createTypertContributionPlugin()`，把一份 Remote 贡献包装成 Cordis 插件。该包装插件必须作为其 Owner 插件的子 Fiber 装配；卸载时注册表会撤销其方法。

该包不扫描文件系统、不自动导入任意包，也不扩大产品 Profile。当前账户插件显式登记自身 Remote 贡献；生成器输出、包级静态工件发现和自动导入仍待实现。Control Plane Host/Client 的基础一元适配已用现有 `api/gateway` 与 `client/connection` 接通，但只迁移账户自身读取一个方法。

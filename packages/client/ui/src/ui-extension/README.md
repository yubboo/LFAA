# ui-extension

UI 插件贡献契约与 Registry。用于未来 effect / slot / renderer / panel / action 等可安装贡献。

核心原则：Contribution 走 Registry；Feature 不直接 import 某个可卸载插件。插件卸载时按 ownerId 清除贡献并推进 generation。

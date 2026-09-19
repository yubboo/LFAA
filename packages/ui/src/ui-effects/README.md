# ui-effects

声明式 UI 特效引擎与 Effect Registry。普通插件只能注册受支持的 Effect Definition，不允许直接操作 LFAA DOM。

Effect 按 ownerId 注册，支持 `unregisterOwner()` 与 generation，方便插件启用/卸载后原子切换。自定义可执行 Renderer 后续必须进入受控 UI Extension Host，不直接 import 到主界面。

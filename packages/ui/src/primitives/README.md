# primitives

基础无业务 UI / Interaction Primitive。

当前包含：

- `useDismissibleLayer`：统一 Popover/Menu/Floating Card 的点击空白关闭与 Escape 关闭行为；业务组件不得重复维护 document outside-click 监听。

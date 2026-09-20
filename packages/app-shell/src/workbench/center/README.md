# CenterWorkspace 模块

`CenterWorkspaceRegion.tsx` 只是父级布局与 Props 转发，子模块必须经各自 `index.ts` 进入：`header/`、`conversation/`、`composer/`。

- Header：Shell 控件/Runtime 状态展示。
- Conversation：Chat Timeline 或 Work Canvas 投影。
- Composer：输入、权限、能力入口与 RuntimeControl。

禁止 Header / Conversation / Composer 互相深链 import 或用 CSS selector 修改兄弟内部。

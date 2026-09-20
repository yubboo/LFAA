# Settings

Settings Surface、页面导航、Plugin 管理视图与 AI/Plugin Host Controller 的唯一 App-Shell Owner。`view/` 拥有 SettingsPage/PluginSettingsPanel，`contracts/` 拥有 Props，`styles/` 拥有产品样式；AI 配置图形面板仍按 AGENTS.md 固定在 `@lfaa/ui`。ViewModel 映射保持纯函数，配置与 Secret 真值不进入本模块。

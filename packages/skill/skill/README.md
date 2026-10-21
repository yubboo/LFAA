# LFAA Skill Registry

`lfaa-skill` 是 Skill 摘要、winner 选择、正文加载和可选附属资源读取的唯一 Registry Owner。Provider 只通过 Cordis 生命周期登记；未实现 `readResource` 的 Provider 会明确拒绝附属资源读取。

资源合同只接受 `references/`、`assets/`、`scripts/` 下的常见文本文件，拒绝绝对路径、路径跳转、隐藏文件、二进制格式及超过 96 KiB 的内容。绝对 Provider 路径与 URL 不注入模型上下文；模型只能提交相对资源名给 Owner。资源仍是来自 Skill 的不可信资料，不会被执行或转成权限。目录发现缓存只缓存摘要，正文和资源每次按需读取。

本包不读取具体文件、不执行脚本、不管理权限或安装状态。来源、实际文件访问和运行状态分别归对应 Provider、Project Files、Permission 与 Runtime Owner。

# LFAA GitHub 推送敏感内容扫描误报修复 20261031

<a id="lfaa-github-push-secret-scan-false-positive-20261031"></a>

## 用户目标与复现

工作台菜单 6 在用户确认正常推送后，将 `docs/PROMPTS.md` 与两份 Minecraft 任务合同拦截为“模型服务令牌”，没有创建提交或推送。所附终端记录来自 Windows 工作区 `E:\lfaa1\lfaa`；PowerShell 具体版本未提供。

当前误报原因已由源码与被扫描文本确认：链接 slug `minecraft-task-card-*` 含有 `sk-card-*` 连续字符，宽泛的 `sk-[A-Za-z0-9_-]{32,}` 也接受后续自然语言连字符，因而将文档路径文本当成密钥。

## Owner、配置与数据边界

- 入口：根工作台菜单 6 → `scripts/install-dependencies.ps1` → `Push-GitHubRepository` → staged index 与 `HEAD` 历史敏感内容扫描。
- 规则 Owner：`scripts/install-dependencies.ps1` 中的 Git 敏感内容模式及阻断器。扫描范围仍由当前 Git index 和提交历史决定。
- 无设置中心配置。GitHub 认证、远端校验、用户确认、路径/体积过滤、版本规则和非强推保护均沿用原有流程。
- 允许修改推送脚本、本任务合同与 `docs/PROMPTS.md` 索引。保留工作区现存暂存与未暂存内容；不读取或输出任何匹配秘密，不在本轮创建提交或执行远端推送。

## 验收条件

- 普通文档 slug 中的 `sk-card-*` 不再阻止菜单 6；真正符合受支持模型令牌格式的内容仍会被阻止，且不输出匹配值。
- staged index 与历史扫描都使用修正后的同一规则；没有新增按文档路径或目录的全局跳过。
- PowerShell 语法、直接相关回归及 `git diff --check` 通过；性能影响限于同一批次的扫描表达式，不增加读取/进程数量。未运行的验证与未执行的真实推送须明确记录。

## 实施记录

- `scripts/install-dependencies.ps1`（唯一推送扫描规则 Owner）：将原有任意连字符令牌主体收紧为连续随机主体，并覆盖 OpenAI `proj`/`svcacct`、OpenRouter `or-v1`、Anthropic `ant-apiNN` 结构前缀。暂存区与 Git 历史继续共用同一规则；没有新增目录豁免、日志输出或扫描进程。
- 静态复核：附件列出的三个命中文档只有 `task-card` slug 子串；修正后的通用主体不会跨连字符累加长度，Anthropic/已知前缀分支也不匹配这些 slug。模型令牌样本行为与实际菜单复推本轮未执行。
- 实际验证：Windows PowerShell 5.1 与当前 PowerShell 7.6.5 对 `scripts/install-dependencies.ps1` 的 AST 解析均为 0 错误；`git diff --check -- scripts/install-dependencies.ps1 docs/PROMPTS.md` 通过；新合同尾随空白检查通过。没有运行自动化测试，也没有创建提交或推送。
- 性能与安全：没有增加扫描遍数、Git 进程或文件读取，变化仅在匹配表达式；文件路径过滤、大小限制、阻断时不打印匹配值、GitHub 远端校验、用户确认与非强推语义保持原样。实际模型凭据扫描与网络推送仍待真实菜单流程复验。

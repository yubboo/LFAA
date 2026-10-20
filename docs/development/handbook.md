# LFAA Developer Handbook

[简体中文：功能地图与完整开发记录](handbook.zh.md) · [Documentation index](../README.md)

The Chinese handbook is the current visual index for LFAA feature areas. It connects user problems to implementation records, package owners, validation evidence, and known limits. The product also includes an in-app visual handbook at **Settings → About & Updates → LFAA Developer Handbook**. Its structured source is [`developer-handbook-content.ts`](../../packages/client/ui-settings/src/developer-handbook-content.ts), so people can browse the UI map in LFAA while AI tools can inspect the same topic data directly.

This page is a navigation guide, not a second source of truth. Use the [system architecture](../系统总体架构.md) and current source for implemented behavior, the [development plan](../开发计划.md) for outstanding work, [task contracts](../PROMPTS.md) for decisions and validation records, package `README.md` files for package ownership, and the [release log](../updata-log.md) for product versions.

Start with the [feature map and AI reading path](handbook.zh.md), then follow its links to the relevant owner and detailed task record. Historical verification applies only to its stated revision, environment, and scope.

For future feature and bug-fix requests, the Chinese handbook's [development workflow](handbook.zh.md#怎么开发与验收提示词和记录模板) includes a copy-ready prompt and a detailed task-record template. Each change is registered and completed in its own [PROMPTS contract](../PROMPTS.md); stable architecture facts remain in their existing owner documents.

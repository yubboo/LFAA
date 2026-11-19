# UPDATA-000137｜Codex 式技能体系与 DSH 式插件 Profile 隔离

- **Codex 式 Skill 体系**：
  - **内置与用户级分离**：内置技能放在 `packages/skills/src/builtin-skills/`，界面显式标注「内置」，不可删除（仅支持停用或「复制为我的版本」）；用户级技能存放在 `~/.lfaa/skills/`，支持增删改；严禁读取外部编程工具使用的 `.agent/skills/` 目录。
  - **自然语言安装与按需加载**：为小鱼 Agent 注册 `list_skills`、`load_skill`、`install_skill_from_git`、`save_user_skill` 工具，支持对话中一句话从 Git 仓库安装 Skill 到 `~/.lfaa/skills/`、创建个人技能，以及运行时按需加载已启用技能正文。
- **DSH 式 Plugin Profile 隔离**：
  - 插件环境迁移至 `~/.lfaa/profiles/<web|desktop>/`（含 `cordis.yml`、`cordis.patch.yml`、`package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`node_modules/`、`.plugin-manager/`），当前 Web 服务默认运行在 `web` Profile，预留 `desktop` Profile 供后续桌面端独立隔离使用。

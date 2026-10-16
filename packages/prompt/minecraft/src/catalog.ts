/**
 * 功能：minecraft 提示词摘要目录。
 * 作用：按职责登记能力，业务与权限继续归原 Owner，正文由模型按需加载。
 * 关联文件：index.ts、领域正文库。
 */
export const PROMPT_CATALOG = [
  {
    "id": "minecraft-server-controller",
    "name": "Minecraft 开服总控",
    "description": "理解开服目标，选择最少必要工具；自动部署包含 Java、下载、配置、登记与真实启动核验。"
  },
  {
    "id": "minecraft-vanilla-deploy",
    "name": "官方 Vanilla 服务端部署",
    "description": "按官方版本和工件信息准备 Vanilla 服务端部署，并按当前三种权限模式处理许可接受和实例登记。"
  },
  {
    "id": "minecraft-java-environment",
    "name": "Java 运行环境",
    "description": "读取目标服务端 Java 要求，选择、安装、登记或移除真实可用的 Java 环境。"
  },
  {
    "id": "minecraft-eula-registration",
    "name": "EULA 与实例登记",
    "description": "按唯一三种权限模式接受 EULA 和核心许可，并在登记后重新读取真实状态。"
  },
  {
    "id": "minecraft-instance-lifecycle",
    "name": "实例启停、重启、控制台命令与 Java 切换",
    "description": "在启动、停止或更换 Java 前后核对节点能力、实例状态、任务和日志。"
  },
  {
    "id": "minecraft-node-sandbox-diagnostics",
    "name": "节点与沙盒诊断",
    "description": "依据当前心跳、实际回报的执行能力、Java 快照、任务和日志分析启动前置问题。"
  },
  {
    "id": "minecraft-task-recovery",
    "name": "Minecraft 任务中断与恢复",
    "description": "核对任务租约、Daemon 心跳、实例现状和最后日志，避免重复派发已有副作用。"
  },
  {
    "id": "minecraft-log-diagnosis",
    "name": "日志分析与故障诊断",
    "description": "用真实实例日志、任务结果、节点能力和 Java 状态定位最先发生的阻塞错误。"
  },
  {
    "id": "minecraft-unsupported-ecosystem-router",
    "name": "未支持 Minecraft 生态路由",
    "description": "识别实时能力未覆盖的服务端、模组、插件、远程节点或迁移请求。"
  },
  {
    "id": "minecraft-world-backup",
    "name": "Minecraft 世界备份",
    "description": "只对已确认停止的实例使用现有业务备份任务，不承诺未接入的恢复能力。"
  },
  {
    "id": "minecraft-file-edit-controller",
    "name": "Minecraft 配置文件修改总控",
    "description": "先走 Minecraft 专用配置工具，统一字段白名单、运行状态、路径与验证边界。"
  },
  {
    "id": "minecraft-server-properties",
    "name": "server.properties 配置修改",
    "description": "调用现有 Minecraft 配置能力，仅提交当前服务端允许的字段并回读验证。"
  },
  {
    "id": "minecraft-running-instance-protection",
    "name": "运行中实例文件保护",
    "description": "阻止绕过业务能力直接修改运行中实例目录，并要求停服后重新核实。"
  },
  {
    "id": "minecraft-file-path-boundary",
    "name": "Minecraft 实例路径安全边界",
    "description": "只使用真实登记实例目录和节点数据根内路径，不从离线缓存推断文件状态。"
  },
  {
    "id": "minecraft-config-diff-verify",
    "name": "配置差异与验收",
    "description": "回读权威配置值并区分保存成功、等待重启、失败和结果未确认。"
  },
  {
    "id": "minecraft-config-failure-diagnosis",
    "name": "配置修改失败诊断",
    "description": "按真实业务错误、字段校验和实例状态定位配置失败，不以低层写入绕过拒绝。"
  }
] as const;

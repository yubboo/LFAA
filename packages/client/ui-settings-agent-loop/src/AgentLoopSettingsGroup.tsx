/**
 * 功能：呈现 Agent Loop 请求、委派和上下文预算设置。
 * 作用：受控消费 Settings 数据及回调；不保存偏好、不派发任务、不执行权限决定。
 * 关联文件：SettingsPage.tsx、settings-contract.ts、sandbox-contract.ts、settings-controls.tsx。
 */
import { Input, InputNumber, Select, Tag } from "antd";
import type { AiAccount } from "lfaa-client-connection/src/api.js";
import { SettingGroup, SettingRow, SettingsSwitch } from "lfaa-client-ui-primitives/src/settings-controls.js";
import { EXECUTION_SANDBOX_MODES } from "lfaa-util-values/src/sandbox-contract.js";
import {
  AI_RUNTIME_MAX_MODEL_REQUESTS_PER_RUN,
  AI_RUNTIME_MAX_TOOL_CALLS_PER_RUN,
  DEFAULT_USER_SETTINGS,
  type AiRuntimeSettings
} from "lfaa-util-values/src/settings-contract.js";

export interface AgentLoopSettingsGroupProps {
  settings: AiRuntimeSettings;
  accounts: readonly AiAccount[];
  onChange: (settings: AiRuntimeSettings) => void;
}

export function AgentLoopSettingsGroup({ settings, accounts, onChange }: AgentLoopSettingsGroupProps) {
  const autoCompaction = settings.autoCompaction ?? DEFAULT_USER_SETTINGS.aiRuntime.autoCompaction!;
  const contextWindowTokens = settings.contextWindowTokens ?? DEFAULT_USER_SETTINGS.aiRuntime.contextWindowTokens!;
  const update = (patch: Partial<AiRuntimeSettings>) => onChange({ ...settings, ...patch });

  return (
    <SettingGroup title="推理参数">
      <SettingRow title="Agent Shell 文件访问限制" description="工作区读写隔离为默认值；只读限制项目文件写入；完全访问仍经现有 Permission Owner 授权。">
        <Select
          value={settings.executionSandboxMode}
          onChange={value => update({ executionSandboxMode: value })}
          options={[
            { value: EXECUTION_SANDBOX_MODES[0], label: "只读工作区" },
            { value: EXECUTION_SANDBOX_MODES[1], label: "工作区读写（默认）" },
            { value: EXECUTION_SANDBOX_MODES[2], label: "完全访问" },
          ]}
          aria-label="Agent Shell 文件访问限制"
        />
      </SettingRow>
      <SettingRow title="输出长度策略" description="快速策略最多请求 1024 tokens；平衡/深入遵循所选模型能力或你填写的上限，不改变模型思考力度。">
        <Select value={settings.speed} options={[{ value: "fast", label: "快速 · 最多 1024" }, { value: "balanced", label: "平衡 · 按模型/自定义上限" }, { value: "deep", label: "深入 · 尽量使用模型上限" }]} onChange={(value) => update({ speed: value })} />
      </SettingRow>
      <SettingRow title="最大输出 tokens" description="0 表示自动：按模型目录声明的单次输出上限发送；目录未提供时省略上限字段，遵循 Provider 对该型号的默认值。正数是你的上限，已验证的模型上限仍会优先约束。部分模型的思考内容也占用 Provider 输出预算。">
        <InputNumber min={0} max={Number.MAX_SAFE_INTEGER} step={1024} value={settings.maxOutputTokens} onChange={(value) => value !== null && update({ maxOutputTokens: value })} />
      </SettingRow>
      <SettingRow title="模型无进展超时" description="Provider 无响应或模型流没有新数据时中止；持续返回内容时不会因累计时长而中断。">
        <Input type="number" min={10} max={300} value={settings.requestTimeoutSeconds} onChange={(event) => update({ requestTimeoutSeconds: Math.max(10, Math.min(300, Number(event.target.value) || 10)) })} />
      </SettingRow>
      <SettingRow title="模型请求重试次数" description="仅在未收到回答或工具选择时恢复临时网络、服务错误或空回答；0 表示关闭。每次重试计入本轮请求预算，已执行工具不会重放。">
        <InputNumber min={0} max={3} value={settings.requestRetries} onChange={value => value !== null && update({ requestRetries: value })} />
      </SettingRow>
      <SettingRow title="模型重试等待（秒）" description="临时请求失败后的基础等待时间，后续重试逐次递增。停止任务会取消等待。">
        <InputNumber min={0} max={30} value={settings.retryDelaySeconds} onChange={value => value !== null && update({ retryDelaySeconds: value })} />
      </SettingRow>
      <SettingRow title="子 Agent 模型账户" description="默认继承主 Agent 的模型账户，也可选择当前账户保存的其他模型；所选账户失效会明确失败，不自动换模型。">
        <Select value={settings.subagentAccountId} options={[{ value: "", label: "继承主 Agent" }, ...accounts.map(account => ({ value: account.id, label: account.displayName + " · " + account.modelId }))]} onChange={value => update({ subagentAccountId: value })} />
      </SettingRow>
      <SettingRow title="每轮子 Agent 数量" description="允许主 Agent 按任务需要委派的子任务数量，0 表示关闭委派。">
        <InputNumber min={0} max={16} value={settings.maxSubagents} onChange={value => value !== null && update({ maxSubagents: value })} />
      </SettingRow>
      <SettingRow title="最大委派深度" description="限制子 Agent 继续派发任务的层数，0 表示关闭委派。">
        <InputNumber min={0} max={4} value={settings.maxDelegationDepth} onChange={value => value !== null && update({ maxDelegationDepth: value })} />
      </SettingRow>
      <SettingRow title="节点命令默认时限（秒）" description="0 表示不限时；模型指定的时限只能缩短已保存的非零上限。停止任务会向执行节点请求终止进程树。">
        <InputNumber min={0} max={1800} value={settings.commandTimeoutSeconds} onChange={value => value !== null && update({ commandTimeoutSeconds: value })} />
      </SettingRow>
      <SettingRow title="每轮模型请求上限" description={`0 使用产品安全上限 ${AI_RUNTIME_MAX_MODEL_REQUESTS_PER_RUN} 次（含重试和上下文摘要）；正数可设置更低预算。`}>
        <InputNumber min={0} max={AI_RUNTIME_MAX_MODEL_REQUESTS_PER_RUN} value={settings.maxModelRequests} onChange={(value) => value !== null && update({ maxModelRequests: value })} />
      </SettingRow>
      <SettingRow title="每轮工具调用上限" description={`0 使用产品安全上限 ${AI_RUNTIME_MAX_TOOL_CALLS_PER_RUN} 次；正数可设置更低预算。超出预算的本批调用均不会派发。`}>
        <InputNumber min={0} max={AI_RUNTIME_MAX_TOOL_CALLS_PER_RUN} value={settings.maxToolCalls} onChange={(value) => value !== null && update({ maxToolCalls: value })} />
      </SettingRow>
      <SettingRow title="提示词建议" description="在空会话输入区显示当前应用的示例任务。">
        <SettingsSwitch label="提示词建议" checked={settings.promptSuggestions} onChange={() => update({ promptSuggestions: !settings.promptSuggestions })} />
      </SettingRow>
      <SettingRow title="显示上下文使用情况" id="ai-context-usage-setting" description={<><Tag color={settings.showContextUsage ? "green" : "default"}>当前已{settings.showContextUsage ? "开启" : "关闭"}</Tag> 开启后，主聊和侧聊输入框下方显示当前模型的上下文占用与分项；Token 总量和缓存命中统计不受此开关影响。</>}>
        <SettingsSwitch label="显示上下文使用情况" checked={settings.showContextUsage} onChange={() => update({ showContextUsage: !settings.showContextUsage })} />
      </SettingRow>
      <SettingRow title="自动压缩较早上下文" description="模型上下文接近容量时，先摘要较早对话再继续；关闭后保留现有上下文并遵循模型和请求预算。">
        <SettingsSwitch label="自动压缩较早上下文" checked={autoCompaction} onChange={() => update({ autoCompaction: !autoCompaction })} />
      </SettingRow>
      <SettingRow title="模型窗口未知时的上下文容量" description="优先使用模型目录提供的窗口；仅在目录未知时按此容量触发摘要，摘要使用当前模型并计入请求预算。">
        <InputNumber min={4096} max={2000000} value={contextWindowTokens} onChange={value => value !== null && update({ contextWindowTokens: value })} />
      </SettingRow>
    </SettingGroup>
  );
}

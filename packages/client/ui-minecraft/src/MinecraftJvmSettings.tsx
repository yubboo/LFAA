/** 功能：编辑当前 Minecraft 实例真正使用的 JVM 堆与调优参数。作用：只呈现实例内参数预设/校验/保存，不管理 Java 下载或安装。关联文件：MinecraftWorkspace.tsx、lfaa-client-connection/src/api.ts 与 minecraft-jvm-contract.mjs。 */
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Input, InputNumber, Space, Tag, Typography } from "antd";
import { getMinecraftJvmPreset, parseMinecraftJvmArguments, type MinecraftJvmPresetId } from "lfaa-util-values/src/minecraft-jvm-contract.mjs";
import type { MinecraftInstance } from "lfaa-client-connection/src/api.js";

export interface MinecraftJvmSettingsProps {
  instance: MinecraftInstance;
  javaLabel: string;
  canEdit: boolean;
  busy: boolean;
  onSave: (value: { memoryMb: number; initialHeapMb: number; jvmArguments: string }) => Promise<boolean>;
  onRefresh: () => void;
}

const presetChoices: Array<{ id: MinecraftJvmPresetId; title: string }> = [
  { id: "recommended", title: "推荐" },
  { id: "high-performance", title: "高性能" },
  { id: "low-memory", title: "低内存" },
  { id: "custom", title: "自定义" }
];

function sameConfiguration(left: { memoryMb: number; initialHeapMb: number; jvmArguments: string[] }, right: { memoryMb: number; initialHeapMb: number; jvmArguments: string[] }): boolean {
  return left.memoryMb === right.memoryMb && left.initialHeapMb === right.initialHeapMb && JSON.stringify(left.jvmArguments) === JSON.stringify(right.jvmArguments);
}

function matchingPreset(instance: MinecraftInstance): MinecraftJvmPresetId {
  if (!instance.jvmArgumentsConfigured) return "recommended";
  for (const id of ["recommended", "high-performance", "low-memory"] as const) {
    const preset = getMinecraftJvmPreset(id, { javaMajor: instance.javaMajor, coreType: instance.coreType, memoryMb: instance.memoryMb });
    if (preset && sameConfiguration(preset, { memoryMb: instance.memoryMb, initialHeapMb: instance.initialHeapMb, jvmArguments: instance.jvmArguments })) return id;
  }
  return "custom";
}

/** 运行环境仅显示已绑定 Java；实际参数都由实例级配置接口持久化并由启动器消费。 */
export function MinecraftJvmSettings(props: MinecraftJvmSettingsProps) {
  const { instance, onRefresh } = props;
  const missingFields = [
    !Number.isSafeInteger(instance.memoryMb) ? "最大内存" : null,
    !Number.isSafeInteger(instance.initialHeapMb) ? "初始堆" : null,
    !Number.isSafeInteger(instance.javaMajor) ? "Java 版本" : null,
    typeof instance.coreType !== "string" || !instance.coreType ? "核心类型" : null,
    !Array.isArray(instance.jvmArguments) || !instance.jvmArguments.every(argument => typeof argument === "string") ? "JVM 参数" : null
  ].filter((field): field is string => field !== null);

  if (missingFields.length > 0) {
    return <Card className="minecraft-card minecraft-jvm-settings lfaa-card-motion">
      <Alert
        type="error"
        showIcon
        message="实例 JVM 数据不完整"
        description={`实例“${instance.name}”（${instance.id}）没有完整返回${missingFields.join("、")}。为避免串用其他实例数据或覆盖已有参数，JVM 编辑已暂停。`}
        action={<Button size="small" onClick={onRefresh}>刷新实例数据</Button>}
      />
    </Card>;
  }
  if (instance.coreType === "PocketMine") {
    return <Card className="minecraft-card minecraft-jvm-settings lfaa-card-motion">
      <Alert type="info" showIcon message="PocketMine 不使用 JVM" description="PocketMine 服务端由 PHP 运行，JVM 堆和 GC 参数不会被它消费。" />
    </Card>;
  }

  return <MinecraftJvmSettingsEditor {...props} />;
}

function MinecraftJvmSettingsEditor({ instance, javaLabel, canEdit, busy, onSave }: MinecraftJvmSettingsProps) {
  const savedArguments = useMemo(() => instance.jvmArguments.join("\n"), [instance.jvmArguments]);
  const [memoryMb, setMemoryMb] = useState(instance.memoryMb);
  const [initialHeapMb, setInitialHeapMb] = useState(instance.initialHeapMb);
  const [argumentsText, setArgumentsText] = useState(savedArguments);
  const [preset, setPreset] = useState<MinecraftJvmPresetId>(() => matchingPreset(instance));
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setMemoryMb(instance.memoryMb);
    setInitialHeapMb(instance.initialHeapMb);
    setArgumentsText(savedArguments);
    setPreset(matchingPreset(instance));
    setSaveError(null);
  }, [instance.id, instance.memoryMb, instance.initialHeapMb, savedArguments, instance.javaMajor, instance.coreType]);

  const checked = useMemo(() => {
    try {
      return {
        value: parseMinecraftJvmArguments([
          `-Xms${initialHeapMb}M`,
          `-Xmx${memoryMb}M`,
          argumentsText
        ].filter(Boolean).join("\n"), { javaMajor: instance.javaMajor, coreType: instance.coreType }),
        error: null
      };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : "JVM 参数无效。" };
    }
  }, [argumentsText, initialHeapMb, instance.coreType, instance.javaMajor, memoryMb]);

  const dirty = memoryMb !== instance.memoryMb || initialHeapMb !== instance.initialHeapMb || argumentsText !== savedArguments;
  const selectedPreset = presetChoices.find(option => option.id === preset) ?? presetChoices[presetChoices.length - 1];
  const recommendedDescription = "所有 Java 核心共用 G1 调优：150 ms 停顿目标、并行引用处理和额外保留堆；停顿目标由 JVM 尽力实现，可能增加 GC 频率。";
  const highPerformanceAvailable = Boolean(getMinecraftJvmPreset("high-performance", {
    javaMajor: instance.javaMajor,
    coreType: instance.coreType,
    memoryMb: Math.max(1024, Math.min(32768, memoryMb))
  }));

  const applyPreset = (next: MinecraftJvmPresetId) => {
    setPreset(next);
    setSaveError(null);
    if (next === "custom") return;
    const value = getMinecraftJvmPreset(next, {
      javaMajor: instance.javaMajor,
      coreType: instance.coreType,
      memoryMb: Math.max(1024, Math.min(32768, memoryMb))
    });
    if (!value) return;
    setInitialHeapMb(value.initialHeapMb);
    setArgumentsText(value.jvmArguments.join("\n"));
  };

  const save = async () => {
    if (!checked.value || !dirty || !canEdit || busy) return;
    setSaveError(null);
    try {
      const succeeded = await onSave({ memoryMb, initialHeapMb, jvmArguments: argumentsText });
      if (!succeeded) setSaveError("保存失败，请重试。");
    } catch {
      setSaveError("保存失败，请重试。");
    }
  };

  return <Card className="minecraft-card minecraft-jvm-settings lfaa-card-motion">
    <div className="minecraft-jvm-settings__heading">
      <div><Typography.Title level={4}>JVM 参数</Typography.Title><Typography.Text type="secondary">{instance.coreType} · Java {instance.javaMajor} · {javaLabel}</Typography.Text></div>
      <div className="minecraft-jvm-settings__status"><Tag color={instance.eulaAcceptedAt ? "success" : "default"}>{instance.eulaAcceptedAt ? "许可已记录" : "许可未记录"}</Tag><Tag color={instance.jvmArgumentsConfigured ? "processing" : "success"}>{instance.jvmArgumentsConfigured ? "参数已保存" : "推荐默认 · 启动时使用"}</Tag><Tag>{instance.state === "running" ? "运行中 · 只读" : canEdit ? "已停止 · 可编辑" : "只读"}</Tag></div>
    </div>
    <div className="minecraft-jvm-presets" role="group" aria-label="JVM 参数预设">
      {presetChoices.map(option => <button
        className="minecraft-jvm-presets__choice"
        type="button"
        key={option.id}
        aria-pressed={preset === option.id}
        disabled={!canEdit || busy || (option.id === "high-performance" && !highPerformanceAvailable)}
        title={option.id === "high-performance" && !highPerformanceAvailable ? "当前运行环境不支持 JVM 调优" : undefined}
        onClick={() => applyPreset(option.id)}
      >{option.title}</button>)}
    </div>
    <div className="minecraft-jvm-layout">
      <section className="minecraft-jvm-editor" aria-label="实例 JVM 启动参数">
        <div className="minecraft-jvm-memory">
          <label><span>初始堆 · -Xms</span><Space.Compact block className="minecraft-jvm-memory__input"><InputNumber min={512} max={memoryMb} step={256} value={initialHeapMb} disabled={!canEdit || busy} aria-label="初始堆" onChange={value => { setInitialHeapMb(Number(value ?? 0)); setPreset("custom"); }} /><Input aria-label="单位" value="MB" readOnly tabIndex={-1} /></Space.Compact></label>
          <label><span>最大堆 · -Xmx</span><Space.Compact block className="minecraft-jvm-memory__input"><InputNumber min={1024} max={32768} step={256} value={memoryMb} disabled={!canEdit || busy} aria-label="最大堆" onChange={value => { setMemoryMb(Number(value ?? 0)); setPreset("custom"); }} /><Input aria-label="单位" value="MB" readOnly tabIndex={-1} /></Space.Compact></label>
        </div>
        <label className="minecraft-jvm-editor__arguments" htmlFor="minecraft-jvm-arguments"><span>GC 调优参数 <small>每行一个</small></span><Input.TextArea
          id="minecraft-jvm-arguments"
          value={argumentsText}
          disabled={!canEdit || busy}
          spellCheck={false}
          autoSize={{ minRows: 7, maxRows: 18 }}
          placeholder="每行填写一个 JVM 调优参数；高性能参数由所选 Java 在启动前实际预检"
          onChange={event => { setArgumentsText(event.target.value); setPreset("custom"); }}
        /></label>
        <div className="minecraft-jvm-editor__footer">
          <Typography.Text type="secondary">启动前由实例 Java 验证；不兼容时服务端不会启动。</Typography.Text>
          <Button type="primary" loading={busy} disabled={!dirty || !checked.value || !canEdit || busy} onClick={() => void save()}>保存参数</Button>
        </div>
        {!checked.value && dirty ? <Alert type="error" showIcon message={checked.error} /> : null}
        {saveError ? <Alert type="error" showIcon message={saveError} /> : null}
      </section>
      <aside className="minecraft-jvm-info" aria-label="当前预设说明">
        <div className="minecraft-jvm-info__title"><span aria-hidden="true">◈</span><strong>{selectedPreset.title}</strong><Tag color={checked.value ? "success" : "error"}>{checked.value ? `${checked.value.jvmArguments.length} 项有效` : "待修正"}</Tag></div>
        <Typography.Paragraph>{preset === "high-performance" ? "扩展 G1 参数适用于 Java 服务端启动，包含 JVM 实验性调优项；不预触整堆或写共享内存。" : preset === "recommended" ? recommendedDescription : preset === "low-memory" ? "最大堆保持不变。" : "当前编辑值将在下次启动时应用。"}</Typography.Paragraph>
        <dl>
          <div><dt>初始堆</dt><dd>{initialHeapMb.toLocaleString()} MB</dd></div>
          <div><dt>最大堆</dt><dd>{memoryMb.toLocaleString()} MB</dd></div>
        </dl>
        {checked.value?.jvmArguments.length ? <ul className="minecraft-jvm-info__arguments" aria-label="下次启动使用的 GC 参数">
          {checked.value.jvmArguments.map(argument => <li key={argument}><code>{argument}</code></li>)}
        </ul> : <Typography.Text type="secondary">当前使用 Java 自带 G1 GC 默认策略。</Typography.Text>}
      </aside>
    </div>
    {!canEdit ? <Typography.Text className="minecraft-jvm-settings__readonly" type="secondary">只有实例停止、节点在线且当前账户有管理权限时才能保存。</Typography.Text> : null}
  </Card>;
}

// 输入栏动作命令总线：语音听写、中止回复与推理强度选择由输入栏组件持有，
// 快捷键注册在插件层，两者通过这条只传命令的通道对接，避免把工作台服务一路传进输入栏。
export type ComposerCommand = "dictation" | "stop" | "reasoning";

type ComposerHandler = () => void;

const handlers: Partial<Record<ComposerCommand, ComposerHandler>> = {};

/** 单个命令的处理函数由对应组件登记；每个命令独立，互不覆盖。 */
export function provideComposerCommand(command: ComposerCommand, handler: ComposerHandler): () => void {
  handlers[command] = handler;
  return () => {
    if (handlers[command] === handler) delete handlers[command];
  };
}

/** 执行输入栏命令；对应输入栏未挂载时返回 false，快捷键不产生假动作。 */
export function runComposerCommand(command: ComposerCommand): boolean {
  const handler = handlers[command];
  if (!handler) return false;
  handler();
  return true;
}
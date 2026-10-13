/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-scope。
 * LFAA 适配：DSH 依赖 dsh-invariants 服务与 scoped-events.generated.ts；LFAA 不引入该服务，
 * 改为导出可调用的运行时断言函数，供需要时自检 scope carrier 的使用是否正确。
 *
 * 文件：invariant.ts
 * 功能：scope carrier 使用正确性的轻量校验。
 * 作用：分发作用域过滤事件前自检——接收者必须是 scopeTarget 构造的 carrier。
 */
import { carrierKeyOf, isScopeCarrier } from "./index.js";

/**
 * 断言分发作用域过滤事件时 thisArg 是一个 scope carrier。
 * 不是 carrier 时抛出明确错误，提示用 scopeTarget(base, subject) 包裹。
 */
export function assertScopeCarrier(thisArg: unknown, eventName: string): asserts thisArg is object {
  if (!isScopeCarrier(thisArg)) {
    throw new Error(
      `lfaa-scope: 事件 "${eventName}" 是作用域过滤事件，但分发时 thisArg 不是 scope carrier；` +
      `请用 scopeTarget(base, subject) 包裹分发接收者。`
    );
  }
}

/** 断言 carrier 键与事件参数主体是同一对象（防止错配）。 */
export function assertCarrierSubjectMatch(
  carrier: unknown,
  subject: object,
  eventName: string
): void {
  const key = carrierKeyOf(carrier);
  if (key !== subject) {
    throw new Error(
      `lfaa-scope: 事件 "${eventName}" 的 carrier 键与事件参数主体不一致；carrier 键与事件主体必须是同一对象。`
    );
  }
}

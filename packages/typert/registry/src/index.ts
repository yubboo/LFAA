/**
 * 功能：提供 Cordis 插件可用的 Typert Remote 运行注册表。
 * 作用：原子登记插件方法、校验调用输入输出，并在贡献插件卸载时精确撤销方法。
 * 关联文件：packages/typert/protocol/src/index.ts、packages/typert/loader/src/index.ts、Host API 适配器。
 */
import { Service, type Context } from "@deepseek-ai/cordis";
import {
  assertTypertJsonValue, TypertError, typertEndpoint, validateTypertContribution,
  type TypertCallContext, type TypertContribution, type TypertHostMethod, type TypertRemoteDescriptor
} from "lfaa-typert-protocol/src/index.js";

export const name = "lfaaTypertRegistry";

export interface TypertRegistry {
  register(owner: Context, contribution: TypertContribution): void;
  get(namespace: string, method: string): TypertRemoteDescriptor | undefined;
  list(): readonly TypertRemoteDescriptor[];
  invoke<Principal>(namespace: string, method: string, input: unknown, context: TypertCallContext<Principal>): Promise<unknown>;
}

declare module "@deepseek-ai/cordis" { interface Context { lfaaTypertRegistry: TypertRegistry } }

interface RegisteredMethod { readonly contribution: string; readonly method: TypertHostMethod }

/** 所有状态由本服务持有；贡献方的 Context effect 负责撤销自身登记。 */
export default class TypertRegistryService extends Service implements TypertRegistry {
  private readonly methods = new Map<string, RegisteredMethod>();
  private readonly ids = new Map<string, string>();
  private closed = false;

  constructor(ctx: Context) {
    super(ctx, name);
    ctx.effect(() => () => this.close());
  }

  register(owner: Context, contribution: TypertContribution): void {
    validateTypertContribution(contribution);
    if (this.closed) throw new TypertError("closed", "Typert 注册表已关闭。");
    const endpoints = contribution.methods.map(({ namespace, method }) => typertEndpoint(namespace, method));
    for (let index = 0; index < contribution.methods.length; index += 1) {
      const method = contribution.methods[index]!;
      if (this.methods.has(endpoints[index]!) || this.ids.has(method.id)) throw new TypertError("duplicate_method", `Remote 方法已由其他插件登记：${endpoints[index]}。`);
    }
    owner.effect(() => {
      if (this.closed) throw new TypertError("closed", "Typert 注册表已关闭。");
      for (let index = 0; index < contribution.methods.length; index += 1) {
        const method = contribution.methods[index]!;
        if (this.methods.has(endpoints[index]!) || this.ids.has(method.id)) throw new TypertError("duplicate_method", `Remote 方法已由其他插件登记：${endpoints[index]}。`);
      }
      const entries: RegisteredMethod[] = [];
      for (let index = 0; index < contribution.methods.length; index += 1) {
        const method = Object.freeze({ ...contribution.methods[index]! });
        const endpoint = endpoints[index]!;
        const entry = Object.freeze({ contribution: contribution.package, method });
        this.methods.set(endpoint, entry);
        this.ids.set(method.id, endpoint);
        entries.push(entry);
      }
      return () => this.withdraw(entries);
    }, `typert:${contribution.package}`);
  }

  get(namespace: string, method: string): TypertRemoteDescriptor | undefined {
    const entry = this.methods.get(typertEndpoint(namespace, method));
    return entry ? this.toDescriptor(entry) : undefined;
  }

  list(): readonly TypertRemoteDescriptor[] {
    return [...this.methods.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, entry]) => this.toDescriptor(entry));
  }

  async invoke<Principal>(namespace: string, methodName: string, input: unknown, context: TypertCallContext<Principal>): Promise<unknown> {
    if (this.closed) throw new TypertError("closed", "Typert 注册表已关闭。");
    const endpoint = typertEndpoint(namespace, methodName);
    const entry = this.methods.get(endpoint);
    if (!entry) throw new TypertError("method_not_found", `找不到 Remote 方法：${endpoint}。`);
    if (context.signal.aborted) throw new TypertError("cancelled", `Remote 调用已取消：${endpoint}。`);
    let parsedInput: unknown;
    try {
      assertTypertJsonValue(input);
      parsedInput = entry.method.input.parse(input);
      assertTypertJsonValue(parsedInput);
    } catch (error) {
      throw new TypertError("invalid_input", `Remote 请求参数无效：${endpoint}。`, { cause: error });
    }
    if (await entry.method.authorize(context as TypertCallContext<unknown>) === false) {
      throw new TypertError("forbidden", `当前身份无权调用 Remote 方法：${endpoint}。`);
    }
    if (context.signal.aborted) throw new TypertError("cancelled", `Remote 调用已取消：${endpoint}。`);
    const result = await entry.method.invoke(parsedInput, context as TypertCallContext<unknown>);
    if (context.signal.aborted) throw new TypertError("cancelled", `Remote 调用已取消：${endpoint}。`);
    try {
      const parsedOutput = entry.method.output.parse(result);
      assertTypertJsonValue(parsedOutput);
      return parsedOutput;
    } catch (error) {
      throw new TypertError("invalid_output", `Remote 响应不符合协议：${endpoint}。`, { cause: error });
    }
  }

  private toDescriptor(entry: RegisteredMethod): TypertRemoteDescriptor {
    return Object.freeze({ id: entry.method.id, package: entry.contribution, namespace: entry.method.namespace, method: entry.method.method });
  }

  private withdraw(entries: readonly RegisteredMethod[]): void {
    for (const entry of entries) {
      const endpoint = typertEndpoint(entry.method.namespace, entry.method.method);
      if (this.methods.get(endpoint) !== entry) continue;
      this.methods.delete(endpoint);
      if (this.ids.get(entry.method.id) === endpoint) this.ids.delete(entry.method.id);
    }
  }

  private close(): void { this.closed = true; this.methods.clear(); this.ids.clear(); }
}

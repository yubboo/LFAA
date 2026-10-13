/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-scope。
 * LFAA 适配：DSH 的 effect 基于 Cordis fiber 生成器；LFAA 版保持分层容器语义（注册按作用域分层、
 * 读合并作用域链、最近层同名覆盖），effect 用同步 action+undo 模型，不依赖未使用的 fiber 生成器 API。
 *
 * 文件：store.ts
 * 功能：作用域分层注册容器——NamedEntries（命名表）、AnonymousEntries（匿名表）、ScopedLayers（分层所有权）。
 * 作用：skill 系统等按作用域注册能力时，全局层 + 各作用域层叠加，最近层同名覆盖。
 * 不负责：scope key 与 Cordis 上下文的绑定（在 index.ts）。
 */
import type { Context } from "@deepseek-ai/cordis";
import { scopeChainOf, scopeOf } from "./index.js";
import type { ScopeKey } from "./index.js";

/** 一个作用域对注册表的聚合贡献。 */
export interface ScopeLayer {
  /** 该层所有表是否都为空。 */
  isEmpty(): boolean;
}

/** 命名表内部读契约。 */
interface EntryValues<V> {
  values(): IterableIterator<V>;
  isEmpty(): boolean;
}

/**
 * 插入有序的命名条目表。同名重复由调用方注入的 duplicateError 判定函数报错。
 * 每次成功插入返回一个幂等的 undo（只撤本次插入）。
 */
export class NamedEntries<V> implements EntryValues<V> {
  private data = new Map<string, V>();

  constructor(private readonly duplicateError: (name: string) => Error) {}

  /** 插入一个本层唯一的名字；返回幂等 undo。 */
  insert(name: string, value: V): () => void {
    if (this.data.has(name)) throw this.duplicateError(name);
    this.data.set(name, value);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.data.delete(name);
      if (this.data.size === 0) this.data = new Map();
    };
  }

  get(name: string): V | undefined { return this.data.get(name); }
  has(name: string): boolean { return this.data.has(name); }
  keys(): IterableIterator<string> { return this.data.keys(); }
  entries(): IterableIterator<[string, V]> { return this.data.entries(); }
  values(): IterableIterator<V> { return this.data.values(); }
  isEmpty(): boolean { return this.data.size === 0; }
}

/** 插入有序的匿名条目表（等值也保持独立注册身份）。 */
export class AnonymousEntries<V> implements EntryValues<V> {
  private data = new Map<symbol, V>();

  append(value: V): () => void {
    const key = Symbol();
    this.data.set(key, value);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.data.delete(key);
      if (this.data.size === 0) this.data = new Map();
    };
  }

  values(): IterableIterator<V> { return this.data.values(); }
  isEmpty(): boolean { return this.data.size === 0; }
}

/**
 * 为一个注册表持有全局层与各精确作用域层。
 * 读不创建层；注册从传入的作用域推导可见性与撤销归属。
 */
export class ScopedLayers<L extends ScopeLayer> {
  /** 全局层（最先构造）。 */
  readonly global: L;

  private readonly scoped = new Map<ScopeKey, L>();

  constructor(
    private readonly createLayer: (scope: ScopeKey | undefined) => L,
    private readonly onChange: () => void = () => {},
  ) {
    this.global = createLayer(undefined);
  }

  /** 读一个已存在的精确作用域覆盖层；不创建。 */
  peek(scope: ScopeKey | undefined): L | undefined {
    if (scope === undefined) return undefined;
    return this.scoped.get(scope);
  }

  /** 沿作用域父链的已有层，最远祖先在前、精确作用域在最后（按序叠加则最近层最终决定）。 */
  chainLayers(scope: ScopeKey | undefined): L[] {
    const layers: L[] = [];
    for (const key of scopeChainOf(scope).reverse()) {
      const layer = this.scoped.get(key);
      if (layer !== undefined) layers.push(layer);
    }
    return layers;
  }

  /** 合并：全局命名表 + 作用域链阴影，最近层同名胜出。 */
  merge<V>(scope: ScopeKey | undefined, pick: (layer: L) => NamedEntries<V>): Map<string, V> {
    const merged = new Map(pick(this.global).entries());
    for (const layer of this.chainLayers(scope)) {
      for (const [name, value] of pick(layer).entries()) merged.set(name, value);
    }
    return merged;
  }

  /**
   * 把一次同步层变更挂到其注册上下文。返回 ctx.effect 的 disposer。
   * LFAA 适配：action 同步返回 undo；作用域层变空时回收。
   */
  effect(
    ctx: Context,
    action: (layer: L) => () => void,
    options: { label: string; notify?: boolean },
  ): () => void {
    const scope = scopeOf(ctx);
    const notify = options.notify ?? true;
    const layer = scope === undefined
      ? this.global
      : (this.scoped.get(scope) ?? this.createLayer(scope));
    if (scope !== undefined && !this.scoped.has(scope)) this.scoped.set(scope, layer);

    const undo = action(layer);
    if (notify) this.onChange();
    return ctx.effect(() => {
      undo();
      if (scope !== undefined && layer.isEmpty()) this.scoped.delete(scope);
      if (notify) this.onChange();
    });
  }
}

/**
 * 功能：为固定 DSH Client 插件提供 LFAA 账户语言兼容服务。
 * 作用：把 DSH 命名空间词典绑定到 LFAA `general.language`，并支持订阅与撤销。
 * 关联文件：client/index.ts、ApplicationWorkspace.tsx、packages/client/ui-layout/src/Workbench.tsx。
 */
export type LfaaLanguagePreference = "system" | "zh-CN" | "en-US";

export interface DshLocaleSnapshot {
  active: "zh-CN" | "en-US";
  revision: number;
}

export type DshLocaleDictionary = Readonly<Record<string, string>>;

export interface DshLocaleService {
  getSnapshot(): DshLocaleSnapshot;
  subscribe(listener: () => void): () => void;
  register(namespace: string, language: string, dictionary: DshLocaleDictionary): () => void;
  bind(namespace: string): (key: string, params?: Record<string, unknown>) => string;
}

function languageFromPreference(preference: LfaaLanguagePreference): "zh-CN" | "en-US" {
  if (preference === "en-US") return "en-US";
  if (preference === "zh-CN") return "zh-CN";
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("en") ? "en-US" : "zh-CN";
}

function sourceKey(key: string): string {
  const separator = key.indexOf("\u0000");
  return separator < 0 ? key : key.slice(separator + 1);
}

function translate(template: string, params?: Record<string, unknown>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/gu, (match, name: string) => name in params ? String(params[name]) : match);
}

export class DshLocaleRuntime implements DshLocaleService {
  private snapshotValue: DshLocaleSnapshot = { active: languageFromPreference("system"), revision: 0 };
  private readonly listeners = new Set<() => void>();
  private readonly dictionaries = new Map<string, Map<string, DshLocaleDictionary>>();

  getSnapshot = (): DshLocaleSnapshot => this.snapshotValue;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  setPreference(preference: LfaaLanguagePreference): void {
    const active = languageFromPreference(preference);
    if (active === this.snapshotValue.active) return;
    this.snapshotValue = { active, revision: this.snapshotValue.revision + 1 };
    for (const listener of [...this.listeners]) listener();
  }

  register(namespace: string, language: string, dictionary: DshLocaleDictionary): () => void {
    if (!namespace || !language || !dictionary || typeof dictionary !== "object") {
      throw new Error("DSH locale 词典登记参数无效。");
    }
    let languages = this.dictionaries.get(namespace);
    if (!languages) {
      languages = new Map();
      this.dictionaries.set(namespace, languages);
    }
    const copy = Object.freeze({ ...dictionary });
    languages.set(language.toLowerCase(), copy);
    return () => {
      if (languages?.get(language.toLowerCase()) !== copy) return;
      languages.delete(language.toLowerCase());
      if (!languages.size) this.dictionaries.delete(namespace);
    };
  }

  bind(namespace: string): (key: string, params?: Record<string, unknown>) => string {
    return (key, params) => {
      const activeLanguage = this.snapshotValue.active.toLowerCase().split("-")[0] ?? "zh";
      const dictionary = this.dictionaries.get(namespace)?.get(activeLanguage);
      const text = dictionary?.[key] ?? dictionary?.[sourceKey(key)] ?? sourceKey(key);
      return translate(text, params);
    };
  }
}

export const dshLocaleRuntime = new DshLocaleRuntime();

declare module "@deepseek-ai/cordis" {
  interface Context { locale: DshLocaleService }
}

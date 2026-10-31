import type { LanguageSupport } from "@codemirror/language";
import type { LintSource } from "@codemirror/lint";

export interface FileCodeLanguage {
  label: string;
  isJson: boolean;
  loadSupport: () => Promise<LanguageSupport | null>;
  loadLinter?: () => Promise<LintSource>;
}

const plainTextSupport = async () => null;

export function resolveFileCodeLanguage(fileName: string): FileCodeLanguage {
  const extension = fileName.slice(fileName.lastIndexOf(".") + 1).toLocaleLowerCase();
  if (extension === "json") return {
    label: "JSON",
    isJson: true,
    loadSupport: async () => (await import("@codemirror/lang-json")).json(),
    loadLinter: async () => (await import("@codemirror/lang-json")).jsonParseLinter()
  };
  if (["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"].includes(extension)) {
    const typescript = ["ts", "tsx", "mts", "cts"].includes(extension);
    return {
      label: typescript ? "TypeScript" : "JavaScript",
      isJson: false,
      loadSupport: async () => (await import("@codemirror/lang-javascript")).javascript({
        jsx: extension === "jsx" || extension === "tsx",
        typescript
      })
    };
  }
  if (["html", "htm"].includes(extension)) return {
    label: "HTML",
    isJson: false,
    loadSupport: async () => (await import("@codemirror/lang-html")).html()
  };
  if (extension === "css") return {
    label: "CSS",
    isJson: false,
    loadSupport: async () => (await import("@codemirror/lang-css")).css()
  };
  if (["md", "markdown"].includes(extension)) return {
    label: "Markdown",
    isJson: false,
    loadSupport: async () => (await import("@codemirror/lang-markdown")).markdown()
  };
  if (extension === "py") return {
    label: "Python",
    isJson: false,
    loadSupport: async () => (await import("@codemirror/lang-python")).python()
  };
  if (["yaml", "yml"].includes(extension)) return {
    label: "YAML",
    isJson: false,
    loadSupport: async () => (await import("@codemirror/lang-yaml")).yaml()
  };
  if (["xml", "svg"].includes(extension)) return {
    label: "XML",
    isJson: false,
    loadSupport: async () => (await import("@codemirror/lang-xml")).xml()
  };
  if (extension === "sql") return {
    label: "SQL",
    isJson: false,
    loadSupport: async () => (await import("@codemirror/lang-sql")).sql()
  };
  return { label: "纯文本", isJson: false, loadSupport: plainTextSupport };
}

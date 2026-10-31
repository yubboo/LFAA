import { useEffect, useMemo, useRef, useState } from "react";
import { basicSetup, EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting, type LanguageSupport } from "@codemirror/language";
import { lintGutter, linter, openLintPanel, type LintSource } from "@codemirror/lint";
import { tags } from "@lezer/highlight";
import { resolveFileCodeLanguage } from "./file-code-language.js";

interface FileCodePreviewProps {
  fileName: string;
  value: string;
  editing?: boolean;
  editable?: boolean;
  dirty?: boolean;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
}

interface LoadedLanguage {
  fileName: string;
  support: LanguageSupport | null;
  lintSource: LintSource | null;
  failed: boolean;
}

interface CursorPosition {
  line: number;
  column: number;
}

const fileCodeHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--settings-accent, var(--color-brand))", fontWeight: "600" },
  { tag: tags.string, color: "var(--color-status-success-text)" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "var(--color-status-warning)" },
  { tag: [tags.propertyName, tags.attributeName, tags.typeName, tags.className], color: "var(--settings-accent, var(--color-brand))" },
  { tag: tags.comment, color: "var(--color-status-success-text)", fontStyle: "italic" },
  { tag: [tags.operator, tags.punctuation], color: "var(--color-text-secondary)" },
  { tag: tags.variableName, color: "var(--color-text-primary)" }
]);

const fileCodeEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--color-text-primary)",
    backgroundColor: "color-mix(in srgb, var(--color-surface-muted) var(--settings-background-surface-opacity), transparent)"
  },
  ".cm-scroller": { overflow: "auto", fontFamily: "var(--settings-code-font, ui-monospace, monospace)" },
  ".cm-content": { minHeight: "100%", padding: "12px 0", fontSize: "var(--settings-code-font-size, 12px)", lineHeight: "1.65" },
  ".cm-line": { padding: "0 14px" },
  ".cm-gutters": {
    borderRight: "1px solid var(--color-border-subtle)",
    backgroundColor: "color-mix(in srgb, var(--color-surface-muted) var(--settings-background-surface-opacity), transparent)",
    color: "var(--color-text-muted)"
  },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--settings-accent, var(--color-brand)) 8%, transparent)" },
  ".cm-activeLineGutter": {
    color: "var(--settings-accent, var(--color-brand))",
    backgroundColor: "color-mix(in srgb, var(--settings-accent, var(--color-brand)) 12%, var(--color-surface))"
  },
  ".cm-cursor": { borderLeftColor: "var(--settings-accent, var(--color-brand))" },
  ".cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--settings-accent, var(--color-brand)) 24%, transparent)" },
  "&.cm-focused .cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--settings-accent, var(--color-brand)) 30%, transparent)" },
  ".cm-panels": { backgroundColor: "var(--color-surface)", color: "var(--color-text-primary)" },
  ".cm-panels-bottom": { borderTop: "1px solid var(--color-border-subtle)" },
  ".cm-tooltip": { border: "1px solid var(--color-border-subtle)", backgroundColor: "var(--color-surface)", color: "var(--color-text-primary)" },
  ".cm-tooltip-lint": { color: "var(--color-text-primary)" }
});

export default function FileCodePreview({ fileName, value, editing = false, editable = false, dirty = false, onChange, onSave }: FileCodePreviewProps) {
  const editorHost = useRef<HTMLDivElement | null>(null);
  const editorView = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const valueRef = useRef(value);
  const [lineCount, setLineCount] = useState(1);
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({ line: 1, column: 1 });
  const [jsonDiagnosticCount, setJsonDiagnosticCount] = useState<number | null>(null);
  const [loadedLanguage, setLoadedLanguage] = useState<LoadedLanguage | null>(null);
  const language = useMemo(() => resolveFileCodeLanguage(fileName), [fileName]);
  const languageReady = loadedLanguage?.fileName === fileName;

  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  valueRef.current = value;

  useEffect(() => {
    let active = true;
    setLoadedLanguage(null);
    setJsonDiagnosticCount(null);
    void Promise.all([
      language.loadSupport(),
      language.loadLinter ? language.loadLinter() : Promise.resolve(null)
    ]).then(([support, lintSource]) => {
      if (active) setLoadedLanguage({ fileName, support, lintSource, failed: false });
    }).catch(() => {
      if (active) setLoadedLanguage({ fileName, support: null, lintSource: null, failed: true });
    });
    return () => { active = false; };
  }, [fileName, language]);

  useEffect(() => {
    const parent = editorHost.current;
    if (!parent || !languageReady || !loadedLanguage) return;
    const lintSource = loadedLanguage.lintSource
      ? async (view: EditorView) => {
        const diagnostics = await loadedLanguage.lintSource!(view);
        setJsonDiagnosticCount(diagnostics.length);
        return diagnostics;
      }
      : null;
    const view = new EditorView({
      doc: valueRef.current,
      parent,
      extensions: [
        basicSetup,
        ...(loadedLanguage.support ? [loadedLanguage.support] : []),
        ...(lintSource ? [linter(lintSource), lintGutter()] : []),
        syntaxHighlighting(fileCodeHighlightStyle),
        fileCodeEditorTheme,
        EditorState.readOnly.of(!editable),
        EditorView.editable.of(editable),
        EditorView.contentAttributes.of({
          "aria-label": `${editable ? "代码编辑器" : "只读代码预览"}：${fileName}`,
          spellcheck: "false"
        }),
        ...(editable ? [EditorView.domEventHandlers({
          keydown: (event, currentView) => {
            if (!(event.ctrlKey || event.metaKey) || event.key.toLocaleLowerCase() !== "s") return false;
            onSaveRef.current?.(currentView.state.doc.toString());
            event.preventDefault();
            return true;
          }
        })] : []),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString());
            setLineCount(current => current === update.state.doc.lines ? current : update.state.doc.lines);
            if (language.isJson && editable) setJsonDiagnosticCount(null);
          }
          if (update.selectionSet) {
            const cursor = update.state.selection.main.head;
            const line = update.state.doc.lineAt(cursor);
            const nextPosition = { line: line.number, column: cursor - line.from + 1 };
            setCursorPosition(current => current.line === nextPosition.line && current.column === nextPosition.column ? current : nextPosition);
          }
        })
      ]
    });
    editorView.current = view;
    setLineCount(view.state.doc.lines);
    const initialLine = view.state.doc.lineAt(view.state.selection.main.head);
    setCursorPosition({ line: initialLine.number, column: view.state.selection.main.head - initialLine.from + 1 });
    return () => {
      if (editorView.current === view) editorView.current = null;
      view.destroy();
    };
  }, [editable, fileName, language.isJson, languageReady, loadedLanguage]);

  useEffect(() => {
    const view = editorView.current;
    if (!view) return;
    const currentValue = view.state.doc.toString();
    if (currentValue === value) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [fileName, languageReady, value]);

  const openJsonDiagnostics = () => {
    const view = editorView.current;
    if (view) openLintPanel(view);
  };

  const editorMode = editing || editable;

  return <section className={`file-manager__code-surface file-manager__code-surface--${editorMode ? "editing" : "preview"}`} aria-label={`${language.label} 文件${editorMode ? "编辑" : "预览"}`}>
    <div className="file-manager__code-toolbar">
      <span className="file-manager__code-language">{language.label}</span>
      <span className="file-manager__code-toolbar-detail">{editable ? `${lineCount} 行` : `只读预览 · ${lineCount} 行`}</span>
      {editable && dirty ? <span className="file-manager__code-dirty">未保存</span> : null}
      {language.isJson ? <button className="file-manager__code-toolbar-action" type="button" onClick={openJsonDiagnostics}>查看 JSON 语法问题</button> : null}
      <span className="file-manager__code-toolbar-hint">{editable ? "Ctrl+F 查找 · Ctrl+S 保存" : editorMode ? "只读 · Ctrl+F 查找" : "Ctrl+F 查找"}</span>
    </div>
    {languageReady
      ? <div className="file-manager__code-editor" ref={editorHost} />
      : <div className="file-manager__code-editor file-manager__code-editor--loading" role="status">正在加载 {language.label} 语法支持…</div>}
    <div className="file-manager__code-status">
      <span>第 {cursorPosition.line} 行，{cursorPosition.column} 列</span>
      {languageReady && loadedLanguage?.failed && !language.isJson ? <span className="file-manager__code-status-error">语法高亮加载失败，已保留文本内容</span> : null}
      {language.isJson ? <span className={loadedLanguage?.failed && languageReady || jsonDiagnosticCount ? "file-manager__code-status-error" : jsonDiagnosticCount === 0 ? "file-manager__code-status-valid" : ""}>
        {loadedLanguage?.failed && languageReady ? "JSON 语法检查未加载" : !languageReady || jsonDiagnosticCount === null ? "JSON 语法检查中…" : jsonDiagnosticCount ? `${jsonDiagnosticCount} 处 JSON 语法错误` : "JSON 语法检查通过"}
      </span> : null}
    </div>
  </section>;
}

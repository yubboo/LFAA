/**
 * 功能：工具呈现（render intent）的中立类型词汇表。
 * 作用：让工具以与 UI 无关的标签联合声明一次调用/结果如何在界面渲染，桥接层按 card 字段分发。
 * 关联文件：core/agent-tool-presentation（模型函数调用呈现）、shell 工具的终端卡。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-tools/presentation。
 */

/** 一次工具调用的类别，供 UI 选择图标/处理方式。 */
export type ToolCallKind = 'read' | 'edit' | 'delete' | 'move' | 'search' | 'execute' | 'fetch' | 'other';

/** 工具读取/修改的文件位置，供编辑器跟随高亮或跳转。 */
export interface FileLocation {
  path: string;
  /** 1-based 聚焦行号。 */
  line?: number;
}

/** 工具即将做的单文件改动，供内联差异卡渲染。 */
export interface FileDiff {
  path: string;
  /** 旧内容；新建文件/覆盖时为 null（调用期拿不到旧内容）。 */
  oldText: string | null;
  /** 改动后内容。 */
  newText: string;
}

/**
 * 待处理调用的呈现意图（标签联合）。content 使用未知内容块占位，桥接层映射到自身内容类型。
 */
export type ToolCallView = GenericCallView | TerminalCallView | DiffCallView;

/** 默认卡片：带标题、类别图标、原始输入、跟随文件位置。 */
export interface GenericCallView {
  card: 'generic';
  /** 简短人类可读标题。 */
  title: string;
  kind?: ToolCallKind;
  /** 详情视图展示的关键输入。 */
  rawInput?: unknown;
  /** UI 内容块。 */
  content?: unknown[];
  /** 跟随文件位置。 */
  locations?: FileLocation[];
}

/** 终端命令调用：工作目录头 + 命令标题。 */
export interface TerminalCallView {
  card: 'terminal';
  title: string;
  description?: string;
  /** 工作目录头；相对路径由桥接层相对会话工作区解析。 */
  cwd?: string;
}

/** 文件改动调用：内联差异卡。 */
export interface DiffCallView {
  card: 'diff';
  title: string;
  diffs: FileDiff[];
  locations?: FileLocation[];
}

/** 已完成读取的文件行。 */
export interface ReadFileLine {
  /** 1-based 文件行号。 */
  number: number;
  /** 去掉尾部换行的行文本。 */
  text: string;
}

/** 已完成调用的呈现（结果态标签联合）。 */
export type ToolResultView =
  | GenericResultView
  | TerminalResultView
  | DiffResultView
  | ReadResultView;

/** 默认完成卡片。 */
export interface GenericResultView {
  card: 'generic';
  title?: string;
  content?: unknown[];
}

/** 终端命令完成态：捕获输出与退出状态。 */
export interface TerminalResultView {
  card: 'terminal';
  title?: string;
  /** 合并捕获的命令输出。 */
  output?: string;
  /** 进程退出码（信号终止时缺省）。 */
  exitCode?: number;
  /** 杀死进程的信号名，与 exitCode 互斥。 */
  signal?: string;
}

/** 文件改动完成态：应用后的差异。 */
export interface DiffResultView {
  card: 'diff';
  title?: string;
  diffs: FileDiff[];
}

/** 文件读取完成态：带行号的代码视图。 */
export interface ReadResultView {
  card: 'read';
  title?: string;
  path: string;
  offset: number;
  lines: ReadFileLine[];
  totalLines: number;
  lang?: string;
  content?: unknown[];
}

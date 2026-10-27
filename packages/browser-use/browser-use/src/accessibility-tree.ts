/**
 * Bound and minimize the accessibility snapshot sent from Browser Owner to the Agent Loop.
 * Page-provided names/text are untrusted; control values and arbitrary properties are discarded.
 */
export type BrowserAccessibilityNode = string | {
  role?: string;
  name?: string;
  text?: string;
  checked?: boolean | "mixed";
  disabled?: boolean;
  expanded?: boolean;
  active?: boolean;
  invalid?: boolean;
  level?: number;
  pressed?: boolean | "mixed";
  selected?: boolean;
  placeholder?: string;
  children?: BrowserAccessibilityNode[];
};

const MAX_NODES = 119;
const MAX_DEPTH = 8;
const MAX_TOTAL_CHARS = 8_000;
const MAX_FIELD_CHARS = 240;
const SENSITIVE_NAME = /(?:password|passcode|secret|token|api[\s_-]?key|authorization|验证码|密码|密钥|令牌)/iu;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu;

/**
 * Keep only roles, accessible labels, visible text and a small set of state flags.
 * In particular, Playwright's `value`, URL, geometry, and unknown properties never cross this boundary.
 */
export function boundBrowserAccessibilityTree(value: unknown): BrowserAccessibilityNode[] | null {
  if (!Array.isArray(value)) return null;
  const state = { nodes: 0, chars: 0, truncated: false };
  const text = (value: unknown): string | undefined => {
    if (typeof value !== "string" || state.chars >= MAX_TOTAL_CHARS) return undefined;
    const safe = value.replace(CONTROL_CHARACTERS, " ").slice(0, Math.min(MAX_FIELD_CHARS, MAX_TOTAL_CHARS - state.chars));
    state.chars += safe.length;
    if (safe.length < value.length) state.truncated = true;
    return safe;
  };
  const visit = (item: unknown, depth: number): BrowserAccessibilityNode | null => {
    if (state.nodes >= MAX_NODES || depth > MAX_DEPTH || state.chars >= MAX_TOTAL_CHARS) {
      state.truncated = true;
      return null;
    }
    if (typeof item === "string") {
      state.nodes += 1;
      return text(item) ?? "";
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    state.nodes += 1;
    const raw = item as Record<string, unknown>;
    const role = text(raw.role);
    const name = text(raw.name);
    const sensitiveField = SENSITIVE_NAME.test(name ?? "") || SENSITIVE_NAME.test(String(raw.placeholder ?? ""));
    const node: Exclude<BrowserAccessibilityNode, string> = {};
    if (role) node.role = role.slice(0, 40);
    if (name) node.name = sensitiveField ? "受保护的敏感字段" : name;
    if (!sensitiveField) {
      const content = text(raw.text);
      if (content) node.text = content;
      const placeholder = text(raw.placeholder);
      if (placeholder) node.placeholder = SENSITIVE_NAME.test(placeholder) ? "受保护的敏感字段" : placeholder;
    }
    for (const key of ["checked", "pressed"] as const) {
      const flag = raw[key];
      if (typeof flag === "boolean" || flag === "mixed") node[key] = flag;
    }
    for (const key of ["disabled", "expanded", "active", "invalid", "selected"] as const) {
      const flag = raw[key];
      if (typeof flag === "boolean") node[key] = flag;
    }
    if (typeof raw.level === "number" && Number.isSafeInteger(raw.level) && raw.level >= 0 && raw.level <= 100) node.level = raw.level;
    if (Array.isArray(raw.children)) {
      const children: BrowserAccessibilityNode[] = [];
      for (const child of raw.children) {
        const bounded = visit(child, depth + 1);
        if (bounded !== null) children.push(bounded);
        if (state.nodes >= MAX_NODES || state.chars >= MAX_TOTAL_CHARS) {
          state.truncated = true;
          break;
        }
      }
      if (children.length) node.children = children;
    }
    return node;
  };
  const tree: BrowserAccessibilityNode[] = [];
  for (const item of value) {
    const bounded = visit(item, 0);
    if (bounded !== null) tree.push(bounded);
    if (state.nodes >= MAX_NODES || state.chars >= MAX_TOTAL_CHARS) {
      state.truncated = true;
      break;
    }
  }
  if (state.truncated) tree.push({ role: "note", text: "无障碍快照已截断。" });
  return tree;
}

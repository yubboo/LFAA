// 网站访问与下载权限规则表 + 「浏览器操作权限」独立子页（执行 URL / 下载文件），共享同一份持久化规则。
import { useState } from "react";
import { IconArrowLeft, IconPlus, IconTrash } from "@tabler/icons-react";
import { SettingSelect, SettingsPage, settingsStyles as baseStyles } from "@lfaa/ui-primitives/client";
import type { BrowserPolicyDecision, BrowserSiteRule } from "@lfaa/browser/contract";
import styles from "./Browser-Settings.module.css";

const POLICY_OPTIONS = (isZh: boolean): Array<{ value: BrowserPolicyDecision; label: string }> => [
  { value: "ask", label: isZh ? "需要批准" : "Ask" },
  { value: "allow", label: isZh ? "始终允许" : "Always allow" },
  { value: "block", label: isZh ? "屏蔽" : "Block" },
];

/** 嵌入「浏览器权限」分组的清爽网站权限表：右上角按需展开添加栏，下拉菜单不受容器裁剪。 */
export function BrowserSiteRulesTable({
  isZh,
  defaultBrowse,
  defaultDownload,
  rules,
  onChangeDefaults,
  onChangeRules,
}: {
  isZh: boolean;
  defaultBrowse: BrowserPolicyDecision;
  defaultDownload: BrowserPolicyDecision;
  rules: BrowserSiteRule[];
  onChangeDefaults: (patch: { defaultBrowsePolicy?: BrowserPolicyDecision; defaultDownloadPolicy?: BrowserPolicyDecision }) => void;
  onChangeRules: (nextRules: BrowserSiteRule[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [pattern, setPattern] = useState("");
  const options = POLICY_OPTIONS(isZh);

  const handleAdd = () => {
    const clean = pattern.trim();
    if (!clean) return;
    onChangeRules([
      ...rules,
      { id: `rule-${Date.now()}`, pattern: clean, browse: "allow", download: "ask" },
    ]);
    setPattern("");
    setAdding(false);
  };

  return (
    <div>
      <div className={styles.rulesHeaderRow}>
        <div className={styles.rulesHeaderText}>
          <span className={styles.rulesHeaderTitle}>{isZh ? "网站权限" : "Website permissions"}</span>
          <span className={styles.rulesHeaderDesc}>
            {isZh ? "设置默认权限，并为特定网站单独配置例外" : "Set default permissions and site-specific overrides"}
          </span>
        </div>
        <button type="button" className={baseStyles.actionBtn} onClick={() => setAdding((v) => !v)}>
          <IconPlus size={14} aria-hidden="true" />
          <span>{isZh ? "添加" : "Add"}</span>
        </button>
      </div>

      {adding && (
        <div className={styles.addRuleBar}>
          <input
            type="text"
            className={baseStyles.input}
            value={pattern}
            autoFocus
            placeholder={isZh ? "输入域名或模式，如 github.com 或 *.example.com" : "Domain or pattern, e.g. github.com"}
            onChange={(e) => setPattern(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          />
          <button type="button" className={baseStyles.actionBtn} disabled={!pattern.trim()} onClick={handleAdd}>
            {isZh ? "确定" : "Confirm"}
          </button>
        </div>
      )}

      <div className={styles.rulesTable}>
        <div className={styles.rulesHead}>
          <span>{isZh ? "网站或模式" : "Site or pattern"}</span>
          <span>{isZh ? "浏览" : "Browse"}</span>
          <span>{isZh ? "下载" : "Download"}</span>
          <span />
        </div>
        <div className={styles.rulesRow}>
          <span>{isZh ? "默认" : "Default"}</span>
          <SettingSelect<BrowserPolicyDecision>
            value={defaultBrowse}
            label={isZh ? "默认浏览权限" : "Default browse policy"}
            options={options}
            onChange={(val) => onChangeDefaults({ defaultBrowsePolicy: val })}
          />
          <SettingSelect<BrowserPolicyDecision>
            value={defaultDownload}
            label={isZh ? "默认下载权限" : "Default download policy"}
            options={options}
            onChange={(val) => onChangeDefaults({ defaultDownloadPolicy: val })}
          />
          <span />
        </div>
        {rules.map((rule) => (
          <div key={rule.id} className={styles.rulesRow}>
            <span className={styles.itemTitle} title={rule.pattern}>{rule.pattern}</span>
            <SettingSelect<BrowserPolicyDecision>
              value={rule.browse}
              label={`${rule.pattern} browse`}
              options={options}
              onChange={(val) => onChangeRules(rules.map((r) => (r.id === rule.id ? { ...r, browse: val } : r)))}
            />
            <SettingSelect<BrowserPolicyDecision>
              value={rule.download}
              label={`${rule.pattern} download`}
              options={options}
              onChange={(val) => onChangeRules(rules.map((r) => (r.id === rule.id ? { ...r, download: val } : r)))}
            />
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={isZh ? `删除 ${rule.pattern}` : `Remove ${rule.pattern}`}
              onClick={(e) => {
                const dialog = e.currentTarget.closest<HTMLElement>('[role="dialog"]');
                onChangeRules(rules.filter((r) => r.id !== rule.id));
                dialog?.focus();
              }}
            >
              <IconTrash size={14} />
            </button>
          </div>
        ))}
      </div>

      {rules.length === 0 && (
        <p className={styles.rulesFootNote}>
          {isZh ? "此处仅显示设置了自定义权限的网站" : "Only websites with custom permissions appear here"}
        </p>
      )}
    </div>
  );
}

/** 独立二级子页「浏览器操作权限」：将「执行 URL」与「下载文件」分卡管理，与主表共享同一套持久化规则。 */
export function BrowserOperationRulesSubpage({
  isZh,
  rules,
  onChangeRules,
  onBack,
}: {
  isZh: boolean;
  rules: BrowserSiteRule[];
  onChangeRules: (nextRules: BrowserSiteRule[]) => void;
  onBack: () => void;
}) {
  const [addingKind, setAddingKind] = useState<"browse" | "download" | null>(null);
  const [pattern, setPattern] = useState("");
  const [decision, setDecision] = useState<BrowserPolicyDecision>("allow");
  const options = POLICY_OPTIONS(isZh);

  const handleSave = (kind: "browse" | "download") => {
    const clean = pattern.trim();
    if (!clean) return;
    const existing = rules.find((r) => r.pattern.toLowerCase() === clean.toLowerCase());
    if (existing) {
      onChangeRules(rules.map((r) => (r.id === existing.id ? { ...r, [kind]: decision } : r)));
    } else {
      onChangeRules([
        ...rules,
        {
          id: `rule-${Date.now()}`,
          pattern: clean,
          browse: kind === "browse" ? decision : "ask",
          download: kind === "download" ? decision : "ask",
        },
      ]);
    }
    setPattern("");
    setAddingKind(null);
  };

  const removeFromKind = (rule: BrowserSiteRule, kind: "browse" | "download", el: HTMLElement) => {
    const dialog = el.closest<HTMLElement>('[role="dialog"]');
    const otherKind = kind === "browse" ? "download" : "browse";
    if (rule[otherKind] !== "ask") {
      onChangeRules(rules.map((r) => (r.id === rule.id ? { ...r, [kind]: "ask" } : r)));
    } else {
      onChangeRules(rules.filter((r) => r.id !== rule.id));
    }
    dialog?.focus();
  };

  const renderCard = (kind: "browse" | "download", title: string, desc: string) => {
    const visibleRules = rules.filter((r) => r[kind] !== "ask");
    return (
    <div className={styles.opCard}>
      <div className={styles.opCardHead}>
        <div>
          <div className={styles.opCardTitle}>{title}</div>
          <div className={styles.opCardDesc}>{desc}</div>
        </div>
        <button
          type="button"
          className={baseStyles.actionBtn}
          onClick={() => { setAddingKind(addingKind === kind ? null : kind); setPattern(""); }}
        >
          {isZh ? "添加" : "Add"}
        </button>
      </div>

      {addingKind === kind && (
        <div className={styles.addRuleBar}>
          <input
            type="text"
            className={baseStyles.input}
            value={pattern}
            autoFocus
            placeholder={isZh ? "输入 URL 或域名模式，如 *.github.com" : "URL or domain pattern"}
            onChange={(e) => setPattern(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(kind); } }}
          />
          <SettingSelect<BrowserPolicyDecision>
            value={decision}
            label={title}
            options={options}
            onChange={setDecision}
          />
          <button type="button" className={baseStyles.actionBtn} disabled={!pattern.trim()} onClick={() => handleSave(kind)}>
            {isZh ? "保存" : "Save"}
          </button>
        </div>
      )}

      {visibleRules.map((rule) => (
        <div key={`${kind}-${rule.id}`} className={styles.opRuleRow}>
          <span className={styles.itemTitle} title={rule.pattern}>{rule.pattern}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <SettingSelect<BrowserPolicyDecision>
              value={rule[kind]}
              label={`${rule.pattern} ${kind}`}
              options={options}
              onChange={(val) => onChangeRules(rules.map((r) => (r.id === rule.id ? { ...r, [kind]: val } : r)))}
            />
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={isZh ? `删除 ${rule.pattern}` : `Remove ${rule.pattern}`}
              onClick={(e) => removeFromKind(rule, kind, e.currentTarget)}
            >
              <IconTrash size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
    );
  };

  return (
    <SettingsPage title={isZh ? "浏览器操作权限" : "Browser Operation Permissions"}>
      <div className={styles.breadcrumb}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          <IconArrowLeft size={14} aria-hidden="true" />
          <span>{isZh ? "返回" : "Back"}</span>
        </button>
      </div>

      <div className={styles.opCardList}>
        {renderCard(
          "browse",
          isZh ? "执行 URL" : "Execute URL",
          isZh ? "允许/禁止智能体对特定 URL 的浏览器操作访问。" : "Allow or deny agent browser operations on specific URLs.",
        )}
        {renderCard(
          "download",
          isZh ? "下载文件" : "Download files",
          isZh ? "允许或拒绝智能体浏览器从指定网站下载文件。" : "Allow or deny agent browser downloads from specific websites.",
        )}
      </div>
    </SettingsPage>
  );
}

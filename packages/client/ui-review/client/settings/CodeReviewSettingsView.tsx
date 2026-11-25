// 渲染设置中心「编码 → 代码审查」页：仅展示已真实接线的审查策略、自定义指令与已探测本地仓库。
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { StatusBanner } from "@lfaa/ui-primitives/client";
import {
  createDefaultCodingSettingsClient,
  fetchCodingSettings,
  fetchDiscoveredGitRepos,
  patchCodingSettings,
  type CodeReviewCodingSettings,
  type GitRepoDiscoveryItem,
  type ReviewAgentFocus,
  type ChatLocaleMessages,
} from "@lfaa/client-ui-chat/client";
import {
  SettingFormField,
  SettingGroup,
  SettingRow,
  SettingSelect,
  SettingsPage,
  SettingSwitch,
  settingsStyles as baseStyles,
} from "@lfaa/ui-primitives/client";
import extraStyles from "./CodingSettingsExtras.module.css";

const PAGE_SIZE = 8;

/** 载入真实生效的审查策略与已探测本地仓库，不展示未接线的占位开关。 */
export function CodeReviewSettingsView({
  locale,
  onOpenCodeReviewWorkbench,
}: {
  locale: ChatLocaleMessages;
  onOpenCodeReviewWorkbench?: () => void;
}) {
  const isZh = locale.isZh;
  const [cfg, setCfg] = useState<CodeReviewCodingSettings>(() => createDefaultCodingSettingsClient().codeReview);
  const [repos, setRepos] = useState<GitRepoDiscoveryItem[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void fetchCodingSettings()
      .then((res) => setCfg(res.codeReview))
      .catch(() => {});
    void fetchDiscoveredGitRepos()
      .then((list) => setRepos(list))
      .catch(() => {});
  }, []);

  const updateReviewCfg = useCallback(async (patch: Partial<CodeReviewCodingSettings>) => {
    setNotice("");
    setCfg((prev) => ({ ...prev, ...patch }));
    try {
      const next = await patchCodingSettings({ codeReview: patch });
      setCfg(next.codeReview);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const filteredRepos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (repo) => repo.slug.toLowerCase().includes(q) || repo.name.toLowerCase().includes(q) || repo.rootPath.toLowerCase().includes(q),
    );
  }, [repos, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRepos.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRepos = filteredRepos.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <SettingsPage
      title={isZh ? "代码审查" : "Code review"}
      description={isZh
        ? "配置内置代码审查引擎的检查侧重、扫描深度与自定义审查指令。"
        : "Configure review focus, scan depth, and custom instructions for the built-in code review engine."}
      actions={onOpenCodeReviewWorkbench ? (
        <button type="button" className={baseStyles.actionBtn} onClick={onOpenCodeReviewWorkbench}>
          {isZh ? "打开审查工作台" : "Open workbench"}
        </button>
      ) : undefined}
    >
      {notice && (
        <StatusBanner
          tone="error"
          message={notice}
          onDismiss={() => setNotice("")}
        />
      )}

      <SettingGroup title={isZh ? "审查策略" : "Review Policy"}>
        <SettingRow
          title={isZh ? "默认审查侧重" : "Default Review Focus"}
          description={isZh ? "控制内置代码审查引擎优先检出的风险类型" : "Prioritize risk categories during code reviews"}
          control={(
            <SettingSelect<ReviewAgentFocus>
              value={cfg.reviewAgentFocus}
              label={isZh ? "默认审查侧重" : "Review Focus"}
              options={[
                { value: "balanced", label: isZh ? "均衡审查（缺陷 + 规范）" : "Balanced" },
                { value: "security", label: isZh ? "安全漏洞与密钥泄漏" : "Security Audit" },
                { value: "performance", label: isZh ? "性能与异常处理" : "Performance" },
                { value: "strict", label: isZh ? "严格类型与规范" : "Strict Types" },
              ]}
              onChange={(val) => void updateReviewCfg({ reviewAgentFocus: val })}
            />
          )}
        />
        <SettingRow
          title={isZh ? "全面深度扫描" : "Thorough Deep Scan"}
          description={isZh ? "启用全量 Diff 规则组合而不仅检查选定焦点" : "Run all review rules in addition to the primary focus"}
          control={(
            <SettingSwitch
              checked={cfg.thoroughReview}
              label={isZh ? "全面深度扫描" : "Thorough Deep Scan"}
              onChange={(checked) => void updateReviewCfg({ thoroughReview: checked })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup
        title={isZh ? "自定义审查指令" : "Custom Review Instructions"}
        description={isZh
          ? "在运行代码审查与 /review 时自动注入审查提示与报告摘要中。"
          : "Injected into code reviews and /review runs."}
      >
        <SettingFormField label={isZh ? "审查指令" : "Instructions"}>
          <textarea
            className={`${baseStyles.input} ${baseStyles.textarea}`}
            aria-label={isZh ? "自定义审查指令" : "Custom Review Instructions"}
            value={cfg.customReviewInstructions}
            placeholder={isZh ? "例如：重点检查跨包边界、未清理的事件监听、硬编码路径..." : "e.g., check package boundaries and cleanup hooks..."}
            onChange={(e) => setCfg((prev) => ({ ...prev, customReviewInstructions: e.target.value }))}
            onBlur={() => void updateReviewCfg({ customReviewInstructions: cfg.customReviewInstructions })}
          />
        </SettingFormField>
      </SettingGroup>

      <section className={baseStyles.groupSection} aria-label={isZh ? "代码仓库" : "Detected Local Repositories"}>
        <h2 className={baseStyles.groupTitle}>{isZh ? "代码仓库" : "Detected Local Repositories"}</h2>
        <div className={baseStyles.row}>
          <div className={extraStyles.repoSearchWrap}>
            <IconSearch size={14} stroke={1.8} className={extraStyles.repoSearchIcon} />
            <input
              type="search"
              className={extraStyles.repoSearchInput}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder={isZh ? "搜索代码仓库" : "Search repositories"}
              aria-label={isZh ? "搜索代码仓库" : "Search repositories"}
            />
          </div>
        </div>

        <div className={baseStyles.groupList}>
          {pageRepos.length === 0 ? (
            <p className={baseStyles.rowDesc}>
              {isZh ? "当前工作区尚未探测到 Git 代码仓库，绑定本地 Git 项目后将自动显示于此。" : "No local Git repositories detected yet."}
            </p>
          ) : (
            pageRepos.map((repo) => (
              <div key={repo.id} className={extraStyles.repoRowBtn}>
                <span className={baseStyles.rowText}>
                  <span className={baseStyles.rowTitle}>{repo.slug}</span>
                  <span className={baseStyles.rowDesc}>{repo.branch || "HEAD"} · {repo.rootPath}</span>
                </span>
                {repo.dirtyCount > 0 && (
                  <span className={extraStyles.repoOverrideBadge}>{repo.dirtyCount} {isZh ? "变更" : "dirty"}</span>
                )}
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className={extraStyles.pagerRow}>
            <button
              type="button"
              className={`${baseStyles.actionBtn} ${extraStyles.pagerBtn}`}
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {isZh ? "上一页" : "Previous"}
            </button>
            <button
              type="button"
              className={`${baseStyles.actionBtn} ${extraStyles.pagerBtn}`}
              disabled={safePage + 1 >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              {isZh ? "下一页" : "Next"}
            </button>
          </div>
        )}
      </section>
    </SettingsPage>
  );
}

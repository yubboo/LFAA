// 渲染设置中心「编码 → 代码审查」页：偏好设置 / 审查智能体两个子页、仓库清单与自定义审查指令。
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconChevronRight, IconSearch } from "@tabler/icons-react";
import { StatusBanner } from "@lfaa/ui-primitives/client";
import {
  createDefaultCodingSettingsClient,
  fetchCodingSettings,
  fetchDiscoveredGitRepos,
  patchCodingSettings,
  type CodeReviewCodingSettings,
  type GitRepoDiscoveryItem,
  type RepoAutoReviewMode,
  type RepoProviderKind,
  type ReviewAgentFocus,
  type ReviewTriggerCondition,
  type ChatLocaleMessages,
} from "@lfaa/client-ui-chat/client";
import {
  SettingFormField,
  SettingGroup,
  SettingRow,
  SettingSegmented,
  SettingSelect,
  SettingsPage,
  SettingSwitch,
  settingsStyles as baseStyles,
} from "@lfaa/ui-primitives/client";
import extraStyles from "./CodingSettingsExtras.module.css";

const PAGE_SIZE = 8;

const NEXT_OVERRIDE_ORDER: Record<RepoAutoReviewMode, RepoAutoReviewMode> = {
  inherit: "enabled",
  enabled: "disabled",
  disabled: "inherit",
};

/** 载入审查设置和本机仓库清单，在偏好与审查智能体页之间切换。 */
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
    setCfg((prev) => ({
      ...prev,
      ...patch,
      repoOverrides: patch.repoOverrides ? { ...prev.repoOverrides, ...patch.repoOverrides } : prev.repoOverrides,
    }));
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

  const cycleRepoPolicy = (repoSlug: string) => {
    const current = cfg.repoOverrides[repoSlug] ?? "inherit";
    const nextMode = NEXT_OVERRIDE_ORDER[current];
    void updateReviewCfg({ repoOverrides: { [repoSlug]: nextMode } });
  };

  const renderPolicyLabel = (mode: RepoAutoReviewMode) => {
    if (mode === "enabled") return isZh ? "自动代码审查: 已强制启用" : "Auto review: Enabled";
    if (mode === "disabled") return isZh ? "自动代码审查: 已关闭" : "Auto review: Disabled";
    return isZh ? "自动代码审查: 遵循个人偏好" : "Auto review: Follow personal preference";
  };

  return (
    <SettingsPage
      title={isZh ? "代码审查" : "Code review"}
      description={isZh
        ? "配置何时审查、审查侧重，以及每个仓库的覆盖策略。"
        : "Configure when reviews run, what they focus on, and per-repository overrides."}
      actions={onOpenCodeReviewWorkbench ? (
        <button type="button" className={baseStyles.actionBtn} onClick={onOpenCodeReviewWorkbench}>
          {isZh ? "打开审查工作台" : "Open workbench"}
        </button>
      ) : undefined}
    >
      <SettingSegmented
        value={cfg.activeSubTab}
        label={isZh ? "代码审查设置分类" : "Code Review Sections"}
        options={[
          { value: "preferences", label: isZh ? "偏好设置" : "Preferences" },
          { value: "agent", label: isZh ? "审查智能体" : "Review agent" },
        ]}
        onChange={(activeSubTab) => void updateReviewCfg({ activeSubTab })}
      />

      {notice && (
        <StatusBanner
          tone="error"
          message={notice}
          onDismiss={() => setNotice("")}
        />
      )}

      {cfg.activeSubTab === "preferences" ? (
        <>
          <section className={baseStyles.groupSection} aria-label={isZh ? "代码仓库" : "Repositories"}>
            <h2 className={baseStyles.groupTitle}>{isZh ? "代码仓库" : "Repositories"}</h2>
            <p className={baseStyles.groupDesc}>
              {isZh
                ? "点击某个仓库可在「遵循个人偏好 / 强制启用 / 关闭」之间切换它的自动审查策略。"
                : "Click a repository to cycle its auto-review policy between inherit, enabled, and disabled."}
            </p>

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
              <SettingSelect<RepoProviderKind>
                value={cfg.repoProvider}
                label={isZh ? "仓库来源" : "Repository Source"}
                options={[
                  { value: "local", label: isZh ? "本地与绑定仓库" : "Local & Bound" },
                  { value: "github", label: "GitHub" },
                ]}
                onChange={(val) => {
                  setPage(0);
                  void updateReviewCfg({ repoProvider: val });
                }}
              />
            </div>

            <div className={baseStyles.groupList}>
              {pageRepos.length === 0 ? (
                <p className={baseStyles.rowDesc}>
                  {isZh ? "当前工作区尚未探测到 Git 代码仓库，绑定本地 Git 项目后将自动显示于此。" : "No local Git repositories detected yet."}
                </p>
              ) : (
                pageRepos.map((repo) => {
                  const override = cfg.repoOverrides[repo.slug] ?? "inherit";
                  return (
                    <button
                      key={repo.id}
                      type="button"
                      className={extraStyles.repoRowBtn}
                      onClick={() => cycleRepoPolicy(repo.slug)}
                    >
                      <span className={baseStyles.rowText}>
                        <span className={baseStyles.rowTitle}>{repo.slug}</span>
                        <span className={baseStyles.rowDesc}>{renderPolicyLabel(override)} · {repo.branch || "HEAD"}</span>
                      </span>
                      <span className={extraStyles.repoRight}>
                        {repo.dirtyCount > 0 && (
                          <span className={extraStyles.repoOverrideBadge}>{repo.dirtyCount} {isZh ? "变更" : "dirty"}</span>
                        )}
                        <IconChevronRight size={15} stroke={1.8} />
                      </span>
                    </button>
                  );
                })
              )}
            </div>

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
          </section>

          <SettingGroup title={isZh ? "个人偏好" : "Personal Preferences"}>
            <SettingRow
              title={isZh ? "自动代码审查" : "Automatic Code Review"}
              description={
                isZh
                  ? "如果代码仓库的审查设置与你的个人偏好不同，则以代码仓库的设置为准"
                  : "Repository-specific review settings override your personal preferences"
              }
              control={(
                <SettingSwitch
                  checked={cfg.autoReview}
                  label={isZh ? "自动代码审查" : "Automatic Code Review"}
                  onChange={(checked) => void updateReviewCfg({ autoReview: checked })}
                />
              )}
            />
            <SettingRow
              title={isZh ? "审核触发条件" : "Review Trigger Condition"}
              description={isZh ? "选择 LFAA 何时审查你的 Pull Request 与本地提交" : "Choose when LFAA reviews your PRs and local commits"}
              control={(
                <SettingSelect<ReviewTriggerCondition>
                  value={cfg.triggerCondition}
                  label={isZh ? "审核触发条件" : "Review Trigger"}
                  options={[
                    { value: "on_pr_open", label: isZh ? "打开 PR 时" : "When PR opens" },
                    { value: "on_push", label: isZh ? "每次推送提交时" : "On every push" },
                    { value: "manual", label: isZh ? "仅手动触发" : "Manual only" },
                  ]}
                  onChange={(val) => void updateReviewCfg({ triggerCondition: val })}
                />
              )}
            />
            <SettingRow
              title={isZh ? "全面代码审查" : "Thorough Code Review"}
              description={isZh ? "继续查找结果，直到 LFAA 不再发现新问题" : "Keep scanning until LFAA stops finding new issues"}
              control={(
                <SettingSwitch
                  checked={cfg.thoroughReview}
                  label={isZh ? "全面代码审查" : "Thorough Code Review"}
                  onChange={(checked) => void updateReviewCfg({ thoroughReview: checked })}
                />
              )}
            />
            <SettingRow
              title={isZh ? "将额度用于审查" : "Use Credits for Reviews"}
              description={isZh ? "达到速率限制后，允许消耗额度进行审查" : "Allow consuming quota for reviews after hitting rate limits"}
              control={(
                <SettingSwitch
                  checked={cfg.useQuotaForReview}
                  label={isZh ? "将额度用于审查" : "Use Credits for Reviews"}
                  onChange={(checked) => void updateReviewCfg({ useQuotaForReview: checked })}
                />
              )}
            />
          </SettingGroup>
        </>
      ) : (
        <>
          <SettingGroup title={isZh ? "审查智能体策略" : "Review Agent Policy"}>
            <SettingRow
              title={isZh ? "默认审查侧重" : "Default Review Focus"}
              description={isZh ? "控制内置代码审查引擎优先检出的风险类型" : "Prioritize risk categories during automated code reviews"}
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
              : "Injected into automated reviews and /review runs."}
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
        </>
      )}
    </SettingsPage>
  );
}
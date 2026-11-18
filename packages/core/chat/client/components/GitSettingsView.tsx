// 渲染设置中心「编码 → Git」配置页：分支前缀、PR 合并策略、强制推送、草稿 PR、/review 展示方式及提交/PR 指令。
import { useCallback, useEffect, useState } from "react";
import { StatusBanner } from "@lfaa/ui-primitives/client";
import {
  createDefaultCodingSettingsClient,
  fetchCodingSettings,
  patchCodingSettings,
  type GitCodingSettings,
} from "../coding-settings-client";
import type { ChatLocaleMessages } from "../locales";
import { SettingGroupCard, SettingRow, SettingSwitch } from "./GeneralSettingsControls";
import baseStyles from "./GeneralSettingsView.module.css";
import extraStyles from "./CodingSettingsExtras.module.css";

/** 编辑 Git 与 PR 文案偏好，通过编码设置接口保存用户的仓库操作默认值。 */
export function GitSettingsView({
  locale,
  onOpenCodeReviewWorkbench,
}: {
  locale: ChatLocaleMessages;
  onOpenCodeReviewWorkbench?: () => void;
}) {
  const isZh = locale.isZh;
  const [gitCfg, setGitCfg] = useState<GitCodingSettings>(() => createDefaultCodingSettingsClient().git);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void fetchCodingSettings()
      .then((cfg) => setGitCfg(cfg.git))
      .catch(() => {});
  }, []);

  const updateGit = useCallback(async (patch: Partial<GitCodingSettings>) => {
    setNotice("");
    setGitCfg((prev) => ({ ...prev, ...patch }));
    try {
      const next = await patchCodingSettings({ git: patch });
      setGitCfg(next.git);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return (
    <section className={baseStyles.root} aria-label="Git">
      <div className={extraStyles.headerRow}>
        <h1 className={baseStyles.pageTitle}>Git</h1>
        {onOpenCodeReviewWorkbench && (
          <button type="button" className={baseStyles.actionBtn} onClick={onOpenCodeReviewWorkbench}>
            {isZh ? "打开内置 Git 与审查工作台" : "Open Git & Review Workbench"}
          </button>
        )}
      </div>

      {notice && (
        <StatusBanner
          tone="error"
          message={notice}
          onDismiss={() => setNotice("")}
        />
      )}

      <SettingGroupCard>
        <SettingRow
          title={isZh ? "分支前缀" : "Branch Prefix"}
          description={isZh ? "LFAA 创建新分支时使用的前缀" : "Prefix used when LFAA creates a new branch"}
          control={(
            <input
              type="text"
              className={extraStyles.prefixInput}
              aria-label={isZh ? "分支前缀" : "Branch Prefix"}
              value={gitCfg.branchPrefix}
              placeholder="lfaa/"
              onChange={(e) => setGitCfg((prev) => ({ ...prev, branchPrefix: e.target.value }))}
              onBlur={() => void updateGit({ branchPrefix: gitCfg.branchPrefix })}
            />
          )}
        />

        <SettingRow
          title={isZh ? "Pull Request 合并方法" : "Pull Request Merge Method"}
          description={isZh ? "选择 LFAA 合并 Pull Request 的方式" : "Choose how LFAA merges pull requests"}
          control={(
            <div className={baseStyles.segmented} role="group" aria-label={isZh ? "Pull Request 合并方法" : "PR Merge Method"}>
              <button
                type="button"
                className={`${baseStyles.segBtn} ${gitCfg.prMergeMethod === "merge" ? baseStyles.segBtnActive : ""}`}
                onClick={() => void updateGit({ prMergeMethod: "merge" })}
              >
                {isZh ? "合并" : "Merge"}
              </button>
              <button
                type="button"
                className={`${baseStyles.segBtn} ${gitCfg.prMergeMethod === "squash" ? baseStyles.segBtnActive : ""}`}
                onClick={() => void updateGit({ prMergeMethod: "squash" })}
              >
                {isZh ? "压缩合并" : "Squash"}
              </button>
            </div>
          )}
        />

        <SettingRow
          title={isZh ? "始终强制推送" : "Always Force Push"}
          description={isZh ? "从 LFAA 推送时使用 --force-with-lease" : "Use --force-with-lease when pushing from LFAA"}
          control={(
            <SettingSwitch
              checked={gitCfg.alwaysForcePush}
              label={isZh ? "始终强制推送" : "Always Force Push"}
              onChange={(checked) => void updateGit({ alwaysForcePush: checked })}
            />
          )}
        />

        <SettingRow
          title={isZh ? "创建草稿 Pull Request" : "Create Draft Pull Request"}
          description={isZh ? "从 LFAA 创建 PR 时默认使用草稿 Pull Request" : "Default to draft pull requests when creating PRs from LFAA"}
          control={(
            <SettingSwitch
              checked={gitCfg.createDraftPr}
              label={isZh ? "创建草稿 Pull Request" : "Create Draft Pull Request"}
              onChange={(checked) => void updateGit({ createDraftPr: checked })}
            />
          )}
        />

        <SettingRow
          title={isZh ? "审查结果呈现方式" : "Review Result Presentation"}
          description={
            isZh
              ? "尽可能在当前聊天中启动 /review，或启动单独的审查聊天"
              : "Start /review inline in the current chat when possible, or open a separate review chat"
          }
          control={(
            <div className={baseStyles.segmented} role="group" aria-label={isZh ? "审查结果呈现方式" : "Review Presentation"}>
              <button
                type="button"
                className={`${baseStyles.segBtn} ${gitCfg.reviewDisplayMode === "inline" ? baseStyles.segBtnActive : ""}`}
                onClick={() => void updateGit({ reviewDisplayMode: "inline" })}
              >
                {isZh ? "内联" : "Inline"}
              </button>
              <button
                type="button"
                className={`${baseStyles.segBtn} ${gitCfg.reviewDisplayMode === "separate" ? baseStyles.segBtnActive : ""}`}
                onClick={() => void updateGit({ reviewDisplayMode: "separate" })}
              >
                {isZh ? "单独" : "Separate"}
              </button>
            </div>
          )}
        />
      </SettingGroupCard>

      <section className={baseStyles.groupSection}>
        <h2 className={baseStyles.groupTitle}>{isZh ? "提交指令" : "Commit Instructions"}</h2>
        <p className={extraStyles.sectionLead}>
          {isZh ? "将添加到提交信息生成提示中" : "Added to commit message generation prompts"}
        </p>
        <textarea
          className={extraStyles.promptTextarea}
          aria-label={isZh ? "提交指令" : "Commit Instructions"}
          value={gitCfg.commitInstructions}
          placeholder={isZh ? "添加提交信息指引..." : "Add commit message instructions..."}
          onChange={(e) => setGitCfg((prev) => ({ ...prev, commitInstructions: e.target.value }))}
          onBlur={() => void updateGit({ commitInstructions: gitCfg.commitInstructions })}
        />
      </section>

      <section className={baseStyles.groupSection}>
        <h2 className={baseStyles.groupTitle}>{isZh ? "Pull Request 指令" : "Pull Request Instructions"}</h2>
        <p className={extraStyles.sectionLead}>
          {isZh ? "将添加到 PR 标题/摘要生成提示中" : "Added to PR title and summary generation prompts"}
        </p>
        <textarea
          className={extraStyles.promptTextarea}
          aria-label={isZh ? "Pull Request 指令" : "Pull Request Instructions"}
          value={gitCfg.prInstructions}
          placeholder={isZh ? "添加 Pull Request 指引..." : "Add Pull Request instructions..."}
          onChange={(e) => setGitCfg((prev) => ({ ...prev, prInstructions: e.target.value }))}
          onBlur={() => void updateGit({ prInstructions: gitCfg.prInstructions })}
        />
      </section>
    </section>
  );
}

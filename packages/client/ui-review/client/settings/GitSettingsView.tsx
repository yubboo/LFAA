// 渲染设置中心「编码 → Git」页：分支前缀、PR 合并策略、强制推送、草稿 PR、审查呈现方式与指令类表单。
import { useCallback, useEffect, useState } from "react";
import { StatusBanner } from "@lfaa/ui-primitives/client";
import {
  createDefaultCodingSettingsClient,
  fetchCodingSettings,
  patchCodingSettings,
  type GitCodingSettings,
  type ChatLocaleMessages,
} from "@lfaa/client-ui-chat/client";
import {
  SettingFormField,
  SettingGroup,
  SettingRow,
  SettingSegmented,
  SettingsPage,
  settingsStyles as baseStyles,
} from "@lfaa/ui-primitives/client";

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
    <SettingsPage
      title="Git"
      description={isZh
        ? "LFAA 创建分支、提交与发起 Pull Request 时的默认行为。"
        : "Defaults LFAA uses when creating branches, committing, and opening pull requests."}
      actions={onOpenCodeReviewWorkbench ? (
        <button type="button" className={baseStyles.actionBtn} onClick={onOpenCodeReviewWorkbench}>
          {isZh ? "打开 Git 工作台" : "Open workbench"}
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

      <SettingGroup title={isZh ? "分支与审查" : "Branch & review"}>
        <SettingRow
          title={isZh ? "分支前缀" : "Branch prefix"}
          description={isZh ? "LFAA 创建新分支时使用的前缀" : "Prefix used when LFAA creates a new branch"}
          control={(
            <input
              type="text"
              className={`${baseStyles.input} ${baseStyles.inputNarrow}`}
              aria-label={isZh ? "分支前缀" : "Branch Prefix"}
              value={gitCfg.branchPrefix}
              placeholder="lfaa/"
              onChange={(e) => setGitCfg((prev) => ({ ...prev, branchPrefix: e.target.value }))}
              onBlur={() => void updateGit({ branchPrefix: gitCfg.branchPrefix })}
            />
          )}
        />

        <SettingRow
          title={isZh ? "审查结果呈现方式" : "Review result presentation"}
          description={
            isZh
              ? "尽可能在当前聊天中启动 /review，或启动单独的审查聊天"
              : "Start /review inline in the current chat when possible, or open a separate review chat"
          }
          control={(
            <SettingSegmented
              value={gitCfg.reviewDisplayMode}
              label={isZh ? "审查结果呈现方式" : "Review Presentation"}
              options={[
                { value: "inline", label: isZh ? "内联" : "Inline" },
                { value: "separate", label: isZh ? "单独" : "Separate" },
              ]}
              onChange={(reviewDisplayMode) => void updateGit({ reviewDisplayMode })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title={isZh ? "提交指令" : "Commit instructions"}>
        <SettingFormField
          label={isZh ? "提交信息指令" : "Commit message instructions"}
          hint={isZh ? "将追加到提交信息生成提示中。" : "Appended to commit message generation prompts."}
        >
          <textarea
            className={`${baseStyles.input} ${baseStyles.textarea}`}
            aria-label={isZh ? "提交指令" : "Commit Instructions"}
            value={gitCfg.commitInstructions}
            placeholder={isZh ? "添加提交信息指引..." : "Add commit message instructions..."}
            onChange={(e) => setGitCfg((prev) => ({ ...prev, commitInstructions: e.target.value }))}
            onBlur={() => void updateGit({ commitInstructions: gitCfg.commitInstructions })}
          />
        </SettingFormField>
      </SettingGroup>
    </SettingsPage>
  );
}
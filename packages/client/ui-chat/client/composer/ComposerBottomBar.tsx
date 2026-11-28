// 输入卡片底部工具条：汇总左侧 + 菜单、项目胶囊、权限/技能/插件入口与右侧模型、媒体、发送控件。
// 关联：packages/client/ui-chat/client/composer/ChatComposer.tsx；运行环境：浏览器。
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconDots, IconPlugConnected, IconStack2, IconTrash } from "@tabler/icons-react";
import { HoverTip } from "@lfaa/ui-primitives/client";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import {
  MediaRatioPicker,
  MediaStylePicker,
  type MediaRatioChoice,
  type MediaStyleChoice,
} from "@lfaa/client-ui-tool-media/client";
import type { ChatClientStore } from "../store/chat-store";
import type { ChatLocaleMessages } from "../locales";
import type { ComposerStoreSlice } from "./useChatComposer";
import type { CapabilityMode } from "./composer-capabilities";
import { ComposerCapabilityTriggers } from "./ComposerCapabilityPanel";
import { ComposerProjectChip } from "./ComposerProjectChip";
import { ComposerRightActions } from "./ComposerRightActions";
import { PermissionModePicker } from "./PermissionModePicker";
import { SessionModeBar } from "./SessionModeBar";
import { ModelReasoningPicker } from "../models/ModelReasoningPicker";
import composerStyles from "../conversation/ChatWorkspace.composer.module.css";
import capStyles from "./ComposerCapabilityPanel.module.css";

export function ComposerBottomBar({
  locale,
  store,
  state,
  isWorkMode,
  messagesCount,
  showScopeShelf,
  addMenu,
  showInlineProjectChip,
  activeProject,
  projectMenuOpen,
  isRunning,
  bindingProject,
  capabilityMode,
  hasActiveSession,
  selectedMediaKind,
  mediaStyle,
  mediaRatio,
  draft,
  canSend,
  showContinue,
  onToggleProjectMenu,
  onToggleCapabilityMode,
  onDeleteRequest,
  onMediaStyleChange,
  onMediaRatioChange,
  onOpenSettings,
  onChangeDraft,
  onSend,
  onStop,
  onContinue,
  onNotice,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  state: ComposerStoreSlice;
  isWorkMode: boolean;
  messagesCount: number;
  showScopeShelf: boolean;
  addMenu: ReactNode;
  showInlineProjectChip: boolean;
  activeProject: WorkbenchProjectItem | null;
  projectMenuOpen: boolean;
  isRunning: boolean;
  bindingProject: boolean;
  capabilityMode: CapabilityMode | null;
  hasActiveSession: boolean;
  selectedMediaKind?: string | null | undefined;
  mediaStyle: MediaStyleChoice;
  mediaRatio: MediaRatioChoice;
  draft: string;
  canSend: boolean;
  showContinue: boolean;
  onToggleProjectMenu: () => void;
  onToggleCapabilityMode: (mode: CapabilityMode) => void;
  onDeleteRequest: () => void;
  onMediaStyleChange: (value: MediaStyleChoice) => void;
  onMediaRatioChange: (value: MediaRatioChoice) => void;
  onOpenSettings: () => void;
  onChangeDraft: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onContinue: () => void;
  onNotice: (message: string) => void;
}) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement | null>(null);
  const hasOverflowTools = isWorkMode || hasActiveSession;

  useEffect(() => {
    if (!overflowOpen) return;
    const onOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && overflowRef.current?.contains(event.target)) return;
      setOverflowOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOverflowOpen(false);
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [overflowOpen]);

  return (
    <div className={composerStyles.composerBar}>
      <div className={composerStyles.controls}>
        {messagesCount === 0 && !showScopeShelf && <SessionModeBar store={store} isZh={locale.isZh} compact={!isWorkMode} />}
        {addMenu}
        {showInlineProjectChip && activeProject && (
          <ComposerProjectChip
            locale={locale}
            project={activeProject}
            open={projectMenuOpen}
            disabled={isRunning || bindingProject}
            onToggle={onToggleProjectMenu}
          />
        )}

        {isWorkMode && (
          <PermissionModePicker
            locale={locale}
            mode={state.permissionMode}
            onSelectMode={(nextMode) => void store.setPermissionMode(nextMode)}
          />
        )}

        {/* 宽栏直接展开「技能 / 插件 / 删除对话」，窄栏（≤30rem）折叠进单个「···」菜单保持呼吸感。 */}
        {hasOverflowTools && (
          <>
            <div className={capStyles.wideTools}>
              {isWorkMode && (
                <ComposerCapabilityTriggers
                  isZh={locale.isZh}
                  activeMode={capabilityMode}
                  onToggleMode={onToggleCapabilityMode}
                />
              )}

              {hasActiveSession && (
                <HoverTip label={locale.deleteChat}>
                  <button
                    type="button"
                    className={composerStyles.toolBtn}
                    aria-label={locale.deleteChat}
                    onClick={onDeleteRequest}
                  >
                    <IconTrash size={14} aria-hidden="true" />
                  </button>
                </HoverTip>
              )}
            </div>

            <div ref={overflowRef} className={capStyles.overflowWrap}>
              <HoverTip label={locale.isZh ? "更多工具" : "More tools"}>
                <button
                  type="button"
                  className={capStyles.overflowBtn}
                  data-active={overflowOpen || Boolean(capabilityMode) ? "true" : undefined}
                  aria-haspopup="menu"
                  aria-expanded={overflowOpen}
                  aria-label={locale.isZh ? "更多工具" : "More tools"}
                  onClick={() => setOverflowOpen((open) => !open)}
                >
                  <IconDots size={15} stroke={1.9} aria-hidden="true" />
                </button>
              </HoverTip>

              {overflowOpen && (
                <div role="menu" className={capStyles.overflowMenu} aria-label={locale.isZh ? "更多工具" : "More tools"}>
                  {isWorkMode && (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className={capStyles.overflowItem}
                        data-active={capabilityMode === "skill" ? "true" : undefined}
                        onClick={() => {
                          setOverflowOpen(false);
                          onToggleCapabilityMode("skill");
                        }}
                      >
                        <IconStack2 size={15} stroke={1.8} className={capStyles.iconSkill} aria-hidden="true" />
                        <span>{locale.isZh ? "技能" : "Skills"}</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={capStyles.overflowItem}
                        data-active={capabilityMode === "plugin" ? "true" : undefined}
                        onClick={() => {
                          setOverflowOpen(false);
                          onToggleCapabilityMode("plugin");
                        }}
                      >
                        <IconPlugConnected size={15} stroke={1.8} className={capStyles.iconPlugin} aria-hidden="true" />
                        <span>{locale.isZh ? "插件" : "Plugins"}</span>
                      </button>
                    </>
                  )}
                  {isWorkMode && hasActiveSession && <div className={capStyles.overflowDivider} />}
                  {hasActiveSession && (
                    <button
                      type="button"
                      role="menuitem"
                      className={`${capStyles.overflowItem} ${capStyles.overflowDanger}`}
                      onClick={() => {
                        setOverflowOpen(false);
                        onDeleteRequest();
                      }}
                    >
                      <IconTrash size={15} stroke={1.8} aria-hidden="true" />
                      <span>{locale.deleteChat}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className={composerStyles.rightCluster}>
        {selectedMediaKind === "image" && <MediaStylePicker isZh={locale.isZh} value={mediaStyle} onChange={onMediaStyleChange} />}
        {selectedMediaKind === "image" && <MediaRatioPicker isZh={locale.isZh} value={mediaRatio} onChange={onMediaRatioChange} />}
        <ModelReasoningPicker
          isZh={locale.isZh}
          profiles={state.profiles}
          activeProfileId={state.activeProfileId}
          reasoningLevel={state.reasoningLevel}
          compact={!isWorkMode}
          onSelectProfile={(profileId) => void store.setActiveProfile(profileId)}
          onSelectBrandModel={(profileId, modelId) => void store.selectBrandModel(profileId, modelId)}
          onRefreshBrandModels={(profileId) => store.fetchRemoteModels({ profileId }).then(() => {})}
          onSelectReasoning={(level) => store.setReasoningLevel(level)}
          onOpenSettings={onOpenSettings}
        />

        <ComposerRightActions
          locale={locale}
          draft={draft}
          canSend={canSend}
          isRunning={isRunning}
          paused={showContinue}
          onChangeDraft={onChangeDraft}
          onSend={onSend}
          onStop={onStop}
          onContinue={onContinue}
          onNotice={onNotice}
        />
      </div>
    </div>
  );
}

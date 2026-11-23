// 输入框上方三类触发浮层：@ 提及、/ 命令与 $ 技能，保持与原输入框同样的定位与选择行为。
import type { ComponentProps } from "react";
import { MentionPopover, SlashCommandPopover } from "./MentionPopover";
import type { ChatLocaleMessages } from "../locales";

type MentionEntry = NonNullable<ComponentProps<typeof MentionPopover>["entries"]>[number];
type SlashEntry = NonNullable<ComponentProps<typeof SlashCommandPopover>["entries"]>[number];

type TriggerState = { query: string; startIndex: number } | null;

export function ComposerTriggers({
  locale,
  mentionTrigger,
  mentionEntries,
  mentionIndex,
  onSelectMention,
  slashTrigger,
  slashCommands,
  slashIndex,
  onSelectSlash,
  skillTrigger,
  skillEntries,
  skillIndex,
  onSelectSkill,
}: {
  locale: ChatLocaleMessages;
  mentionTrigger: TriggerState;
  mentionEntries: MentionEntry[];
  mentionIndex: number;
  onSelectMention: (entry: MentionEntry) => void;
  slashTrigger: TriggerState;
  slashCommands: SlashEntry[];
  slashIndex: number;
  onSelectSlash: (entry: SlashEntry) => void;
  skillTrigger: TriggerState;
  skillEntries: MentionEntry[];
  skillIndex: number;
  onSelectSkill: (entry: MentionEntry) => void;
}) {
  return (
    <>
      {mentionTrigger && (
        <MentionPopover
          locale={locale}
          entries={mentionEntries}
          highlightedIndex={mentionIndex}
          onSelect={onSelectMention}
        />
      )}
      {slashTrigger && (
        <SlashCommandPopover
          isZh={locale.isZh}
          entries={slashCommands}
          highlightedIndex={slashIndex}
          onSelect={onSelectSlash}
        />
      )}
      {skillTrigger && (
        <MentionPopover
          locale={locale}
          entries={skillEntries}
          highlightedIndex={skillIndex}
          onSelect={onSelectSkill}
        />
      )}
    </>
  );
}
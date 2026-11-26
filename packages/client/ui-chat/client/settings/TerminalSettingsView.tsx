// 设置中心「终端」页：一行展示位置（右侧面板 / 底部面板），切换后立即生效并记住。
import { useSyncExternalStore } from "react";
import { SettingGroup, SettingRow, SettingSegmented, SettingsPage } from "@lfaa/ui-primitives/client";
import {
  readTerminalPlacement,
  subscribeTerminalPlacement,
  writeTerminalPlacement,
  type TerminalPlacement,
} from "../workbench/terminal-placement";

/** 终端展示位置设置页；沿用设置中心统一的页头、分组与行式结构。 */
export function TerminalSettingsView({ isZh }: { isZh: boolean }) {
  const placement = useSyncExternalStore(subscribeTerminalPlacement, readTerminalPlacement, readTerminalPlacement);

  return (
    <SettingsPage title={isZh ? "终端" : "Terminal"}>
      <SettingGroup title={isZh ? "布局" : "Layout"}>
        <SettingRow
          title={isZh ? "展示位置" : "Position"}
          description={
            isZh
              ? "在右侧工作台以标签页打开，或停在工作台底部。"
              : "Open as a tab in the right workbench, or dock at the bottom of the workbench."
          }
          control={(
            <SettingSegmented<TerminalPlacement>
              value={placement}
              label={isZh ? "终端展示位置" : "Terminal position"}
              options={[
                { value: "right", label: isZh ? "右侧面板" : "Right panel" },
                { value: "bottom", label: isZh ? "底部面板" : "Bottom panel" },
              ]}
              onChange={writeTerminalPlacement}
            />
          )}
        />
      </SettingGroup>
    </SettingsPage>
  );
}

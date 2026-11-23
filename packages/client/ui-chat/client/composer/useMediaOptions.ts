// 输入栏的生图选项：画幅与风格，以及发送后把宿主实际采用的比例回写到选择器。
import { useState } from "react";
import { MEDIA_RATIO_OPTIONS, type MediaRatioChoice, type MediaStyleChoice } from "@lfaa/client-ui-tool-media/client";

/** 仅在选中生图模型时使用；状态随输入栏组件生命周期保存。 */
export function useMediaOptions() {
  const [ratio, setRatio] = useState<MediaRatioChoice>("auto");
  const [style, setStyle] = useState<MediaStyleChoice>("auto");

  /** 描述里写了比例时宿主以它为准：把选择器同步成实际比例，避免显示与成图不一致。 */
  const syncRatio = (actual: string | undefined): void => {
    if (!actual || ratio === "auto" || actual === ratio) return;
    if ((MEDIA_RATIO_OPTIONS as readonly string[]).includes(actual)) setRatio(actual as MediaRatioChoice);
  };

  return { ratio, setRatio, style, setStyle, syncRatio };
}
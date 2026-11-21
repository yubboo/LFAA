// 将聊天消息的素材来源与操作传给 Markdown 内的预览组件。
import { createContext } from "react";
import type { MediaRatioChoice, MediaSource } from "../chat-media";

export interface MediaResultContextValue {
  isZh: boolean;
  sessionId: string;
  messageId: string;
  busy: boolean;
  /** 生成结果是否叠加「小鱼 agent 生成」水印。 */
  brandWatermark: boolean;
  onQuote: (source: MediaSource, url: string, label: string) => void;
  /** 再次生图：带上来源图片比例，生成占位才能和原图同形。 */
  onRegenerate: (source: MediaSource, ratio?: MediaRatioChoice) => void;
}

export const MediaResultContext = createContext<MediaResultContextValue | null>(null);

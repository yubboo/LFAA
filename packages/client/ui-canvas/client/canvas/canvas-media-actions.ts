// 画布媒体编辑动作：在浏览器将编辑参数转换为独立的图片、视频或音轨。
import { cropPixels, gridRegions, mediaOutputSize, renderMediaImage, type CanvasMediaOperation, type CropPercent, type ImageAnnotation } from "./canvas-media-image";
import { exportVideoClip, frameSampleTimes, seekVideo } from "./canvas-media-video";

export interface CanvasMediaParameters {
  crop: CropPercent;
  rotation: number;
  side: number;
  start: number;
  end: number;
  longEdge: number;
  frameCount: number;
  annotation: ImageAnnotation;
}

export const defaultMediaParameters: CanvasMediaParameters = {
  crop: { x: 0, y: 0, width: 100, height: 100 }, rotation: 0, side: 3, start: 0, end: 0,
  longEdge: 1920, frameCount: 6, annotation: { text: "", x: 8, y: 85 },
};

export async function exportCanvasMedia(operation: CanvasMediaOperation, source: HTMLImageElement | HTMLVideoElement,
  params: CanvasMediaParameters, signal: AbortSignal, invalidCrop: string): Promise<Blob[]> {
  const video = source instanceof HTMLVideoElement ? source : null;
  const width = video ? video.videoWidth : (source as HTMLImageElement).naturalWidth;
  const height = video ? video.videoHeight : (source as HTMLImageElement).naturalHeight;
  const whole = { x: 0, y: 0, width, height };
  const region = operation === "crop" || operation === "videoCrop" ? cropPixels(width, height, params.crop) : whole;
  if (!region) throw new Error(invalidCrop);

  if (video) {
    video.pause();
    if (operation === "trim" || operation === "splitTracks") {
      return [await exportVideoClip(video, params.start, params.end, signal, { tracks: operation === "splitTracks" ? "video" : "both" })];
    }
    if (operation === "videoCrop" || operation === "videoResize") {
      const edge = operation === "videoResize" ? params.longEdge : Math.max(2, Math.floor(Math.max(region.width, region.height) / 2) * 2);
      const size = mediaOutputSize(region.width, region.height, edge, true);
      return [await exportVideoClip(video, params.start, params.end, signal, { picture: { region, size } })];
    }
    if (operation === "frameStrip") {
      const frames: Blob[] = [];
      for (const time of frameSampleTimes(params.start, params.end, params.frameCount)) {
        await seekVideo(video, time, signal);
        frames.push(await renderMediaImage(video, region));
      }
      return frames;
    }
  }

  const options = {
    ...(operation === "rotate" ? { degrees: params.rotation } : {}),
    ...(operation === "imageResize" ? { size: mediaOutputSize(width, height, params.longEdge) } : {}),
    ...(operation === "annotate" ? { annotation: params.annotation } : {}),
  };
  const regions = operation === "splitGrid" ? gridRegions(width, height, params.side) : [region];
  const images: Blob[] = [];
  for (const area of regions) {
    signal.throwIfAborted();
    images.push(await renderMediaImage(source, area, options));
  }
  return images;
}

/** 音频由浏览器下载，不能上传到仅接收图片与视频的画布素材接口。 */
export function downloadCanvasAudio(blob: Blob, stem: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${stem}.${blob.type === "audio/mp4" ? "m4a" : "webm"}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

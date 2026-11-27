// 画布图像几何与输出：裁剪、转向、缩放、文字和九宫格均从原始像素渲染。
export type VideoOperation = "snapshot" | "trim" | "videoCrop" | "videoResize" | "frameStrip" | "splitTracks";
export type CanvasMediaOperation = VideoOperation | "crop" | "rotate" | "splitGrid" | "imageResize" | "annotate" | "contactSheet";

export interface CanvasMediaOutput { blob: Blob; name: string }
export interface CropPercent { x: number; y: number; width: number; height: number }
export interface MediaSize { width: number; height: number }
export interface ImageAnnotation { text: string; x: number; y: number }

const videoOperations: ReadonlySet<CanvasMediaOperation> = new Set(["snapshot", "trim", "videoCrop", "videoResize", "frameStrip", "splitTracks"]);

export function isVideoOperation(operation: CanvasMediaOperation): operation is VideoOperation {
  return videoOperations.has(operation);
}

/** 以指定长边同比缩放，视频可选偶数尺寸以兼容编码器。 */
export function mediaOutputSize(width: number, height: number, longEdge: number, even = false): MediaSize {
  const unit = even ? 2 : 1;
  if (![width, height, longEdge].every((value) => Number.isFinite(value) && value > 0) || longEdge % unit !== 0) {
    throw new RangeError("无效的输出尺寸 / Invalid output dimensions");
  }
  const ratio = longEdge / Math.max(width, height);
  const scaled = (value: number) => Math.max(unit, Math.round(value * ratio / unit) * unit);
  return { width: scaled(width), height: scaled(height) };
}

/** 校验裁剪框在原图范围内，并转换成与预览无关的源像素坐标。 */
export function cropPixels(width: number, height: number, crop: CropPercent): CropPercent | null {
  const { x, y, width: w, height: h } = crop;
  if (![x, y, w, h].every(Number.isFinite) || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 100 || y + h > 100) return null;
  const left = Math.round(width * x / 100);
  const top = Math.round(height * y / 100);
  const right = Math.round(width * (x + w) / 100);
  const bottom = Math.round(height * (y + h) / 100);
  return right > left && bottom > top ? { x: left, y: top, width: right - left, height: bottom - top } : null;
}

/** 按原图像素分块，奇数尺寸的余数归入相邻切片，避免缝隙和重叠。 */
export function gridRegions(width: number, height: number, side: number): CropPercent[] {
  return Array.from({ length: side * side }, (_, index) => {
    const column = index % side;
    const row = Math.floor(index / side);
    const x = Math.floor(column * width / side);
    const y = Math.floor(row * height / side);
    return { x, y, width: Math.floor((column + 1) * width / side) - x, height: Math.floor((row + 1) * height / side) - y };
  });
}

function encodePng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("无法生成图片 / Image export failed"));
  }, "image/png"));
}

/** 将源画面渲染为 PNG，所有操作均从原始像素读取。 */
export async function renderMediaImage(source: CanvasImageSource, region: CropPercent, options: {
  degrees?: number; size?: MediaSize; annotation?: ImageAnnotation;
} = {}): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const { degrees = 0, size = region, annotation } = options;
  const swap = Math.abs(degrees % 180) === 90;
  canvas.width = swap ? size.height : size.width;
  canvas.height = swap ? size.width : size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.width || !canvas.height) throw new Error("无法生成图片 / Image export failed");
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(degrees * Math.PI / 180);
  ctx.drawImage(source, region.x, region.y, region.width, region.height, -size.width / 2, -size.height / 2, size.width, size.height);
  ctx.restore();
  if (annotation) {
    const x = canvas.width * annotation.x / 100;
    const y = canvas.height * annotation.y / 100;
    const font = Math.max(1, Math.round(canvas.height * 0.054));
    ctx.font = `600 ${font}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, font * 0.13);
    // 输出文件使用固定的黑描边白字，方便在明暗素材上辨认。
    ctx.strokeStyle = "black";
    ctx.fillStyle = "white";
    ctx.strokeText(annotation.text, x, y, canvas.width - x);
    ctx.fillText(annotation.text, x, y, canvas.width - x);
  }
  return encodePng(canvas);
}

/** 将选择的图片按顺序排入九宫格，缩放适配每格并保留原始比例。 */
export async function renderContactSheet(sources: readonly string[], signal: AbortSignal): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const cell = 512;
  canvas.width = canvas.height = cell * 3;
  const ctx = canvas.getContext("2d");
  if (!ctx || sources.length < 2 || sources.length > 9) throw new Error("请选择 2 至 9 张图片 / Select 2 to 9 images");
  ctx.imageSmoothingQuality = "high";
  for (const [index, src] of sources.entries()) {
    signal.throwIfAborted();
    const image = new Image();
    image.src = src;
    await image.decode();
    signal.throwIfAborted();
    const { width, height } = mediaOutputSize(image.naturalWidth, image.naturalHeight, cell - 12);
    const x = (index % 3) * cell + (cell - width) / 2;
    const y = Math.floor(index / 3) * cell + (cell - height) / 2;
    ctx.drawImage(image, x, y, width, height);
  }
  return encodePng(canvas);
}

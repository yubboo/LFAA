// 输入区图片附件的复制与另存为：把缩略图背后的原始字节写入剪贴板，或用同源 blob 地址触发浏览器下载。
// 只在浏览器端运行；失败以布尔值/异常交回调用方，由输入区提示文案说明结果。

/** 从附件名推导下载文件名：缺扩展名时按图片类型补全，避免保存出无后缀文件。 */
export function imageFileName(label: string, mime?: string): string {
  const base = (label.split(/[\\/]/u).at(-1) ?? label).trim() || "image";
  if (/\.[a-z0-9]{2,5}$/iu.test(base)) return base;
  const rawExt = mime?.split("/")[1]?.split("+")[0]?.toLowerCase();
  const ext = rawExt === "jpeg" ? "jpg" : rawExt || "png";
  return `${base}.${ext}`;
}

/** 剪贴板在 Chromium / Safari 只稳定接受 image/png：其它格式先画到画布再导出 PNG。 */
async function toPngBlob(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("canvas 2d context unavailable");
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!png) throw new Error("canvas toBlob failed");
  return png;
}

/** 复制图片到系统剪贴板；不支持或权限被拒时返回 false。 */
export async function copyImageBlob(blob: Blob): Promise<boolean> {
  try {
    if (typeof ClipboardItem === "undefined" || typeof navigator.clipboard?.write !== "function") return false;
    const png = await toPngBlob(blob);
    await navigator.clipboard.write([new ClipboardItem({ [png.type]: png })]);
    return true;
  } catch {
    return false;
  }
}

/** 触发浏览器下载（等价另存为）；blob: 地址与页面同源，download 属性可直接生效。 */
export function downloadImage(url: string, label: string, mime?: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = imageFileName(label, mime);
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
// 浏览器画布剪贴板读取，只接受画布现有的素材格式与纯文本。
export const canvasMediaTypes = ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"];

/** 优先保留剪贴板里的媒体，忽略 HTML 和其他不支持的形式。 */
export async function readCanvasClipboard(clipboard: Clipboard) {
  if (typeof clipboard.read !== "function") return clipboard.readText();
  const items = await clipboard.read();
  for (const item of items) {
    const mime = item.types.find((type) => canvasMediaTypes.includes(type));
    if (mime) return item.getType(mime);
  }
  const item = items.find((value) => value.types.includes("text/plain"));
  return item ? (await item.getType("text/plain")).text() : "";
}

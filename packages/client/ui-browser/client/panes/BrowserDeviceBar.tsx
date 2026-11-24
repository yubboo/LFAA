// 内置浏览器响应式设备工具栏：提供常见设备下拉预设、自定义宽高像素输入、横竖屏旋转与缩放比例展示。
import { IconDeviceMobileRotated, IconX } from "@tabler/icons-react";
import styles from "./BrowserDeviceBar.module.css";

export interface BrowserDevicePreset {
  id: string;
  labelZh: string;
  labelEn: string;
  width: number;
  height: number;
}

export const BROWSER_DEVICE_PRESETS: BrowserDevicePreset[] = [
  { id: "responsive", labelZh: "响应式", labelEn: "Responsive", width: 1196, height: 873 },
  { id: "4k", labelZh: "4K", labelEn: "4K", width: 2560, height: 1440 },
  { id: "laptop-l", labelZh: "Laptop L", labelEn: "Laptop L", width: 1440, height: 900 },
  { id: "laptop", labelZh: "笔记本电脑", labelEn: "Laptop", width: 1280, height: 800 },
  { id: "surface-pro-7", labelZh: "Surface Pro 7", labelEn: "Surface Pro 7", width: 912, height: 1368 },
  { id: "ipad-air", labelZh: "iPad Air", labelEn: "iPad Air", width: 820, height: 1180 },
  { id: "ipad-mini", labelZh: "iPad Mini", labelEn: "iPad Mini", width: 768, height: 1024 },
  { id: "surface-duo", labelZh: "Surface Duo", labelEn: "Surface Duo", width: 540, height: 720 },
  { id: "iphone-15-pro-max", labelZh: "iPhone 15 Pro Max", labelEn: "iPhone 15 Pro Max", width: 430, height: 932 },
  { id: "pixel-8", labelZh: "Pixel 8", labelEn: "Pixel 8", width: 412, height: 915 },
  { id: "iphone-15-pro", labelZh: "iPhone 15 Pro", labelEn: "iPhone 15 Pro", width: 393, height: 852 },
  { id: "galaxy-s24-ultra", labelZh: "Samsung Galaxy S24 Ultra", labelEn: "Samsung Galaxy S24 Ultra", width: 412, height: 915 },
  { id: "iphone-se", labelZh: "iPhone SE", labelEn: "iPhone SE", width: 375, height: 667 },
];

export function BrowserDeviceBar({
  isZh,
  deviceId,
  width,
  height,
  zoomPercent,
  onSelectDevice,
  onChangeSize,
  onRotate,
  onClose,
}: {
  isZh: boolean;
  deviceId: string;
  width: number;
  height: number;
  zoomPercent: number;
  onSelectDevice: (preset: BrowserDevicePreset) => void;
  onChangeSize: (width: number, height: number) => void;
  onRotate: () => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.bar} role="toolbar" aria-label={isZh ? "响应式设备工具栏" : "Responsive device toolbar"}>
      <div className={styles.group}>
        <span className={styles.label}>{isZh ? "尺寸:" : "Dimensions:"}</span>
        <select
          className={styles.select}
          aria-label={isZh ? "设备尺寸预设" : "Device preset"}
          value={deviceId}
          onChange={(e) => {
            const found = BROWSER_DEVICE_PRESETS.find((item) => item.id === e.target.value);
            if (found) onSelectDevice(found);
          }}
        >
          {BROWSER_DEVICE_PRESETS.map((item) => (
            <option key={item.id} value={item.id}>
              {isZh ? item.labelZh : item.labelEn}
            </option>
          ))}
        </select>

        <div className={styles.dims}>
          <input
            type="number"
            className={styles.dimInput}
            aria-label={isZh ? "视口宽度" : "Viewport width"}
            min={320}
            max={2560}
            value={width}
            onChange={(e) => {
              const nextW = Number(e.target.value);
              if (Number.isFinite(nextW) && nextW >= 320 && nextW <= 2560) {
                onChangeSize(Math.round(nextW), height);
              }
            }}
          />
          <span className={styles.times}>×</span>
          <input
            type="number"
            className={styles.dimInput}
            aria-label={isZh ? "视口高度" : "Viewport height"}
            min={240}
            max={2400}
            value={height}
            onChange={(e) => {
              const nextH = Number(e.target.value);
              if (Number.isFinite(nextH) && nextH >= 240 && nextH <= 2400) {
                onChangeSize(width, Math.round(nextH));
              }
            }}
          />
        </div>

        <button
          type="button"
          className={styles.iconBtn}
          title={isZh ? "旋转横竖屏" : "Rotate orientation"}
          aria-label={isZh ? "旋转横竖屏" : "Rotate orientation"}
          onClick={onRotate}
        >
          <IconDeviceMobileRotated size={14} />
        </button>
        <span className={styles.zoom}>{zoomPercent}%</span>
      </div>

      <button
        type="button"
        className={styles.iconBtn}
        title={isZh ? "关闭设备工具栏（恢复铺满显示）" : "Close device toolbar"}
        aria-label={isZh ? "关闭设备工具栏" : "Close device toolbar"}
        onClick={onClose}
      >
        <IconX size={14} />
      </button>
    </div>
  );
}

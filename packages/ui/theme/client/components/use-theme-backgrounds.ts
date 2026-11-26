// 个人背景主题的列表与动作：启动加载、上传、二次确认删除；删除正在使用的图时回退到纯色主题。
// 主题与背景合并后不再有独立的背景分组，这个 Hook 只为「主题」卡墙提供个人图数据。
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppearanceStore } from "../appearance-store";
import type { ThemeLocaleMessages } from "../locales";
import {
  deleteCustomBackground,
  listCustomBackgrounds,
  uploadCustomBackground,
  type CustomBackground,
} from "../background-api";

/** 个人图上传/删除的本地状态与动作；个人图统一使用默认配色（液态玻璃）。 */
export function useThemeBackgrounds(store: AppearanceStore, locale: ThemeLocaleMessages) {
  const [customs, setCustoms] = useState<CustomBackground[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 读取个人图片；已删除的个人图不再留死引用，整页回退到纯色主题。
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await listCustomBackgrounds();
        if (cancelled) return;
        setCustoms(list);
        const { backgrounds } = store.getSnapshot().config;
        const dead = (choice: { kind: string; id?: string }) =>
          choice.kind === "custom" && !list.some((item) => item.id === choice.id);
        if (dead(backgrounds.workspace) || dead(backgrounds.settings)) {
          store.applyThemeLook("liquidGlass", { kind: "default" });
        }
      } catch {
        if (!cancelled) setNotice(locale.backgroundLoadFailed);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale.backgroundLoadFailed, store]);

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setNotice("");
    try {
      const uploaded = await uploadCustomBackground(file);
      setCustoms(await listCustomBackgrounds());
      store.applyThemeLook("liquidGlass", { kind: "custom", id: uploaded.id });
      setNotice(locale.backgroundUploaded);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setNotice(
        code === "too-large"
          ? locale.backgroundTooLarge
          : code === "bad-format"
            ? locale.backgroundFormatError
            : locale.backgroundUploadFailed,
      );
    } finally {
      setBusy(false);
    }
  }, [locale, store]);

  /** 第一次点击进入确认态，第二次才真正删除；删除正在使用的图时回退到纯色主题。 */
  const requestDelete = useCallback((id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        await deleteCustomBackground(id);
        setCustoms(await listCustomBackgrounds());
        const { backgrounds } = store.getSnapshot().config;
        const inUse = [backgrounds.workspace, backgrounds.settings].some(
          (choice) => choice.kind === "custom" && choice.id === id,
        );
        if (inUse) store.applyThemeLook("liquidGlass", { kind: "default" });
        setNotice("");
      } catch {
        setNotice(locale.backgroundDeleteFailed);
      } finally {
        setBusy(false);
        setConfirmId(null);
      }
    })();
  }, [confirmId, locale, store]);

  return { customs, notice, busy, confirmId, fileInputRef, handleFile, requestDelete };
}
// 背景图片分组：位置下拉、内置图墙、个人图上传与删除；选择结果写回外观 store，由 store 输出 CSS 变量。
import { useEffect, useRef, useState } from "react";
import { readStoredJson, writeStoredJson } from "@lfaa/ui-layout/client";
import { SettingGroup, SettingRow, settingsStyles as baseStyles } from "@lfaa/ui-primitives/client";
import { BACKGROUND_TARGETS, type BackgroundChoice, type BackgroundTarget } from "../../contract/index";
import { BUILTIN_BACKGROUNDS } from "../assets/backgrounds/index";
import {
  customBackgroundUrl,
  deleteCustomBackground,
  listCustomBackgrounds,
  uploadCustomBackground,
  type CustomBackground,
} from "../background-api";
import type { AppearanceSnapshot, AppearanceStore } from "../appearance-store";
import type { ThemeLocaleMessages } from "../locales";
import { BackgroundGallery, type BackgroundTileItem } from "./BackgroundGallery";
import { ThemeSelect } from "./ThemeSelect";
import styles from "./BackgroundSettings.module.css";

const TARGET_STORAGE_KEY = "lfaa:appearance-bg-target";

/** 渲染背景图片设置：两个作用位置各自保存选择，个人图片可上传与删除。 */
export function BackgroundSettings({
  locale,
  store,
  snapshot,
}: {
  locale: ThemeLocaleMessages;
  store: AppearanceStore;
  snapshot: AppearanceSnapshot;
}) {
  const { config, activeVariant } = snapshot;
  const [target, setTarget] = useState<BackgroundTarget>(() =>
    readStoredJson<BackgroundTarget>(
      TARGET_STORAGE_KEY,
      "workspace",
      (value): value is BackgroundTarget => value === "workspace" || value === "settings",
    ),
  );
  const [customs, setCustoms] = useState<CustomBackground[]>([]);
  const [notice, setNotice] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isZh = locale.isZh;
  const choice = config.backgrounds[target];

  // 读取个人图片；已被删除的自定义选择回退纯色，避免留下死引用。
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await listCustomBackgrounds();
        if (cancelled) return;
        setCustoms(list);
        for (const name of BACKGROUND_TARGETS) {
          const current = store.getSnapshot().config.backgrounds[name];
          if (current.kind === "custom" && !list.some((item) => item.id === current.id)) {
            store.setBackground(name, { kind: "default" });
          }
        }
      } catch {
        if (!cancelled) setNotice(locale.backgroundLoadFailed);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale.backgroundLoadFailed, store]);

  const applyChoice = (next: BackgroundChoice) => {
    store.setBackground(target, next);
    setConfirmId(null);
  };

  const changeTarget = (next: BackgroundTarget) => {
    setTarget(next);
    setConfirmId(null);
    writeStoredJson(TARGET_STORAGE_KEY, next);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setNotice("");
    try {
      const uploaded = await uploadCustomBackground(file);
      setCustoms(await listCustomBackgrounds());
      store.setBackground(target, { kind: "custom", id: uploaded.id });
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
  };

  /** 第一次点击进入确认态，第二次才真正删除；删除正在使用的图时回退纯色。 */
  const handleDelete = (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        await deleteCustomBackground(id);
        setCustoms(await listCustomBackgrounds());
        for (const name of BACKGROUND_TARGETS) {
          const current = store.getSnapshot().config.backgrounds[name];
          if (current.kind === "custom" && current.id === id) {
            store.setBackground(name, { kind: "default" });
          }
        }
        setNotice("");
      } catch {
        setNotice(locale.backgroundDeleteFailed);
      } finally {
        setBusy(false);
        setConfirmId(null);
      }
    })();
  };

  const builtinTiles: BackgroundTileItem[] = [
    {
      id: "default",
      label: locale.backgroundDefault,
      solid: { background: activeVariant.background, foreground: activeVariant.foreground },
      active: choice.kind === "default",
    },
    ...BUILTIN_BACKGROUNDS.map((item) => ({
      id: item.id,
      label: isZh ? item.labelZh : item.labelEn,
      imageUrl: item.src,
      active: choice.kind === "builtin" && choice.id === item.id,
    })),
  ];

  const customTiles: BackgroundTileItem[] = customs.map((item) => ({
    id: item.id,
    label: item.name.replace(/\.[^.]+$/u, ""),
    imageUrl: customBackgroundUrl(item.id),
    active: choice.kind === "custom" && choice.id === item.id,
    deletable: true,
    confirmDelete: confirmId === item.id,
  }));

  return (
    <SettingGroup title={locale.backgroundTitle} description={locale.backgroundDesc}>
      <SettingRow
        title={locale.backgroundTarget}
        description={locale.backgroundTargetDesc}
        control={(
          <ThemeSelect
            label={locale.backgroundTarget}
            value={target}
            options={[
              { value: "workspace", label: locale.backgroundWorkspace },
              { value: "settings", label: locale.backgroundSettings },
            ]}
            onChange={changeTarget}
          />
        )}
      />

      <div className={styles.gallerySection}>
        <BackgroundGallery
          label={locale.backgroundBuiltin}
          items={builtinTiles}
          deleteLabel={locale.backgroundDelete}
          confirmLabel={locale.backgroundConfirmDelete}
          onSelect={(id) => {
            applyChoice(id === "default" ? { kind: "default" } : { kind: "builtin", id });
          }}
        />
      </div>

      {customTiles.length > 0 && (
        <div className={styles.gallerySection}>
          <h3 className={styles.sectionTitle}>{locale.backgroundMine}</h3>
          <BackgroundGallery
            label={locale.backgroundMine}
            items={customTiles}
            deleteLabel={locale.backgroundDelete}
            confirmLabel={locale.backgroundConfirmDelete}
            onSelect={(id) => applyChoice({ kind: "custom", id })}
            onDelete={handleDelete}
          />
        </div>
      )}

      <SettingRow
        title={locale.backgroundUpload}
        description={locale.backgroundUploadHint}
        control={(
          <button
            type="button"
            className={baseStyles.actionBtn}
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {busy ? locale.backgroundUploading : locale.backgroundUpload}
          </button>
        )}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {notice && <p className={baseStyles.notice} role="status">{notice}</p>}
    </SettingGroup>
  );
}
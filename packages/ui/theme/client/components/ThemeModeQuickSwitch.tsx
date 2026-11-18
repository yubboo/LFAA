// 用户账户菜单头部右侧的外观模式快捷切换胶囊与“跟随系统 / 浅色模式 / 深色模式”三选一浮层菜单。
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconChevronDown, IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import type { AppearanceMode } from "../../src/index";
import type { AppearanceStore } from "../appearance-store";
import type { ThemeLocaleMessages } from "../locales";
import styles from "./ThemeModeQuickSwitch.module.css";

interface PopoverCoords {
  left: number;
  top: number;
}

function getModeLabel(mode: AppearanceMode, locale: ThemeLocaleMessages): string {
  if (mode === "light") return locale.lightModeLabel;
  if (mode === "dark") return locale.darkModeLabel;
  return locale.system;
}

function ModeIcon({ mode, className }: { mode: AppearanceMode; className?: string | undefined }) {
  if (mode === "light") return <IconSun className={className} aria-hidden="true" />;
  if (mode === "dark") return <IconMoon className={className} aria-hidden="true" />;
  return <IconDeviceDesktop className={className} aria-hidden="true" />;
}

export function ThemeModeQuickSwitch({
  locale,
  store,
  mode,
}: {
  locale: ThemeLocaleMessages;
  store: AppearanceStore;
  mode: AppearanceMode;
}) {
  const [coords, setCoords] = useState<PopoverCoords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOpen = coords !== null;
  const activeLabel = getModeLabel(mode, locale);

  const computeCoords = useCallback((): PopoverCoords | null => {
    const button = triggerRef.current;
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    const panelRect = button.closest("#lfaa-user-menu")?.getBoundingClientRect() ?? rect;
    const measured = menuRef.current?.getBoundingClientRect();
    const menuWidth = measured?.width && measured.width > 0 ? measured.width : 172;
    const menuHeight = measured?.height && measured.height > 0 ? measured.height : 132;
    const fitsRight = panelRect.right + 8 + menuWidth <= window.innerWidth - 12;
    const left = fitsRight
      ? panelRect.right + 8
      : Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
    const minTop = Math.max(12, panelRect.top);
    const maxTop = Math.max(minTop, window.innerHeight - menuHeight - 12);
    const top = fitsRight
      ? Math.max(minTop, Math.min(panelRect.top, maxTop))
      : Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - menuHeight - 12));
    return { left, top };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setCoords(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setCoords(null);
        triggerRef.current?.focus();
      }
    };
    const syncPosition = () => {
      const next = computeCoords();
      if (next) setCoords(next);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
    };
  }, [computeCoords, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const next = computeCoords();
    if (next && (next.left !== coords.left || next.top !== coords.top)) {
      setCoords(next);
    }
  }, [computeCoords, coords, isOpen]);

  const toggleMenu = () => {
    if (isOpen) {
      setCoords(null);
      return;
    }
    setCoords(computeCoords());
  };

  const options: Array<{ mode: AppearanceMode; label: string }> = [
    { mode: "system", label: locale.system },
    { mode: "light", label: locale.lightModeLabel },
    { mode: "dark", label: locale.darkModeLabel },
  ];

  const menuNode = coords && (
    <div
      ref={menuRef}
      role="menu"
      aria-label={locale.quickThemeSwitch}
      data-theme-quick-menu="true"
      className={styles.menu}
      style={{ left: coords.left, top: coords.top }}
    >
      {options.map((item) => {
        const selected = mode === item.mode;
        return (
          <button
            key={item.mode}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            className={`${styles.option} ${selected ? styles.optionActive : ""}`}
            onClick={() => {
              store.setMode(item.mode);
              setCoords(null);
            }}
          >
            <ModeIcon mode={item.mode} className={styles.optionIcon} />
            <span className={styles.optionText}>{item.label}</span>
            {selected && <IconCheck className={styles.checkIcon} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerActive : ""}`}
        aria-label={`${locale.quickThemeSwitch}（${activeLabel}）`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={activeLabel}
        onClick={toggleMenu}
      >
        <ModeIcon mode={mode} className={styles.triggerIcon} />
        <span className={styles.triggerLabel}>{activeLabel}</span>
        <IconChevronDown className={styles.triggerChevron} aria-hidden="true" />
      </button>

      {menuNode && typeof document !== "undefined"
        ? createPortal(menuNode, document.querySelector("[data-device]") ?? document.body)
        : menuNode}
    </>
  );
}

/** Workbench 根主题 Token 容器。 */
import type { PropsWithChildren } from "react";
import type { ThemePreference } from "@lfaa/ui";
import type { LayoutMode,ResolvedTheme } from "#workbench/contracts";
import styles from "../styles/WorkbenchTheme.module.css";
export function WorkbenchRoot({resolvedTheme,themePreference,layoutMode,children}:PropsWithChildren<{resolvedTheme:ResolvedTheme;themePreference:ThemePreference;layoutMode:LayoutMode}>){return <div className={styles.theme} data-theme={resolvedTheme} data-theme-preference={themePreference} data-layout-mode={layoutMode}>{children}</div>;}

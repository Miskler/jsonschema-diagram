export const THEME_STORAGE_KEY = "jsonschema-diagram-theme";

export const THEME_PRESETS = [
  {
    id: "slate",
    label: "Slate",
  },
  {
    id: "mono",
    label: "Mono",
  },
  {
    id: "cobalt",
    label: "Cobalt",
  },
  {
    id: "mint",
    label: "Mint",
  },
  {
    id: "coral",
    label: "Coral",
  },
  {
    id: "gold",
    label: "Gold",
  },
] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number];
export type ThemePresetId = ThemePreset["id"];

export const DEFAULT_THEME_ID: ThemePresetId = "slate";

export function isThemePresetId(value: string): value is ThemePresetId {
  return THEME_PRESETS.some((preset) => preset.id === value);
}

export function readStoredTheme(): ThemePresetId {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_ID;
  }

  const rawValue = window.localStorage.getItem(THEME_STORAGE_KEY);
  return rawValue && isThemePresetId(rawValue) ? rawValue : DEFAULT_THEME_ID;
}

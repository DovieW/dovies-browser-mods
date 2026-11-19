export const sections = ["Tabs", "Clipboard", "Media"] as const;
export type Section = (typeof sections)[number];
export const preferenceDefaults = {
  layout: "favorites" as const,
  placement: "toolbar" as const,
  searchMode: "scoped" as const,
  includeDisabled: false,
  pins: ["copy-url", "copy-screenshot", "switch-to-last-tab", "pause-all-tabs"],
  hidden: [] as string[],
  order: [] as string[],
  sections: [...sections] as string[],
  disabled: [] as string[],
};
export type Preferences = Omit<
  typeof preferenceDefaults,
  "layout" | "placement" | "searchMode"
> & {
  layout: "favorites" | "commands" | "sections";
  placement: "toolbar" | "centered";
  searchMode: "scoped" | "everything" | "commands";
};
export function parsePreferences(value: unknown): Preferences {
  const p: Preferences = { ...preferenceDefaults };
  if (!value || typeof value !== "object" || Array.isArray(value)) return p;
  for (const key of ["layout", "placement", "searchMode"] as const) {
    const choices = {
      layout: ["favorites", "commands", "sections"],
      placement: ["toolbar", "centered"],
      searchMode: ["scoped", "everything", "commands"],
    }[key];
    if (key in value) {
      const v: unknown = Reflect.get(value, key);
      if (typeof v === "string" && choices.includes(v))
        Object.assign(p, { [key]: v });
    }
  }
  if ("includeDisabled" in value && typeof value.includeDisabled === "boolean")
    p.includeDisabled = value.includeDisabled;
  for (const key of [
    "pins",
    "hidden",
    "order",
    "sections",
    "disabled",
  ] as const) {
    if (key in value) {
      const v: unknown = Reflect.get(value, key);
      if (
        Array.isArray(v) &&
        v.length <= 200 &&
        v.every((x: unknown) => typeof x === "string" && x.length <= 100)
      )
        p[key] = [...new Set(v as string[])];
    }
  }
  return p;
}
export function actionSection(id: string): Section {
  return id.startsWith("copy-")
    ? "Clipboard"
    : id === "pause-all-tabs"
      ? "Media"
      : "Tabs";
}
export function validatePreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const normalized = parsePreferences(value);
  return (
    Object.keys(normalized).every(
      (k) =>
        Object.hasOwn(value, k) &&
        JSON.stringify(Reflect.get(value, k)) ===
          JSON.stringify(Reflect.get(normalized, k)),
    ) && Object.keys(value).every((k) => Object.hasOwn(normalized, k))
  );
}

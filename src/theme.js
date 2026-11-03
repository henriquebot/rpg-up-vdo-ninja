import { CAMERA_THEMES } from "./config.js";

// Strict hex palette only. Foundry user colors must never escape a CSS value.
export function foundryUserColor(user) {
  const raw = String(user?.color?.css ?? user?.color ?? "").trim();
  if (/^#[\da-fA-F]{6}$/.test(raw)) return raw;
  if (/^#[\da-fA-F]{3}$/.test(raw)) return "#" + [...raw.slice(1)].map(c => c + c).join("");
  return "#a5a5b2";
}

// One palette shared by the actual VDO CSS and the Foundry preview.
// Effects intentionally stay short: large CSS URLs previously caused nginx 414.
export const THEME_STYLES = Object.freeze({
  scifi:   { radius: 4, width: 2, background: "#0a1524", label: "#101e30", glow: "0 0 13px var(--c),0 0 24px #1b9fff80,inset 0 0 6px #81d7ff" },
  modern:  { radius: 10, width: 2, background: "#1c2029", label: "#191b21", glow: "none" },
  neon:    { radius: 9, width: 3, background: "#151224", label: "#161425", glow: "0 0 8px var(--c),0 0 22px var(--c)" },
  rustic:  { radius: 4, width: 3, background: "#2b211c", label: "#34261e", glow: "inset 0 0 0 2px #8b613d,0 2px 8px #0e0908" },
  fantasy: { radius: 9, width: 3, background: "#1c1727", label: "#30241c", glow: "inset 0 0 0 1px #ddae65,0 0 10px #c89a5280" }
});

export function themeVisual(theme, color) {
  if (!Object.hasOwn(CAMERA_THEMES, theme)) throw new Error("Tema visual inválido.");
  const s = THEME_STYLES[theme];
  if (!s) return { border: "none", radius: "7px", shadow: "none", background: "#1c2029", label: "#191b21", color };
  return {
    border: `${s.width}px solid ${color}`,
    radius: `${s.radius}px`,
    shadow: s.glow.replaceAll("var(--c)", color),
    background: s.background,
    label: s.label,
    color
  };
}

export function themeCSS(world, users = []) {
  const theme = world?.theme ?? "modern";
  if (!Object.hasOwn(CAMERA_THEMES, theme)) throw new Error("Tema visual inválido.");
  if (theme === "none") return "";
  const s = THEME_STYLES[theme];
  // External CSS owns the rules; only theme variables and user colors go into the URL.
  const css = [
    `.tile{--rpgup-outline:${s.width}px solid var(--c);--rpgup-offset:-${s.width}px;--rpgup-radius:${s.radius}px;--rpgup-shadow:${s.glow};--rpgup-bg:${s.background};--rpgup-label:${s.label};--rpgup-label-radius:4px}`
  ];
  for (const user of users) {
    const id = world?.slots?.[user.id];
    if (typeof id !== "string" || !/^[A-Za-z0-9_]{1,64}$/.test(id)) continue;
    css.push(`video.tile[data-streamid="${id}"],video.tile[data-stream-id="${id}"],video.tile[id="${id}"]{--c:${foundryUserColor(user)}}`);
  }
  // The official &meterstyle=2 handles speaker indication when VDO has audio.
  // CSS does not attempt to infer speech on Discord or override VDO's meter.
  return css.join("");
}

export function encodeThemeCSS(css) {
  if (!css) return "";
  return btoa(encodeURIComponent(css));
}


// Public, cache-busted CSS files. No credentials or user data are sent to CDN.
const STYLE_BASE = "https://cdn.jsdelivr.net/gh/henriquebot/rpg-up-vdo-ninja@main/styles/";
export function styleSheetURL(theme, presentation, { director = false } = {}) {
  if (!Object.hasOwn(CAMERA_THEMES, theme)) throw new Error("Tema visual inválido.");
  const mode = director ? "native" : presentation;
  if (!["native", "minimal", "adaptive"].includes(mode)) throw new Error("Apresentação da dock inválida.");
  if (theme === "none" && mode === "native") return "";
  return STYLE_BASE + "vdo-style-" + mode + ".css?v=1.0.25";
}

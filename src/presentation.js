/**
 * Presentation options run inside VDO.Ninja using its documented base64css.
 * The Original mode is always an exact no-op for rollback and compatibility.
 */
export const DOCK_PRESENTATIONS = Object.freeze({
  native: "Original · sem alterações",
  minimal: "Cabeçalho mínimo · experimental",
  adaptive: "Ajustar câmeras à janela · experimental"
});

// Hide only branding and the long room title. Preserve the native status
// indicators and every native audio/video control.
const HEADER_CSS = [
  "#header{box-sizing:border-box!important;min-height:24px!important;padding:2px 5px!important;overflow:hidden!important;white-space:nowrap!important}",
  "#header #logoname,#header #head2,#header #head3,#header #head3a,#header #head9{display:none!important}",
  "#header #head5{float:none!important;display:block!important;width:100%!important;margin:0!important;font-size:11px!important;text-align:center!important;overflow:hidden!important;text-overflow:ellipsis!important}"
].join("");

// Upstream renders camera tiles as direct children of #gridlayout (some
// versions use <video>, others wrap them). The old .vidcon-only selectors
// failed because they did not target the actual room children. Never touch
// the peer connections, player labels or the bottom control bar.
const GRID_CSS = [
  "#gridlayout{--rg-cols:1;--rg-rows:1;display:grid!important;grid-template-columns:repeat(var(--rg-cols),minmax(0,1fr))!important;grid-template-rows:none!important;grid-auto-rows:minmax(0,min(calc((100dvh - 92px - (var(--rg-rows) - 1)*6px)/var(--rg-rows)),calc((100vw - 12px)/var(--rg-cols)*.5625)))!important;gap:6px!important;align-content:start!important;justify-content:stretch!important;overflow:hidden!important}",
  "#gridlayout>*{box-sizing:border-box!important;grid-area:auto!important;min-width:0!important;min-height:0!important;width:100%!important;height:100%!important;max-width:100%!important;margin:0!important;overflow:hidden!important}",
  "#gridlayout .tile{width:100%!important;height:100%!important;object-fit:contain!important}"
].join("");

// Rules are evaluated in the VDO iframe's own viewport, not the GM's screen.
// Thresholds recalculate automatically when peers join or leave; no polling.
const counts = Array.from({ length: 12 }, (_, index) => {
  const count = index + 2;
  return `#gridlayout:has(>:nth-child(${count})){--rg-rows:${count}}`;
}).join("");
const wide = Array.from({ length: 12 }, (_, index) => {
  const count = index + 3;
  return `#gridlayout:has(>:nth-child(${count})){--rg-rows:${Math.ceil(count / 2)}}`;
}).join("");
// On wide docks, two columns help retain a usable camera size. On narrow
// docks, use two columns only when the viewport is too short or has 7+ feeds.
const GRID_RESPONSIVE = [
  counts,
  "@media(min-width:450px){#gridlayout:has(>:nth-child(3)){--rg-cols:2}" + wide + "}",
  "@media(max-width:449px){#gridlayout:has(>:nth-child(7)){--rg-cols:2}" +
    Array.from({ length: 8 }, (_, index) => {
      const count = index + 7;
      return `#gridlayout:has(>:nth-child(${count})){--rg-rows:${Math.ceil(count / 2)}}`;
    }).join("") + "}",
  "@media(max-height:580px){#gridlayout:has(>:nth-child(4)){--rg-cols:2}" +
    Array.from({ length: 11 }, (_, index) => {
      const count = index + 4;
      return `#gridlayout:has(>:nth-child(${count})){--rg-rows:${Math.ceil(count / 2)}}`;
    }).join("") + "}"
].join("");

export function presentationCSS(mode, { director = false } = {}) {
  if (!Object.hasOwn(DOCK_PRESENTATIONS, mode)) throw new Error("Apresentação da dock inválida.");
  if (mode === "native" || director) return "";
  return mode === "minimal" ? HEADER_CSS : HEADER_CSS + GRID_CSS + GRID_RESPONSIVE;
}

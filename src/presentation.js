/**
 * Optional per-user presentation CSS for VDO.Ninja's official base64css API.
 * Native mode stays exactly unchanged for a safe rollback.
 */
export const DOCK_PRESENTATIONS = Object.freeze({
  native: "Original · sem alterações",
  minimal: "Cabeçalho mínimo · experimental",
  adaptive: "Ajustar câmeras à janela · experimental"
});

const HEADER_CSS = [
  "#header{box-sizing:border-box!important;min-height:24px!important;padding:2px 5px!important;overflow:hidden!important;white-space:nowrap!important}",
  "#header #logoname,#header #head2,#header #head3,#header #head3a,#header #head9{display:none!important}",
  "#header #head5{float:none!important;display:block!important;width:100%!important;margin:0!important;font-size:11px!important;text-align:center!important;overflow:hidden!important;text-overflow:ellipsis!important}"
].join("");

// VDO renders room feeds under #gridlayout, often as direct video tiles.
// Avoid relying on the old .vidcon class (no longer used for every feed).
// A narrow dock remains one column, wider layouts naturally use more columns.
// Row height fits both the local iframe viewport and the feed aspect ratio.
const GRID_CSS = [
  "#gridlayout{--rg-count:1;display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))!important;grid-template-rows:none!important;grid-auto-rows:minmax(0,min(calc((100dvh - 88px - (var(--rg-count) - 1)*6px)/var(--rg-count)),calc((100vw - 12px)*.5625)))!important;align-content:start!important;gap:6px!important;overflow:hidden!important}",
  "#gridlayout>*{box-sizing:border-box!important;grid-area:auto!important;min-width:0!important;min-height:0!important;width:100%!important;height:100%!important;max-width:100%!important;margin:0!important;overflow:hidden!important}",
  "#gridlayout .tile{width:100%!important;height:100%!important;object-fit:contain!important}"
].join("");

// The count is derived from VDO's rendered children, not Foundry user records.
// This responds immediately to peers joining/leaving and accounts for personal
// browser zoom without an observer or extra DOM access across the iframe.
const GRID_COUNT_CSS = Array.from({ length: 15 }, (_, i) => {
  const count = i + 2;
  return `#gridlayout:has(>:nth-child(${count})){--rg-count:${count}}`;
}).join("");

export function presentationCSS(mode, { director = false } = {}) {
  if (!Object.hasOwn(DOCK_PRESENTATIONS, mode)) throw new Error("Apresentação da dock inválida.");
  if (mode === "native" || director) return "";
  return mode === "minimal" ? HEADER_CSS : HEADER_CSS + GRID_CSS + GRID_COUNT_CSS;
}

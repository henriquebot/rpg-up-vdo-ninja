/**
 * Optional, per-user display experiments. The default returns no CSS:
 * existing rooms, calls, exports and OBS links remain untouched.
 *
 * This CSS runs inside VDO.Ninja via its documented base64css parameter.
 * Never reach across the iframe's origin or duplicate its media controls.
 */
export const DOCK_PRESENTATIONS = Object.freeze({
  native: "Original · sem alterações",
  minimal: "Cabeçalho mínimo · experimental",
  adaptive: "Ajustar câmeras à janela · experimental"
});

const HEADER_CSS = [
  // Keep native VDO status (#head5) and controls. Remove branding and
  // the long room title from the narrow embedded header.
  "#header{box-sizing:border-box!important;min-height:26px!important;padding:4px 6px!important;overflow:hidden!important;white-space:nowrap!important}",
  "#header #logoname,#header #head2,#header #head3,#header #head3a,#header #head9{display:none!important}",
  "#header #head5{float:right!important;max-width:100%!important;margin:0!important;font-size:11px!important;text-overflow:ellipsis!important;overflow:hidden!important}"
].join("");

// The VDO renderer owns #gridlayout and its video containers. In the beta,
// CSS only overrides the grid geometry, preserving native video elements,
// labels, control bar and media signalling. Viewport units are LOCAL to the
// iframe, so browser zoom, VDO zoom and each person's monitor are respected.
const GRID_BASE = [
  "#gridlayout{--rpgup-cols:1;--rpgup-rows:1;display:grid!important;grid-template-columns:repeat(var(--rpgup-cols),minmax(0,1fr))!important;grid-template-rows:repeat(var(--rpgup-rows),minmax(0,min(calc((100dvh - 100px - (var(--rpgup-rows) - 1)*6px)/var(--rpgup-rows)),calc((100vw / var(--rpgup-cols) - 12px)*.5625))))!important;grid-auto-flow:row!important;align-content:start!important;gap:6px!important;overflow:hidden!important}",
  "#gridlayout>.vidcon{box-sizing:border-box!important;min-width:0!important;min-height:0!important;width:100%!important;height:100%!important;max-width:100%!important;margin:0!important;overflow:hidden!important}",
  "#gridlayout>.vidcon .tile{width:100%!important;height:100%!important;object-fit:contain!important}"
].join("");

// Count real grid children, rather than Foundry users: some Foundry users are
// offline, and an external VDO guest may not correspond to a Foundry account.
// A child-based rule adjusts instantly as the VDO renderer joins/leaves feeds.
// Compact 2-column grid is only used with 5+ videos in narrow portrait docks;
// wider docks use 2 columns from 3+ videos.
const GRID_COUNTS = Array.from({ length: 12 }, (_, i) => {
  const count = i + 1;
  const selector = count === 1
    ? "#gridlayout:not(:has(>.vidcon:nth-child(2)))"
    : `#gridlayout:has(>.vidcon:nth-child(${count})):not(:has(>.vidcon:nth-child(${count + 1})))`;
  const colsNarrow = count >= 5 ? 2 : 1;
  const colsWide = count >= 3 ? 2 : 1;
  return [
    `@media(max-width:499px){${selector}{--rpgup-cols:${colsNarrow};--rpgup-rows:${Math.ceil(count / colsNarrow)}}}`,
    `@media(min-width:500px){${selector}{--rpgup-cols:${colsWide};--rpgup-rows:${Math.ceil(count / colsWide)}}}`
  ].join("");
}).join("");

// A busy room with 13+ feeds falls back to two columns, using fractional rows
// rather than clipping the entire last row; ultra-large groups need live review.
const GRID_OVERFLOW = [
  "@media(max-width:499px){#gridlayout:has(>.vidcon:nth-child(13)){--rpgup-cols:2;--rpgup-rows:7}}",
  "@media(min-width:500px){#gridlayout:has(>.vidcon:nth-child(13)){--rpgup-cols:2;--rpgup-rows:7}}"
].join("");

export function presentationCSS(mode, { director = false } = {}) {
  if (!Object.hasOwn(DOCK_PRESENTATIONS, mode)) throw new Error("Apresentação da dock inválida.");
  if (mode === "native") return "";
  // Never override the Director interface: its controls are not a camera grid.
  if (director) return "";
  return mode === "minimal" ? HEADER_CSS : HEADER_CSS + GRID_BASE + GRID_COUNTS + GRID_OVERFLOW;
}

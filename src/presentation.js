/**
 * Optional per-user presentation CSS for VDO.Ninja's official base64css API.
 * Native mode stays exactly unchanged for a safe rollback.
 */
export const DOCK_PRESENTATIONS = Object.freeze({
  native: "Original · sem alterações",
  minimal: "Cabeçalho mínimo · experimental",
  adaptive: "Ajustar câmeras à janela · experimental"
});

// Keep only the informative status row; do not hide any call controls.
const HEADER_CSS =
  "#logoname,#head2,#head3,#head3a,#head9{display:none!important}" +
  "#header{min-height:24px!important;padding:2px 5px!important;overflow:hidden!important}" +
  "#head5{float:none!important;display:block!important;font-size:11px!important;white-space:nowrap!important}";

// Real VDO camera containers are absolute and receive inline positioning.
// Only those camera containers are affected; native video/label controls remain.
const GRID_CSS =
  "#gridlayout{--n:1;display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))!important;" +
  "grid-template-rows:none!important;grid-auto-rows:minmax(0,min(calc((100dvh - 88px)/var(--n)),calc(100vw*.5625)))!important;align-content:start!important;gap:6px!important;overflow:hidden!important}" +
  "#gridlayout>.container_holder_video{position:relative!important;top:auto!important;left:auto!important;" +
  "right:auto!important;bottom:auto!important;transform:none!important;grid-area:auto!important;" +
  "width:100%!important;height:100%!important;max-width:100%!important;margin:0!important;overflow:hidden!important}" +
  "#gridlayout>.container_holder_video>.holder{top:0!important;left:0!important;width:100%!important;height:100%!important}" +
  "#gridlayout>.container_holder_video .tile{width:100%!important;height:100%!important;object-fit:contain!important}";

// Inline CSS must remain short enough to coexist with users' border theme and
// the camera-off avatar. Selector counts update as peers join or leave.
const GRID_COUNT_CSS = Array.from({ length: 15 }, (_, i) => {
  const n = i + 2;
  return `#gridlayout:has(>:nth-child(${n})){--n:${n}}`;
}).join("");

export function presentationCSS(mode, { director = false } = {}) {
  if (!Object.hasOwn(DOCK_PRESENTATIONS, mode)) throw new Error("Apresentação da dock inválida.");
  if (mode === "native" || director) return "";
  return mode === "minimal" ? HEADER_CSS : HEADER_CSS + GRID_CSS + GRID_COUNT_CSS;
}

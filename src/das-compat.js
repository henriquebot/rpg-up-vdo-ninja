/**
 * DAS · Combat UI (darsh-dnd-ui) draws its Party HUD as a fixed child of
 * #interface. It recalculates its left edge on its own resize/render events;
 * hiding VDO changes available width without triggering those events.
 *
 * Reposition through DAS's public api.party.place() and offset only a real
 * overlap. Do not modify any DAS settings, classes, or inline left/right.
 */
const originalTranslate = new WeakMap();

function restoreTranslation(party) {
  if (!originalTranslate.has(party)) return;
  party.style.translate = originalTranslate.get(party);
  originalTranslate.delete(party);
}

export function syncDASParty(dock, { collapsed = false, side = "left" } = {}) {
  const das = game.modules.get("darsh-dnd-ui");
  const controller = das?.active ? das.api?.party : null;
  const party = controller?.element;
  if (!party?.isConnected) return;
  restoreTranslation(party);
  controller.place?.();
  if (collapsed || !dock?.isConnected || !["left", "right"].includes(side) ||
      party.hidden || party.getClientRects().length === 0) return;

  const a = dock.getBoundingClientRect();
  const b = party.getBoundingClientRect();
  if (!(a.top < b.bottom && a.bottom > b.top && a.left < b.right && a.right > b.left)) return;
  const gap = 8;
  const shift = side === "left" ? a.right - b.left + gap : a.left - b.right - gap;
  const available = side === "left"
    ? Math.max(0, innerWidth - b.right - gap)
    : Math.max(0, b.left - gap);
  const delta = Math.sign(shift) * Math.min(Math.abs(shift), available);
  if (Math.abs(delta) < 1) return;
  originalTranslate.set(party, party.style.translate);
  // Individual CSS translate does not override DAS's transform:translateY(-50%).
  party.style.translate = `${Math.round(delta)}px 0px`;
}

export function clearDASParty() {
  const controller = game.modules.get("darsh-dnd-ui")?.api?.party;
  const party = controller?.element;
  if (!party?.isConnected) return;
  restoreTranslation(party);
  controller.place?.();
}

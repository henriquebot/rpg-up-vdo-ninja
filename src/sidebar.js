import { MODULE_ID } from "./config.js";
import { worldConfig } from "./settings.js";
import { roomInviteURL } from "./urls.js";
import { element, button, tooltip, report } from "./dom.js";
import { WorldConfig } from "./world-config.js";

const TAB = "rpgup-vdo-hud";
let mounted = null;

function findSidebar() {
  const root = ui.sidebar?.element ?? document.querySelector("#sidebar");
  if (!root) return null;
  const nav = root.querySelector("#sidebar-tabs, nav.sidebar-tabs, nav[aria-label*='Sidebar'], nav.tabs");
  const content = root.querySelector("#sidebar-content, .sidebar-content, .sidebar-panels, .sidebar-content-container, [data-sidebar-content]");
  return nav && content ? { root, nav, content } : null;
}

async function copyInvite(input) {
  if (!input.value) return;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard indisponível");
    await navigator.clipboard.writeText(input.value);
    ui.notifications.info("Link da sala copiado.");
  } catch {
    input.focus();
    input.select();
    ui.notifications.warn("Selecione o link e use Ctrl+C (ou Cmd+C).");
  }
}

function renderInvite(state) {
  const { input, copy, status } = state;
  try {
    const config = worldConfig();
    input.value = roomInviteURL(config, Array.from(game.users));
    copy.disabled = false;
    status.textContent = "Convite geral do VDO. Para manter os nomes e os links OBS individuais, jogadores do Foundry devem entrar pela dock; links pessoais ficam em Participantes.";
  } catch {
    input.value = "";
    input.placeholder = "O mestre precisa salvar a sala primeiro";
    copy.disabled = true;
    status.textContent = "Configure a sala e salve antes de compartilhar o convite.";
  }
}

async function mountForm(state) {
  const config = new WorldConfig();
  // A settings-menu fallback may already be open; avoid stealing its live form.
  if (config.rendered) await config.close();
  config._sidebarHost = state.formHost;
  const form = await config._renderHTML();
  if (state.formHost.isConnected) state.formHost.replaceChildren(form);
}

function install() {
  const found = findSidebar();
  if (!found) return null;
  const { root, nav, content } = found;
  if (mounted?.root === root && mounted.panel.isConnected && mounted.trigger.isConnected) return mounted;

  // V13/V14 split the sidebar navigation into internal groups. Adding a
  // tab directly to #sidebar-tabs creates a *new column* outside the icon
  // rail. Keep it as a sibling of an existing tab in the same native group.
  const nativeTab = nav.querySelector('[data-tab="settings"]') ?? nav.querySelector("[data-tab]");
  if (!nativeTab?.parentElement) return null;
  // Crucial: NEVER insert a fake [data-tab] into Foundry's native tabs.
  // Sidebar._onClickTab can run on an ancestor in capture phase before a
  // module listener has a chance to stop the event. It may record our unknown
  // tab internally, causing the next native click to fail until switching tabs.
  // Keep only the native button's visual classes/style, not its controller data.
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = nativeTab.className;
  trigger.classList.remove("active", "selected");
  trigger.classList.add("rpgup-hud-tab");
  trigger.style.cssText = nativeTab.style.cssText;
  trigger.setAttribute("aria-label", "HUD de câmeras");
  trigger.setAttribute("aria-pressed", "false");
  trigger.replaceChildren(element("i", undefined, { class: "fa-solid fa-headset", "aria-hidden": "true" }));
  tooltip(trigger, "HUD de câmeras · RPGUP VDO.Ninja");
  nativeTab.before(trigger);

  const panel = element("section", undefined, {
    class: "rpgup-vdo rpgup-sidebar-pane", role: "tabpanel",
    "aria-label": "HUD de câmeras", hidden: ""
  });
  // Deliberately NOT a native Foundry [data-tab] panel.
  panel.dataset.rpgupPanel = TAB;
  const header = element("header", undefined, { class: "rpgup-hud-header" });
  const heading = element("div", undefined, { class: "rpgup-hud-heading" });
  heading.append(
    element("span", "RPGUP · VDO.NINJA", { class: "rpgup-hud-eyebrow" }),
    element("h2", "HUD de câmeras")
  );
  const badge = element("span", game.user.isGM ? "MESTRE" : "JOGADOR", { class: "rpgup-hud-role" });
  header.append(heading, badge);

  const invite = element("section", undefined, { class: "rpgup-invite" });
  const inviteTitle = element("div", undefined, { class: "rpgup-invite-title" });
  inviteTitle.append(element("i", undefined, { class: "fas fa-link", "aria-hidden": "true" }),
    element("strong", "Convidar para a sala"));
  const inviteInfo = element("span", undefined, { class: "rpgup-info-icon", tabindex: "0", role: "img", "aria-label": "Sobre o convite" });
  inviteInfo.append(element("i", undefined, { class: "fas fa-circle-info", "aria-hidden": "true" }));
  tooltip(inviteInfo, "É um link geral do VDO.Ninja, sem Stream ID pessoal. Não use um mesmo link individual para vários jogadores. Quem usa o Foundry deve preferir a dock integrada.");
  inviteTitle.append(inviteInfo);
  const copyRow = element("div", undefined, { class: "rpgup-copy-link rpgup-invite-copy" });
  const input = element("input", undefined, { type: "text", readonly: "", "aria-label": "Link geral da sala" });
  const copy = button("Copiar", "fa-copy", { "aria-label": "Copiar convite da sala", class: "rpgup-primary" });
  copy.addEventListener("click", () => void copyInvite(input));
  input.addEventListener("click", () => input.select());
  copyRow.append(input, copy);
  const status = element("p", "", { class: "rpgup-invite-note" });
  invite.append(inviteTitle, copyRow, status);

  const actions = element("div", undefined, { class: "rpgup-hud-actions" });
  const toggle = button("Abrir câmeras", "fa-video");
  const refreshToggle = () => {
    const dock = game.modules.get(MODULE_ID)?.api?.dock?.();
    const isOpen = Boolean(dock?.rendered && dock.element?.isConnected);
    toggle.querySelector("span").textContent = isOpen ? "Fechar câmeras" : "Abrir câmeras";
    toggle.setAttribute("aria-pressed", String(isOpen));
  };
  toggle.addEventListener("click", async () => {
    try {
      await game.modules.get(MODULE_ID)?.api?.toggleDock?.();
      refreshToggle();
    } catch (error) { report(error); }
  });
  // Persistent action: every tab can change room/camera settings which may
  // require reconnecting. Do not make users hunt for the Connection tab.
  // Reuse the personal tab's handler because it awaits queued preference writes
  // and saves the GM's pending room draft before rejoining VDO.
  const apply = tooltip(button("Aplicar / reconectar", "fa-check", {
    class: "rpgup-primary rpgup-hud-apply",
    "aria-label": "Aplicar alterações e reconectar VDO"
  }), "Disponível em qualquer guia. Salva alterações pendentes e reinicia sua conexão VDO.");
  apply.addEventListener("click", () => {
    const connect = panel.querySelector(".rpgup-personal-connect .rpgup-primary");
    if (connect) connect.click();
    else ui.notifications.warn("As opções da câmera ainda não carregaram.");
  });
  const applyStatus = element("p", "", { class: "rpgup-hud-apply-status", role: "status", "aria-live": "polite" });
  actions.append(toggle, apply, applyStatus);
  const formHost = element("div", undefined, { class: "rpgup-hud-options" });
  panel.append(header, invite, actions, formHost);
  // Non-invasive overlay: native sidebar content stays rendered, visible to
  // Foundry's own tab controller, and retains all its event handlers. This
  // panel only covers it visually while the HUD is open.
  content.classList.add("rpgup-hud-overlay-host");
  content.append(panel);

  const state = { root, nav, content, trigger, panel, formHost, input, copy, status, refreshToggle };
  mounted = state;
  renderInvite(state);
  void mountForm(state).catch(report);
  refreshToggle();

  // The HUD is intentionally NOT part of Foundry's tabs. Its button is a
  // regular control, and the panel is an absolutely positioned overlay.
  // No native .active or aria-selected changes, no changeTab calls, no
  // preventing propagation of clicks intended for native tabs.
  const deactivate = () => {
    if (panel.hidden) return;
    panel.hidden = true;
    trigger.classList.remove("active", "selected");
    trigger.setAttribute("aria-pressed", "false");
    nav.classList.remove("rpgup-hud-nav-active");
  };
  const activate = () => {
    void ui.sidebar?.expand?.();
    panel.hidden = false;
    trigger.classList.add("active");
    trigger.setAttribute("aria-pressed", "true");
    nav.classList.add("rpgup-hud-nav-active");
    renderInvite(state);
    refreshToggle();
  };
  trigger.addEventListener("click", event => {
    // This ordinary button does not match the native [data-tab] selector.
    // Avoid canceling the event: Foundry's own sidebar click handling can
    // safely ignore it instead of desynchronizing its internal tab state.
    activate();
  });
  nav.addEventListener("click", event => {
    const native = event.target.closest?.("[data-tab]");
    if (!native || !nav.contains(native)) return;
    // Let the native event bubble normally and do its own work.
    deactivate();
  });
  // Keyboard shortcuts or a programmatic change to a different native tab
  // must also hide the HUD. The tab currently selected when HUD opens remains
  // selected (and usable) all along.
  let nativeOnOpen = null;
  const activeNative = () => ui.sidebar?.tabGroups?.primary ??
    ui.sidebar?.tabGroups?.sidebar ??
    Array.from(nav.querySelectorAll("[data-tab]")).find(el =>
      el.classList.contains("active") || el.getAttribute("aria-selected") === "true")?.dataset.tab;
  const activateHUD = () => {
    nativeOnOpen = activeNative();
    activate();
  };
  const observer = new MutationObserver(() => {
    if (!panel.hidden && activeNative() !== nativeOnOpen) deactivate();
  });
  observer.observe(nav, { attributes: true, subtree: true, attributeFilter: ["class", "aria-selected"] });
  state.activate = activateHUD;
  return state;
}

export function openHudSidebar() {
  const state = install();
  if (!state) return false;
  state.activate();
  return true;
}

export function refreshHudSidebar() {
  const state = install();
  if (state) {
    renderInvite(state);
    state.refreshToggle();
  }
}

export function registerHudSidebar() {
  Hooks.on("renderSidebar", () => install());
  Hooks.once("ready", () => install());
}

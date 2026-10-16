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

  // Copy the structural element of a native tab to inherit the current Foundry
  // sidebar layout (including third-party skins and V13/V14 button shapes).
  const nativeTab = nav.querySelector('[data-tab="settings"]') ?? nav.querySelector("[data-tab]");
  const trigger = nativeTab?.cloneNode(false) ?? element("button");
  trigger.removeAttribute("id");
  trigger.removeAttribute("data-action");
  trigger.removeAttribute("aria-controls");
  trigger.dataset.tab = TAB;
  trigger.classList.remove("active", "selected");
  trigger.classList.add("rpgup-hud-tab");
  trigger.setAttribute("type", "button");
  trigger.setAttribute("aria-label", "HUD de câmeras");
  trigger.setAttribute("aria-selected", "false");
  trigger.replaceChildren(element("i", undefined, { class: "fas fa-video", "aria-hidden": "true" }));
  tooltip(trigger, "HUD de câmeras · RPGUP VDO.Ninja");
  nav.append(trigger);

  const panel = element("section", undefined, {
    class: "rpgup-vdo rpgup-sidebar-pane", role: "tabpanel",
    "aria-label": "HUD de câmeras", hidden: ""
  });
  panel.dataset.tab = TAB;
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
  actions.append(toggle);
  const formHost = element("div", undefined, { class: "rpgup-hud-options" });
  panel.append(header, invite, actions, formHost);
  content.append(panel);

  const state = { root, nav, content, trigger, panel, formHost, input, copy, status, refreshToggle };
  mounted = state;
  renderInvite(state);
  void mountForm(state).catch(report);
  refreshToggle();

  const deactivate = () => {
    if (panel.hidden) return;
    content.classList.remove("rpgup-hud-active");
    panel.hidden = true;
    trigger.classList.remove("active", "selected");
    trigger.setAttribute("aria-selected", "false");
  };
  const activate = () => {
    // Remember the real Foundry sidebar state. Native tabs remain in the
    // sidebar and work normally when clicked again.
    void ui.sidebar?.expand?.();
    for (const tab of nav.querySelectorAll("[data-tab]")) {
      if (tab !== trigger) {
        tab.classList.remove("active", "selected");
        tab.setAttribute("aria-selected", "false");
      }
    }
    content.classList.add("rpgup-hud-active");
    panel.hidden = false;
    trigger.classList.add("active");
    trigger.setAttribute("aria-selected", "true");
    renderInvite(state);
    refreshToggle();
  };
  nav.addEventListener("click", event => {
    const tab = event.target.closest?.("[data-tab]");
    if (!tab || !nav.contains(tab)) return;
    if (tab === trigger) {
      event.preventDefault();
      event.stopImmediatePropagation();
      activate();
    } else deactivate();
  }, true);
  // Deactivate also when core or another module changes tabs programmatically.
  // This is intentionally scoped to the nav instead of observing the whole UI.
  const observer = new MutationObserver(() => {
    if (panel.hidden) return;
    const selectedElsewhere = Array.from(nav.querySelectorAll("[data-tab]")).some(tab =>
      tab !== trigger && (tab.classList.contains("active") || tab.getAttribute("aria-selected") === "true"));
    if (selectedElsewhere || !trigger.classList.contains("active")) deactivate();
  });
  observer.observe(nav, { attributes: true, subtree: true, attributeFilter: ["class", "aria-selected"] });
  state.activate = activate;
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

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
  const trigger = nativeTab.cloneNode(false);
  trigger.removeAttribute("id");
  trigger.removeAttribute("data-action");
  trigger.removeAttribute("aria-controls");
  trigger.removeAttribute("data-tooltip");
  trigger.removeAttribute("data-tooltip-text");
  trigger.removeAttribute("aria-describedby");
  trigger.dataset.tab = TAB;
  trigger.classList.remove("active", "selected");
  trigger.classList.add("rpgup-hud-tab");
  if (trigger.tagName === "BUTTON") trigger.type = "button";
  else if (trigger.tagName === "A") trigger.removeAttribute("href");
  trigger.setAttribute("aria-label", "HUD de câmeras");
  trigger.setAttribute("aria-selected", "false");
  trigger.replaceChildren(element("i", undefined, { class: "fa-solid fa-headset", "aria-hidden": "true" }));
  tooltip(trigger, "HUD de câmeras · RPGUP VDO.Ninja");
  // Insert before Settings so it appears inside the existing left icon stack
  // even when native sidebar groups have their own grid/flex layout.
  nativeTab.before(trigger);

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
  actions.append(toggle, apply);
  const formHost = element("div", undefined, { class: "rpgup-hud-options" });
  panel.append(header, invite, actions, formHost);
  content.append(panel);

  const state = { root, nav, content, trigger, panel, formHost, input, copy, status, refreshToggle };
  mounted = state;
  renderInvite(state);
  void mountForm(state).catch(report);
  refreshToggle();

  // Foundry v13/v14 owns native tab selection in ApplicationV2.tabGroups.
  // Never mutate a native tab's .active / aria-selected ourselves: doing so
  // leaves the DOM out of sync with that controller. In particular, clicking
  // the already-selected Settings tab becomes a no-op until Chat is visited.
  const selectedNativeTab = () => Array.from(nav.querySelectorAll("[data-tab]")).find(tab =>
    tab !== trigger && (tab.classList.contains("active") || tab.getAttribute("aria-selected") === "true")) ?? null;
  const deactivate = () => {
    if (panel.hidden) return;
    content.classList.remove("rpgup-hud-active");
    nav.classList.remove("rpgup-hud-nav-active");
    panel.hidden = true;
    trigger.classList.remove("active", "selected");
    trigger.setAttribute("aria-selected", "false");
  };
  const activate = () => {
    // We are a visual overlay of the native content pane; the underlying
    // selected Foundry tab remains selected and fully functional.
    state.nativeSelection = selectedNativeTab();
    void ui.sidebar?.expand?.();
    content.classList.add("rpgup-hud-active");
    nav.classList.add("rpgup-hud-nav-active");
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
    } else if (!panel.hidden) {
      // First allow Foundry to handle the *real native click*. Previously
      // preventDefault + stopImmediatePropagation blocked the sidebar's own
      // handlers; a forced changeTab during capture was not a replacement.
      // After Foundry's handler runs, restore an already-active tab if needed.
      deactivate();
      const sidebar = ui.sidebar;
      const tabName = tab.dataset.tab;
      const group = Object.keys(sidebar?.tabGroups ?? {}).find(key =>
        sidebar.tabGroups[key] === tabName) ??
        Object.keys(sidebar?.tabGroups ?? {})[0];
      if (group && typeof sidebar?.changeTab === "function") {
        queueMicrotask(() => {
          // Only touch the same sidebar; user may have switched to another
          // tab or opened the HUD again during this event.
          if (panel.hidden && ui.sidebar === sidebar &&
              sidebar.tabGroups?.[group] === tabName) {
            sidebar.changeTab(tabName, group, { force: true, navElement: tab });
          }
        });
      }
    }
  }, true);
  // Native tab clicks deactivate above, while programmatic changes are
  // detected by *comparing* the native selection to its previous value.
  // The previously selected native tab intentionally stays active in the DOM.
  const observer = new MutationObserver(() => {
    if (panel.hidden) return;
    if (selectedNativeTab() !== state.nativeSelection || !trigger.classList.contains("active")) deactivate();
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

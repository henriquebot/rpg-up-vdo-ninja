import { MODULE_ID } from "./config.js";
import { registerSettings, userPrefs } from "./settings.js";
import { RoomDock } from "./room-dock.js";
import { WorldConfig } from "./world-config.js";
import { report } from "./dom.js";
import { openHudSidebar, refreshHudSidebar, registerHudSidebar } from "./sidebar.js";

export async function openDock() {
  const dock = new RoomDock();
  // The singleton survives closing; recover preferences edited while closed
  // from the user's latest saved flags before creating the new VDO iframe.
  if (!dock.rendered) dock.prefs = userPrefs();
  await dock.render({ force: true });
  dock.bringToFront();
  syncDockButton();
  return dock;
}

// Toggle the existing local application. Closing ends this user's VDO iframe
// and media connection; opening creates the single room iframe again.
export async function toggleDock() {
  const dock = RoomDock.instance;
  if (dock?.rendered && dock.element?.isConnected) {
    await dock.close();
    syncDockButton();
    return null;
  }
  return openDock();
}

export async function toggleOptions() {
  if (openHudSidebar()) return null;
  const panel = new WorldConfig();
  if (panel.rendered && panel.element?.isConnected) {
    await panel.close();
    return null;
  }
  await panel.render({ force: true });
  panel.bringToFront();
  return panel;
}

function syncDockButton() {
  const open = Boolean(RoomDock.instance?.rendered && RoomDock.instance.element?.isConnected);
  document.querySelectorAll(".rpgup-open-dock").forEach(button => {
    button.setAttribute("aria-pressed", String(open));
    button.title = open ? "Fechar câmeras VDO.Ninja" : "Abrir câmeras VDO.Ninja";
  });
}

Hooks.once("init", () => {
  registerSettings(RoomDock, WorldConfig, () => {
    WorldConfig.instance?.configChanged();
    RoomDock.instance?.configChanged();
    refreshHudSidebar();
  });
  registerHudSidebar();
  game.modules.get(MODULE_ID).api = Object.freeze({ openDock, toggleDock, toggleOptions, openHudSidebar, dock: () => RoomDock.instance });
});

Hooks.once("ready", () => {
  if (userPrefs().autoOpen) openDock().catch(report);
});

Hooks.on("updateUser", (user, changes) => {
  // User color is used on every peer's camera tile. A reconnection is required
  // for the viewer's VDO stylesheet to reflect another player's changed color.
  if (["name", "role", "avatar", "color"].some(key => changes[key] !== undefined)) {
    WorldConfig.instance?.refreshUsers();
    RoomDock.instance?.configChanged();
  }
});

Hooks.on("createUser", () => WorldConfig.instance?.refreshUsers());
Hooks.on("deleteUser", () => WorldConfig.instance?.refreshUsers());
Hooks.on("userConnected", () => WorldConfig.instance?.refreshUsers());

// Earlier Foundry builds (and the offline fixture) may not expose a sidebar
// mount point. Keep an unobtrusive settings-tab fallback only in that case.
Hooks.on("renderSettings", (app, html) => {
  if (ui.sidebar?.element || document.querySelector("#sidebar-tabs")) return;
  const root = html?.querySelector ? html : html?.[0];
  if (!root || root.querySelector(".rpgup-open-dock")) return;
  const cameras = document.createElement("button");
  cameras.type = "button";
  cameras.className = "rpgup-open-dock";
  cameras.textContent = "Câmeras VDO.Ninja";
  cameras.addEventListener("click", () => toggleDock().catch(report));
  const options = document.createElement("button");
  options.type = "button";
  options.className = "rpgup-open-dock-options";
  options.textContent = "HUD VDO.Ninja";
  options.addEventListener("click", () => toggleOptions().catch(report));
  (root.querySelector("section.settings") ?? root).append(cameras, options);
  syncDockButton();
});

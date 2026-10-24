import { MODULE_ID } from "./config.js";
import { registerSettings, userPrefs } from "./settings.js";
import { RoomDock } from "./room-dock.js";
import { WorldConfig } from "./world-config.js";
import { report } from "./dom.js";

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

// Scene Control action: on an open dock this only changes visibility and
// available canvas space; it does not close/reload the VDO iframe.
export async function toggleDockCollapsed() {
  const dock = new RoomDock();
  if (!dock.rendered || !dock.element?.isConnected) {
    // The user may have disabled auto-open or closed the application.
    // The same left control then restores a visible dock in one click.
    dock.prefs = userPrefs();
    dock.prefs.collapsed = false;
    await dock.setCollapsed(false);
    await openDock();
    return false;
  }
  return dock.setCollapsed(!dock.prefs.collapsed);
}

export async function toggleOptions() {
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
  });
  game.modules.get(MODULE_ID).api = Object.freeze({ openDock, toggleDock, toggleOptions, toggleDockCollapsed, openHudSidebar: toggleOptions, dock: () => RoomDock.instance });
});

// Official Foundry v13/v14 Scene Controls API: one button in the left
// Token tool palette, never a fake sidebar tab or floating overlay.
Hooks.on("getSceneControlButtons", controls => {
  const token = controls?.tokens;
  if (!token?.tools) return;
  token.tools["rpgup-vdo-options"] = {
    name: "rpgup-vdo-options",
    title: "Configurações RPGUP VDO.Ninja",
    icon: "fa-solid fa-video",
    order: Object.keys(token.tools).length,
    button: true,
    visible: true,
    onChange: () => void toggleOptions().catch(report)
  };
  token.tools["rpgup-vdo-collapse"] = {
    name: "rpgup-vdo-collapse",
    title: "Recolher / mostrar dock VDO.Ninja",
    icon: "fa-solid fa-compress",
    order: Object.keys(token.tools).length,
    button: true,
    visible: true,
    onChange: () => void toggleDockCollapsed().catch(report)
  };
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


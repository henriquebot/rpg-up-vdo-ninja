import { MODULE_ID, DEFAULT_WORLD, normalizePrefs } from "./config.js";

export function worldConfig() {
  // Settings returns the live Setting value. A panel must never edit that cache.
  return structuredClone(game.settings.get(MODULE_ID, "world"));
}

export async function saveWorld(config) {
  if (!game.user.isGM) throw new Error("Somente o GM pode salvar configurações.");
  await game.settings.set(MODULE_ID, "world", structuredClone(config));
  const saved = worldConfig();
  if (JSON.stringify(saved) !== JSON.stringify(config)) {
    throw new Error("O Foundry não confirmou o salvamento da Room e dos slots. Reabra o painel para conferir os dados.");
  }
  return saved;
}

export function userPrefs() {
  const prefs = game.user.getFlag(MODULE_ID, "preferences");
  // Versions up to 1.0.1 defaulted to floating. Migrate that default once to left;
  // keep explicit side/top/bottom choices, and preserve all choices saved under v3.
  const migrateFloating = prefs && (Number(prefs.schemaVersion) || 0) < 3 && (!prefs.dock || prefs.dock === "floating");
  return normalizePrefs(migrateFloating ? { ...prefs, dock: "left" } : prefs);
}

export function savePrefs(prefs) {
  return game.user.setFlag(MODULE_ID, "preferences", normalizePrefs(prefs));
}

export function registerSettings(RoomDock, WorldConfig, onChange) {
  game.settings.register(MODULE_ID, "world", {
    name: "Room VDO.Ninja", scope: "world", config: false,
    type: Object, default: structuredClone(DEFAULT_WORLD), onChange
  });
  game.settings.registerMenu(MODULE_ID, "worldConfig", {
    name: "RPGUP VDO.Ninja — HUD", label: "Abrir HUD de câmeras",
    hint: "Use a aba HUD ao lado de Cenas, Atores e Configurações para acessar todos os controles. Esta janela é um acesso alternativo para o mestre.",
    icon: "fas fa-video", type: WorldConfig, restricted: true
  });
  game.settings.registerMenu(MODULE_ID, "openDock", {
    name: "RPGUP VDO.Ninja — Câmeras", label: "Abrir dock de câmeras",
    hint: "Use o botão Opções VDO.Ninja na aba Configurações do Foundry; Câmeras VDO.Ninja alterna abrir/fechar a dock. Câmera e PiP usam os controles do VDO.",
    icon: "fas fa-video", type: RoomDock, restricted: false
  });
}

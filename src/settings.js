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
    name: "RPGUP VDO.Ninja — Configurações", label: "Abrir configurações",
    hint: "Configurações da sala para o mestre e preferências pessoais para cada jogador. Também acessível pelo botão VDO na barra de ferramentas à esquerda (Tokens).",
    icon: "fas fa-video", type: WorldConfig, restricted: false
  });
  game.settings.registerMenu(MODULE_ID, "openDock", {
    name: "RPGUP VDO.Ninja — Câmeras", label: "Abrir dock de câmeras",
    hint: "Abre ou fecha a área das câmeras; configurações ficam no menu acima ou no botão VDO da barra de ferramentas à esquerda.",
    icon: "fas fa-video", type: RoomDock, restricted: false
  });
}

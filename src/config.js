export const MODULE_ID = "rpgup-vdo-ninja";

// The first Room suggestion is based on the Foundry world title. It never
// overwrites an already saved Room or a GM's manual edits.
export function suggestRoomId(world = {}) {
  const title = String(world?.title || world?.name || world?.id || "");
  const normalized = title.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 49);
  return normalized || "MesaVDO";
}
export const VDO_BASE = "https://vdo.ninja/";
export const DOCKS = { left: "Esquerda", right: "Direita", top: "Topo", bottom: "Embaixo", floating: "Flutuante" };
export const AVATARS = { foundry: "Avatar Foundry / da mesa", custom: "Imagem por URL", none: "Sem placeholder" };
export const ROOM_LAYOUTS = { native: "Padrão VDO.Ninja", compact: "Compacto / preencher espaço" };
export const CAMERA_THEMES = {
  none: "Sem bordas / VDO original",
  scifi: "Sci-fi",
  modern: "Moderno · discreto",
  neon: "Neon",
  rustic: "Rústico",
  fantasy: "Fantástico"
};
export const QUALITY_PRESETS = {
  native: { label: "Automático · VDO.Ninja", help: "Mantém a qualidade adaptativa do VDO. Nenhum limite adicional é imposto pelo módulo.", params: {} },
  economy: { label: "Economia · 200 kbps", help: "Limita cada vídeo enviado aos outros jogadores a 200 kbps e captura a até 20 fps. Útil em conexões ou computadores modestos.", params: { roombitrate: "200", maxframerate: "20" } },
  balanced: { label: "Equilibrado · 500 kbps", help: "Limita cada vídeo enviado aos jogadores a 500 kbps e captura a até 30 fps. A qualidade efetiva é adaptativa.", params: { roombitrate: "500", maxframerate: "30" } },
  detail: { label: "Mais detalhe · 1.200 kbps", help: "Permite até 1.200 kbps por vídeo para jogadores e captura a até 30 fps. O orçamento da Room e a conexão ainda limitam a qualidade; pode exigir ajuste pelo Director.", params: { roombitrate: "1200", maxframerate: "30" } }
};
// These are VDO's browser-side filters, not a replacement for Discord Krisp.
// Discord rooms keep their existing noaudio behaviour; filters are applied
// only to the publisher microphone when native VDO audio is selected.
export const AUDIO_FILTER_PRESETS = {
  voice: "Voz limpa · recomendado",
  enhanced: "Redução reforçada · ambientes barulhentos",
  off: "Desligado · áudio sem filtros extras",
  custom: "Personalizado"
};
export const DEFAULT_AUDIO_FILTERS = Object.freeze({
  preset: "voice",
  denoise: true, echoCancellation: true, autoGain: true,
  noiseGate: false, compressor: false, lowcutHz: 0
});
const AUDIO_PRESET_SETTINGS = Object.freeze({
  voice: { denoise: true, echoCancellation: true, autoGain: true, noiseGate: false, compressor: false, lowcutHz: 0 },
  enhanced: { denoise: true, echoCancellation: true, autoGain: true, noiseGate: true, compressor: true, lowcutHz: 100 },
  off: { denoise: false, echoCancellation: false, autoGain: false, noiseGate: false, compressor: false, lowcutHz: 0 }
});
export function audioFilterPreset(preset) {
  if (!Object.hasOwn(AUDIO_FILTER_PRESETS, preset)) throw new Error("Preset de áudio inválido.");
  return { preset, ...(AUDIO_PRESET_SETTINGS[preset] ?? AUDIO_PRESET_SETTINGS.voice) };
}
export function validateAudioFilters(input) {
  if (input === undefined || input === null) return { ...DEFAULT_AUDIO_FILTERS };
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Filtros de áudio inválidos.");
  const preset = input.preset ?? "voice";
  if (!Object.hasOwn(AUDIO_FILTER_PRESETS, preset)) throw new Error("Preset de áudio inválido.");
  const result = { ...audioFilterPreset(preset) };
  if (preset !== "custom") return result;
  for (const key of ["denoise", "echoCancellation", "autoGain", "noiseGate", "compressor"]) {
    if (typeof input[key] !== "boolean") throw new Error(`Filtro ${key}: escolha ligado ou desligado.`);
    result[key] = input[key];
  }
  const lowcut = Number(input.lowcutHz);
  if (!Number.isInteger(lowcut) || ![0, 80, 100, 120, 150, 180, 200].includes(lowcut)) throw new Error("Corte de graves: escolha uma frequência permitida.");
  result.lowcutHz = lowcut;
  return result;
}
export const DEFAULT_WORLD = { roomId: "", extraQuery: "", audio: "discord", audioFilters: { ...DEFAULT_AUDIO_FILTERS }, directorUserId: "", slots: {}, quality: "native", avatars: {}, roomLayout: "native", theme: "modern" };
export const DEFAULT_PREFS = {
  dock: "left", autoOpen: true, collapsed: false, presentation: "adaptive",
  zoom: 1, avatar: "foundry", avatarURL: "",
  sideWidth: 440, barHeight: 360,
  floating: { width: 720, height: 600, left: 120, top: 80 }
};

// Deliberately small: only explicit connection, quality and Room layout options.
const EXTRA_PARAMS = new Set(["password", "roombitrate", "totalroombitrate", "videobitrate", "codec", "width", "height", "fps", "maxframerate", "structure", "cover"]);
const NUMERIC_PARAMS = new Set(["roombitrate", "totalroombitrate", "videobitrate", "width", "height", "fps", "maxframerate"]);

export function parseExtraQuery(input = "") {
  if (typeof input !== "string" || input.includes("#") || input.includes("?")) {
    throw new Error("Use parâmetros como password=Senha123&roombitrate=500, sem URL, ? ou #.");
  }
  const params = new URLSearchParams(input.trim().replace(/^&/, ""));
  const seen = new Set();
  for (const [key, value] of params) {
    if (!EXTRA_PARAMS.has(key) || seen.has(key)) throw new Error(`Parâmetro não permitido ou repetido: ${key}.`);
    seen.add(key);
    // VDO checks presence, so structure=0 / cover=false would still enable them.
    if (key === "structure" && value !== "") throw new Error("Use structure sem valor.");
    if (key === "cover" && !["", "2"].includes(value)) throw new Error("Use cover sem valor ou cover=2 (recorte horizontal).");
    if (key === "password" && !/^[A-Za-z0-9]{1,49}$/.test(value)) throw new Error("Senha VDO: use 1–49 letras ou números.");
    if (NUMERIC_PARAMS.has(key) && !/^[1-9]\d{0,5}$/.test(value)) throw new Error(`${key} precisa ser um inteiro positivo (até 6 dígitos).`);
    if (key === "codec" && !["h264", "vp8", "vp9", "av1"].includes(value.toLowerCase())) throw new Error("Codec permitido: h264, vp8, vp9 ou av1.");
  }
  return params;
}

export function validateWorld(input, users = []) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Configuração do World inválida.");
  const roomId = String(input.roomId ?? "").trim();
  if (!/^[A-Za-z0-9]{1,49}$/.test(roomId)) throw new Error("Room ID: use 1–49 letras ou números, respeitando maiúsculas.");
  parseExtraQuery(input.extraQuery);
  if (!["discord", "vdo"].includes(input.audio)) throw new Error("Modo de áudio inválido.");
  const directorUserId = String(input.directorUserId ?? "");
  if (directorUserId && !users.some(user => user.id === directorUserId && user.isGM)) throw new Error("O Director precisa ser um GM deste World.");
  if (!input.slots || typeof input.slots !== "object" || Array.isArray(input.slots)) throw new Error("Associação de slots inválida.");
  const slots = {};
  const used = new Set();
  for (const [userId, streamId] of Object.entries(input.slots)) {
    if (["__proto__", "constructor", "prototype"].includes(userId)) throw new Error("userId inválido.");
    if (typeof streamId !== "string" || !/^[A-Za-z0-9_]{1,64}$/.test(streamId)) throw new Error(`Stream ID inválido para ${userId}: use 1–64 letras, números ou _ .`);
    if (used.has(streamId)) throw new Error(`Stream ID duplicado: ${streamId}.`);
    used.add(streamId);
    slots[userId] = streamId;
  }
  const quality = input.quality ?? "native";
  if (!Object.hasOwn(QUALITY_PRESETS, quality)) throw new Error("Preset de qualidade inválido.");
  const roomLayout = input.roomLayout ?? "native";
  if (!Object.hasOwn(ROOM_LAYOUTS, roomLayout)) throw new Error("Layout da Room inválido.");
  const theme = input.theme ?? DEFAULT_WORLD.theme;
  if (!Object.hasOwn(CAMERA_THEMES, theme)) throw new Error("Tema visual das câmeras inválido.");
  const avatars = {};
  if (input.avatars !== undefined && (!input.avatars || typeof input.avatars !== "object" || Array.isArray(input.avatars))) throw new Error("Associação de avatares inválida.");
  for (const [userId, image] of Object.entries(input.avatars ?? {})) {
    if (["__proto__", "constructor", "prototype"].includes(userId) || typeof image !== "string" || image.length > 2048) throw new Error("Avatar de usuário inválido.");
    if (!image.trim()) continue;
    let source;
    try { source = new URL(image.trim(), "https://foundry.invalid/"); } catch { throw new Error(`Avatar inválido para ${userId}.`); }
    if (!["http:", "https:"].includes(source.protocol) || source.username || source.password) throw new Error(`Avatar de ${userId}: use um caminho Foundry ou URL HTTP/HTTPS sem credenciais.`);
    avatars[userId] = image.trim();
  }
  const audioFilters = validateAudioFilters(input.audioFilters);
  return { roomId, extraQuery: input.extraQuery.trim(), audio: input.audio, audioFilters, directorUserId, slots, quality, avatars, roomLayout, theme };
}

export function fillMissingSlots(slots, users, randomBytes = size => crypto.getRandomValues(new Uint8Array(size))) {
  const result = { ...slots };
  const used = new Set(Object.values(result));
  for (const user of users) {
    if (Object.hasOwn(result, user.id) && result[user.id]) continue;
    let id;
    let attempts = 0;
    do {
      if (++attempts > 100) throw new Error("Não foi possível gerar um slot único.");
      id = "slot_" + Array.from(randomBytes(10), byte => byte.toString(16).padStart(2, "0")).join("");
    } while (used.has(id));
    result[user.id] = id;
    used.add(id);
  }
  return result;
}

const bounded = (value, fallback, min, max) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export function normalizePrefs(input = {}) {
  // v4: adaptive is now the default for all users, including old installs.
  // Old native was the implicit default; after migrating to v4 an explicitly
  // selected native mode remains native on every subsequent load.
  const oldPresentation = (Number(input?.schemaVersion) || 0) < 4;
  const presentation = oldPresentation && input?.presentation !== "minimal"
    ? "adaptive"
    : ["native", "minimal", "adaptive"].includes(input?.presentation)
      ? input.presentation : DEFAULT_PREFS.presentation;
  return {
    schemaVersion: 4,
    dock: Object.hasOwn(DOCKS, input?.dock) ? input.dock : DEFAULT_PREFS.dock,
    autoOpen: typeof input?.autoOpen === "boolean" ? input.autoOpen : true,
    collapsed: typeof input?.collapsed === "boolean" ? input.collapsed : false,
    presentation,
    zoom: bounded(input?.zoom, 1, 0.5, 1.5),
    avatar: Object.hasOwn(AVATARS, input?.avatar) ? input.avatar : "foundry",
    avatarURL: typeof input?.avatarURL === "string" ? input.avatarURL.trim().slice(0, 2048) : "",
    sideWidth: bounded(input?.sideWidth, 440, 320, 2400),
    barHeight: bounded(input?.barHeight, 360, 240, 1800),
    floating: {
      width: bounded(input?.floating?.width, 720, 320, 2400),
      height: bounded(input?.floating?.height, 600, 240, 1800),
      left: bounded(input?.floating?.left, 120, 0, 10000),
      top: bounded(input?.floating?.top, 80, 0, 10000)
    }
  };
}

export function dockPosition(prefs, viewport) {
  const p = normalizePrefs(prefs);
  // Docked windows use every pixel of the viewport, without blank strips
  // above, below, or along their outer edges. Floating stays inset by 8px.
  if (["left", "right"].includes(p.dock)) {
    const width = Math.min(p.sideWidth, viewport.width, Math.max(1, viewport.width * 0.5));
    return { width, height: viewport.height, left: p.dock === "left" ? 0 : viewport.width - width, top: 0 };
  }
  if (["top", "bottom"].includes(p.dock)) {
    const height = Math.min(p.barHeight, viewport.height, Math.max(1, viewport.height * 0.5));
    return { width: viewport.width, height, left: 0, top: p.dock === "top" ? 0 : viewport.height - height };
  }
  const gap = 8;
  const maxWidth = Math.max(1, viewport.width - gap * 2);
  const maxHeight = Math.max(1, viewport.height - gap * 2);
  const width = Math.min(p.floating.width, maxWidth);
  const height = Math.min(p.floating.height, maxHeight);
  return {
    width, height,
    left: Math.min(p.floating.left, viewport.width - gap - width),
    top: Math.min(p.floating.top, viewport.height - gap - height)
  };
}

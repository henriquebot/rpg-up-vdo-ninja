import { VDO_BASE, QUALITY_PRESETS, parseExtraQuery, validateWorld, normalizePrefs } from "./config.js";
import { themeCSS, encodeThemeCSS } from "./theme.js";
import { presentationCSS } from "./presentation.js";

// Nginx commonly rejects request-lines above ~8 KB. Leave room for URL
// encoding, proxies, and future VDO parameters: NEVER navigate a longer URL.
export const MAX_VDO_URL_LENGTH = 6900;

function configuredURL(world, users) {
  const config = validateWorld(world, users);
  const url = new URL(VDO_BASE);
  url.searchParams.set("room", config.roomId);
  return { config, url };
}

function addExtras(url, world, { viewer = false } = {}) {
  const params = new URLSearchParams(QUALITY_PRESETS[world.quality].params);
  // Native cover fills the allocated area. structure would constrain it to 16:9
  // and retained the vertical gaps in the official renderer probe.
  if (!viewer && world.roomLayout === "compact") params.set("cover", "");
  // Explicit advanced values take precedence over the selected preset.
  for (const [key, value] of parseExtraQuery(world.extraQuery)) params.set(key, value);
  for (const [key, value] of params) {
    // OBS receives connection/password options, never Room layout or capture constraints.
    if (viewer && !["password", "codec", "videobitrate"].includes(key)) continue;
    url.searchParams.set(key, value);
  }
}

export function avatarSource(user, prefs = {}, baseURL = globalThis.location?.href) {
  prefs = normalizePrefs(prefs);
  if (prefs.avatar === "none") return null;
  const image = prefs.avatar === "custom" ? prefs.avatarURL : user.avatar;
  if (!image) {
    if (prefs.avatar === "custom") throw new Error("Informe a URL da imagem do placeholder nas configurações da dock.");
    return "default";
  }
  const avatar = new URL(image, baseURL);
  if (!["http:", "https:"].includes(avatar.protocol) || avatar.username || avatar.password) throw new Error("Placeholder: use uma imagem por URL HTTP/HTTPS ou o avatar do usuário Foundry.");
  if (new URL(baseURL ?? VDO_BASE).protocol === "https:" && avatar.protocol !== "https:") throw new Error("Placeholder: em Foundry HTTPS, use uma imagem HTTPS.");
  return avatar.href;
}

export function participantURL(world, user, prefs = {}, users = [user], baseURL = globalThis.location?.href, preparedAvatar) {
  prefs = normalizePrefs(prefs);
  const { config, url } = configuredURL(world, users);
  const streamId = Object.hasOwn(config.slots, user.id) ? config.slots[user.id] : null;
  if (!streamId) throw new Error("O GM ainda não associou um Stream ID ao seu usuário.");
  url.searchParams.set("push", streamId);
  // Keep the VDO.Ninja native top header (including its viewer indicator)
  // visible in the embedded dock and in individual publisher links.
  // &showheader explicitly restores it even if another VDO UI mode hides it.
  url.searchParams.set("showheader", "");
  url.searchParams.set("label", user.name);
  // Label is already the Foundry username; showlabels makes it visible on each tile.
  url.searchParams.set("showlabels", "rounded");
  const isDirector = config.directorUserId === user.id && user.isGM;
  // Load the optional styling with the document, before a guest joins the
  // room. postMessage after iframe.onload was too late/unreliable in actual
  // sessions. Keep styling local to this user's link; never alter OBS exports.
  const extraPresentation = presentationCSS(prefs.presentation, { director: isDirector });
  const css = themeCSS(config, users);
  const assembledCSS = [css, extraPresentation].filter(Boolean).join("");
  if (assembledCSS) url.searchParams.set("base64css", encodeThemeCSS(assembledCSS));
  if (config.theme !== "none" && config.audio === "vdo") {
    // Official native speaker outline: meterstyle=4 only sets a data attribute
    // and was invisible in real calls. 2 draws the VDO audio activity border.
    url.searchParams.set("meterstyle", "2");
  }
  if (isDirector) {
    url.searchParams.set("director", config.roomId);
    url.searchParams.set("showdirector", "1");
    url.searchParams.set("previewmode", "");
  }
  addExtras(url, config);
  if (config.audio === "vdo") {
    // Native VDO microphone processing; no extra media stream, proxy or audio
    // capture. Works for embedded and browser publisher links, not OBS viewers.
    const f = config.audioFilters;
    url.searchParams.set("denoise", f.denoise ? "1" : "0");
    url.searchParams.set("echocancellation", f.echoCancellation ? "1" : "0");
    url.searchParams.set("autogain", f.autoGain ? "1" : "0");
    if (f.noiseGate) url.searchParams.set("noisegate", "1");
    if (f.compressor) url.searchParams.set("compressor", "1");
    if (f.lowcutHz) url.searchParams.set("lowcut", String(f.lowcutHz));
  }
  const avatarUser = { ...user, avatar: config.avatars[user.id] || user.avatar };
  const avatar = preparedAvatar === undefined ? avatarSource(avatarUser, prefs, baseURL) : preparedAvatar;
  if (avatar) url.searchParams.set("avatar", avatar);
  if (config.audio === "discord") {
    url.searchParams.set("audiodevice", "0");
    url.searchParams.set("noaudio", "");
  }
  // Keep at least 2.5 KB available for the avatar. With many users,
  // prioritize the selected layout over per-user border colors, then fall
  // back to only the minimalist header if the safe request-line budget shrinks.
  if (url.searchParams.has("base64css")) {
    const urlWithoutAvatar = () => {
      const baseline = new URL(url);
      baseline.searchParams.delete("avatar");
      return baseline.href.length;
    };
    if (urlWithoutAvatar() > MAX_VDO_URL_LENGTH - 2500) {
      if (extraPresentation) url.searchParams.set("base64css", encodeThemeCSS(extraPresentation));
      else url.searchParams.delete("base64css");
      url.searchParams.delete("meterstyle");
    }
    if (extraPresentation && urlWithoutAvatar() > MAX_VDO_URL_LENGTH - 2500) {
      url.searchParams.set("base64css", encodeThemeCSS(presentationCSS("minimal")));
    }
    if (urlWithoutAvatar() > MAX_VDO_URL_LENGTH - 2500) url.searchParams.delete("base64css");
  }
  // Avatar gets resized before this step in the dock, but direct callers
  // may supply oversized images. Prefer preserving optional presentation.
  if (url.href.length > MAX_VDO_URL_LENGTH) {
    url.searchParams.delete("avatar");
    url.searchParams.set("avatar", "default");
  }
  if (url.href.length > MAX_VDO_URL_LENGTH) {
    url.searchParams.delete("base64css");
    url.searchParams.delete("meterstyle");
  }
  if (url.href.length > MAX_VDO_URL_LENGTH) {
    throw new Error("URL de entrada VDO excede o limite seguro; reduza parâmetros avançados.");
  }
  // Camera, mobile detection and self-preview are controlled only by the native VDO UI.
  return url.href;
}

// Query-safe avatar budget for this specific world, including stream name,
// audio, room parameters and actual theme CSS. Both embedded and external links
// use the SAME budget so a GM cannot copy a link that would trigger nginx 414.
export function avatarURLBudget(world, user, prefs = {}, users = [user], baseURL = globalThis.location?.href) {
  const baseline = participantURL(world, user, prefs, users, baseURL, null);
  return Math.max(0, Math.min(5800, MAX_VDO_URL_LENGTH - baseline.length - "&avatar=".length - 150));
}

// General guest invitation: never reuse a Foundry user's publisher Stream ID.
// Identified Foundry participants should use their own integrated dock.
export function roomInviteURL(world, users = []) {
  const { config, url } = configuredURL(world, users);
  const password = parseExtraQuery(config.extraQuery).get("password");
  if (password) url.searchParams.set("password", password);
  if (config.audio === "discord") {
    url.searchParams.set("audiodevice", "0");
    url.searchParams.set("noaudio", "");
  }
  return url.href;
}

export function soloURL(world, userId, users = []) {
  const { config, url } = configuredURL(world, users);
  const streamId = Object.hasOwn(config.slots, userId) ? config.slots[userId] : null;
  if (!streamId) throw new Error("Usuário sem Stream ID associado.");
  url.searchParams.set("view", streamId);
  url.searchParams.set("solo", "");
  url.searchParams.set("cleanoutput", "");
  addExtras(url, config, { viewer: true });
  if (config.audio === "discord") url.searchParams.set("noaudio", "");
  return url.href;
}

export function obsExport(world, users = []) {
  const config = validateWorld(world, users);
  return {
    format: "rpgup-vdo-ninja-obs-links", version: 1, roomId: config.roomId,
    sources: users.filter(user => Object.hasOwn(config.slots, user.id)).map(user => ({
      userId: user.id, name: user.name, streamId: config.slots[user.id],
      url: soloURL(config, user.id, users), width: 1280, height: 720
    }))
  };
}

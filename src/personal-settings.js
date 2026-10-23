import { MODULE_ID, DOCKS, AVATARS, normalizePrefs } from "./config.js";
import { userPrefs, savePrefs } from "./settings.js";
import { element, select, field, tooltip, button, report } from "./dom.js";
import { DOCK_PRESENTATIONS } from "./presentation.js";

/**
 * Personal, per-user controls embedded in the unified settings ApplicationV2.
 * This module never saves world settings or modifies VDO's iframe without an
 * explicit user reconnection. Position and zoom update the live dock.
 */
export function createPersonalTabs() {
  let prefs = userPrefs();
  let saving = Promise.resolve();
  const api = () => game.modules.get(MODULE_ID)?.api;
  const currentDock = () => api()?.dock?.();
  const box = className => element("div", undefined, {
    class: "rpgup-tab-section rpgup-personal-settings " + className
  });

  function update(changes, { layout = false, zoom = false, reconnect = false } = {}) {
    prefs = normalizePrefs({ ...prefs, ...changes });
    const snapshot = structuredClone(prefs);
    const dock = currentDock();
    if (dock?.rendered) {
      dock.prefs = normalizePrefs(snapshot);
      if (layout) dock._layout();
      if (zoom) dock._zoomFrame();
      if (reconnect) dock.configChanged();
      // Share the dock's write queue to avoid overwriting newer preferences.
      saving = saving.then(() => dock._persist()).catch(report);
    } else {
      saving = saving.then(() => savePrefs(snapshot)).catch(report);
    }
  }

  const connection = box("rpgup-personal-connect");
  const connectionHelp = element("p", "As opções pessoais são salvas para seu usuário Foundry. A sala é configurada pelo mestre.", { class: "rpgup-help" });
  const connectionStatus = element("p", "", { class: "rpgup-status", role: "status" });
  const reportReconnect = message => {
    connectionStatus.textContent = message;
    const hud = document.querySelector(".rpgup-sidebar-pane:not([hidden]) .rpgup-hud-apply-status");
    if (hud) hud.textContent = message;
  };
  const reconnect = tooltip(button("Aplicar / reconectar", "fa-check", { class: "rpgup-primary" }),
    "Aplica a sala e o avatar atuais, reiniciando a conexão VDO e sua câmera.");
  const reload = tooltip(button("Recarregar sala VDO", "fa-rotate-right"),
    "Reinicia apenas a sala atualmente conectada, sem aplicar um rascunho compartilhado.");
  const connectionActions = element("div", undefined, { class: "rpgup-actions" });
  connectionActions.append(reload, reconnect);
  connection.append(connectionHelp, connectionActions, connectionStatus);

  async function withDock(callback) {
    await saving;
    let dock = currentDock();
    if (!dock?.rendered) dock = await api()?.openDock?.();
    if (dock?.rendered) await callback(dock);
    else ui.notifications.warn("Abra a dock para conectar à sala.");
  }
  reconnect.addEventListener("click", () => {
    reportReconnect("Aplicando preferências e reconectando a sala…");
    void withDock(async dock => {
      await dock._connect();
      refreshAvatarPreview();
      reportReconnect("Reconexão solicitada. Ative sua câmera no VDO.Ninja.");
    }).catch(error => { reportReconnect(String(error.message ?? error)); report(error); });
  });
  reload.addEventListener("click", () => {
    void withDock(dock => dock._reloadRoom()).catch(report);
  });

  const windowPane = box("rpgup-personal-window");
  const dockPosition = select(DOCKS, prefs.dock, "Posição do dock");
  const size = element("input", undefined, { type: "range", min: "320", max: "1200", step: "10", "aria-label": "Tamanho do dock" });
  const zoomReset = tooltip(element("button", Math.round(prefs.zoom * 100) + "%", { type: "button", "aria-label": "Restaurar zoom para 100%" }),
    "Voltar a 100% sem reconectar.");
  const smaller = tooltip(element("button", "−", { type: "button", "aria-label": "Diminuir zoom" }), "Diminuir sem reconectar");
  const larger = tooltip(element("button", "+", { type: "button", "aria-label": "Aumentar zoom" }), "Aumentar sem reconectar");
  const zoom = element("div", undefined, { class: "rpgup-zoom", role: "group", "aria-label": "Zoom do VDO.Ninja" });
  zoom.append(smaller, zoomReset, larger);
  const presentation = select(DOCK_PRESENTATIONS, prefs.presentation, "Exibição das câmeras");
  const auto = element("input", undefined, { type: "checkbox" });
  auto.checked = prefs.autoOpen;
  const autoField = field("Abrir câmeras ao entrar no mundo", auto, "Não liga sua câmera automaticamente.");
  autoField.classList.add("rpgup-toggle");
  function syncSize() {
    const side = ["left", "right"].includes(prefs.dock);
    size.disabled = prefs.dock === "floating";
    size.min = side ? "320" : "240";
    size.value = String(side ? prefs.sideWidth : prefs.barHeight);
  }
  syncSize();
  windowPane.append(
    field("Posição da janela", dockPosition, "Acoplada às bordas ou flutuante. Não reconecta."),
    field("Largura / altura na borda", size, "Ajuste a largura lateral ou a altura superior/inferior."),
    field("Zoom da sala", zoom, "Só altera a escala visual do iframe."),
    field("Exibição das câmeras", presentation, "Experimental e só para você. Original preserva o VDO.Ninja. Cabeçalho mínimo remove a marca e o nome da sala. Ajustar câmeras tenta mostrar todos sem rolagem; pode deixar vídeos menores. Para voltar, escolha Original e clique em Aplicar / reconectar."),
    autoField
  );
  dockPosition.addEventListener("change", () => { update({ dock: dockPosition.value }, { layout: true }); syncSize(); });
  size.addEventListener("input", () => {
    const side = ["left", "right"].includes(prefs.dock);
    update(side ? { sideWidth: Number(size.value) } : { barHeight: Number(size.value) }, { layout: true });
  });
  presentation.addEventListener("change", () => update({ presentation: presentation.value }, { reconnect: true }));
  auto.addEventListener("change", () => update({ autoOpen: auto.checked }));
  function changeZoom(delta, reset = false) {
    const next = reset ? 1 : Math.round(Math.max(.5, Math.min(1.5, prefs.zoom + delta)) * 100) / 100;
    update({ zoom: next }, { zoom: true });
    zoomReset.textContent = Math.round(next * 100) + "%";
  }
  smaller.addEventListener("click", () => changeZoom(-.1));
  larger.addEventListener("click", () => changeZoom(.1));
  zoomReset.addEventListener("click", () => changeZoom(0, true));

  const avatarPane = box("rpgup-personal-avatar");
  const avatar = select(AVATARS, prefs.avatar, "Placeholder");
  const avatarURL = element("input", undefined, {
    type: "url", maxlength: "2048", placeholder: "https://…/imagem.webp",
    "aria-label": "URL do placeholder"
  });
  avatarURL.value = prefs.avatarURL;
  avatarURL.disabled = prefs.avatar !== "custom";
  const avatarSummary = element("div", undefined, { class: "rpgup-avatar-summary" });
  const avatarPreview = element("img", undefined, { class: "rpgup-avatar-preview", alt: "Prévia da imagem da câmera desligada", hidden: "" });
  const avatarStatus = element("p", "", { class: "rpgup-avatar-status", role: "status" });
  avatarSummary.append(avatarPreview, avatarStatus);
  function refreshAvatarPreview() {
    const live = currentDock();
    const world = game.settings.get(MODULE_ID, "world");
    const selection = prefs.avatar === "custom" ? prefs.avatarURL
      : prefs.avatar === "foundry" ? (world?.avatars?.[game.user.id] || game.user.avatar) : "";
    const image = live?._avatarPreview && !live._avatarPreview.hidden
      ? live._avatarPreview.src : selection;
    avatarPreview.hidden = !image || prefs.avatar === "none";
    if (!avatarPreview.hidden) avatarPreview.src = image;
    avatarStatus.textContent = live?._avatarStatus?.textContent ||
      (image ? "Prévia do placeholder. Use Aplicar / reconectar para atualizar a chamada." : "Sem placeholder.");
  }
  avatarPreview.addEventListener("error", () => { avatarPreview.hidden = true; });
  avatarPane.append(
    field("Imagem quando a câmera está desligada", avatar,
      "Avatar do Foundry, imagem personalizada ou nenhum placeholder. O avatar é reaplicado a cada sessão. Clique em Aplicar / reconectar para atualizar a chamada."),
    field("URL da imagem", avatarURL, "Imagem personalizada guardada apenas neste usuário."),
    avatarSummary,
    element("p", "Mudar o placeholder não reinicia a câmera automaticamente.", { class: "rpgup-help" })
  );
  refreshAvatarPreview();
  avatar.addEventListener("change", () => {
    avatarURL.disabled = avatar.value !== "custom";
    update({ avatar: avatar.value }, { reconnect: true });
    refreshAvatarPreview();
  });
  avatarURL.addEventListener("change", () => {
    update({ avatarURL: avatarURL.value.trim() }, { reconnect: true });
    refreshAvatarPreview();
  });

  const help = box("rpgup-personal-help");
  help.append(
    element("p", "Câmera e microfone: use os controles nativos do VDO.Ninja. Preview e PiP: menu do próprio vídeo.", { class: "rpgup-help" }),
    element("p", "Ctrl+Alt+P alterna PiP no Windows/Linux (Cmd+Alt+P no Mac), com foco no VDO.Ninja.", { class: "rpgup-help" }),
    element("p", "Alterações de posição e zoom não reconectam. Aplicar / reconectar encerra a conexão anterior e pode exigir reativar a câmera.", { class: "rpgup-help" })
  );

  return {
    tabs: [
      { key: "connect", title: "Conexão", group: "Minha câmera", icon: "fa-video", children: [connection] },
      { key: "window", title: "Janela", group: "Minha câmera", icon: "fa-window-maximize", children: [windowPane] },
      { key: "avatar", title: "Avatar", group: "Minha câmera", icon: "fa-image", children: [avatarPane] },
      { key: "callhelp", title: "Ajuda", group: "Minha câmera", icon: "fa-circle-question", children: [help] }
    ],
    tourSteps: [
      { tab: "connect", target: () => reconnect, text: "Aplicar / reconectar entra na sala e reinicia sua câmera." },
      { tab: "window", target: () => dockPosition, text: "Escolha onde a dock fica. A posição é salva só para seu usuário." },
      { tab: "window", target: () => zoom, text: "Altere o zoom sem reconectar." },
      { tab: "window", target: () => presentation, text: "Teste o cabeçalho mínimo ou o layout adaptativo. Use Original para reverter; Aplicar / reconectar atualiza o vídeo." },
      { tab: "avatar", target: () => avatar, text: "Escolha a imagem da câmera desligada." }
    ]
  };
}

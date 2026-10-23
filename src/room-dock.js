import { MODULE_ID, dockPosition, normalizePrefs } from "./config.js";
import { participantURL, avatarURLBudget } from "./urls.js";
import { prepareAvatar } from "./avatar.js";
import { worldConfig, userPrefs, savePrefs } from "./settings.js";
import { element, tooltip, report } from "./dom.js";
import { WorldConfig } from "./world-config.js";
import { presentationCSS } from "./presentation.js";

const ApplicationV2 = foundry.applications.api.ApplicationV2;

export class RoomDock extends ApplicationV2 {
  static instance;
  static DEFAULT_OPTIONS = {
    id: "rpgup-vdo-room", classes: ["rpgup-vdo", "rpgup-room-dock"],
    window: { title: "RPGUP VDO.Ninja", icon: "fas fa-video", resizable: true, minimizable: false },
    actions: { toggleModuleSettings: this.prototype._toggleSettings, undock: this.prototype._undock, reloadRoom: this.prototype._reloadRoom },
    position: { width: 720, height: 600 }
  };

  constructor(options = {}) {
    super(options);
    // Foundry settings menus construct their type each time. Return the same local room.
    if (RoomDock.instance) return RoomDock.instance;
    RoomDock.instance = this;
    this.prefs = userPrefs();
    this._saveQueue = Promise.resolve();
    this.onConfigure = async () => {
      if (game.modules.get(MODULE_ID)?.api?.openHudSidebar?.()) return;
      const panel = new WorldConfig();
      if (panel.rendered) await panel.close();
      else { await panel.render({ force: true }); panel.bringToFront(); }
    };
  }

  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    const header = frame.querySelector(".window-header");
    this._reloadButton = tooltip(element("button", undefined, {
      type: "button", class: "header-control icon fa-solid fa-rotate-right", "data-action": "reloadRoom",
      "aria-label": "Recarregar sala VDO"
    }), "Recarregar somente sua sala VDO para atualizar mudanças do Director. Reinicia sua conexão e câmera; mantém o Foundry aberto e não salva rascunhos do GM. Para aplicar opções do módulo, use Aplicar / reconectar.");
    this._settingsButton = tooltip(element("button", undefined, {
      type: "button", class: "header-control icon fa-solid fa-gear", "data-action": "toggleModuleSettings",
      "aria-label": "Opções VDO.Ninja"
    }), "Abrir o HUD de câmeras na barra lateral do Foundry. Câmera e PiP ficam no VDO.Ninja.");
    this._undockButton = tooltip(element("button", undefined, {
      type: "button", class: "header-control icon fa-solid fa-up-right-from-square", "data-action": "undock",
      "aria-label": "Desacoplar janela"
    }), "Transformar o dock de borda em janela flutuante dentro do Foundry, sem reconectar a chamada.");
    const close = header.querySelector('[data-action="close"]');
    header.insertBefore(this._reloadButton, close);
    header.insertBefore(this._settingsButton, close);
    header.insertBefore(this._undockButton, close);
    return frame;
  }

  _reloadRoom() {
    if (this._connecting) return;
    if (!this._iframe || !this._activeURL) return this._connect({ saveDraft: false });
    this._status.textContent = this._pending
      ? "Recarregando a sala atual. Há opções do módulo pendentes; use Aplicar / reconectar para aplicá-las."
      : "Recarregando somente a sala VDO. Ative sua câmera novamente na UI nativa.";
    this._iframe.src = this._activeURL;
  }

  _toggleSettings() {
    void this.onConfigure?.().catch(report);
  }

  _undock() {
    this.prefs.dock = "floating";
    this._layout();
    this._scheduleSave();
  }

  async _renderHTML() {
    if (this._root) return this._root;
    this._listeners = new AbortController();
    this._root = element("section", undefined, { class: "rpgup-room-body" });
    this._frameHost = element("div", undefined, { class: "rpgup-frame-host" });
    this._alert = element("p", "", { class: "rpgup-connection-alert", role: "status", hidden: "" });

    // Hidden accessible state keeps connection and safety diagnostics without
    // putting configuration controls or blank toolbars above the cameras.
    this._status = element("p", "", { class: "rpgup-status", role: "status", hidden: "" });
    this._directorHelp = element("p",
      "Director inicia em Scene Preview. Use Toggle Director Vision no VDO para alternar a cena e o painel.",
      { class: "rpgup-director-help", hidden: "" });
    this._avatarPreview = element("img", undefined, { alt: "Placeholder preparado", hidden: "" });
    this._avatarStatus = element("p", "", { hidden: "" });
    // Keep internal status/image elements detached; the dock is video-only.
    this._root.append(this._alert, this._frameHost);
    void this._connect({ saveDraft: false });
    return this._root;
  }

  _replaceHTML(result, content) {
    // Do not remove/reinsert the browsing context on an ordinary Application rerender.
    if (!content.contains(result)) content.replaceChildren(result);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this._layout();
    if (!this._observer) {
      this._observer = new ResizeObserver(() => this._zoomFrame());
      this._observer.observe(this._frameHost);
    }
    if (!this._resizeListener) {
      this._resizeListener = () => this._layout();
      window.addEventListener("resize", this._resizeListener, { signal: this._listeners.signal });
    }
  }

  async _connect({ saveDraft = true } = {}) {
    if (this._connecting) return;
    this._connecting = true;
    this._reloadButton.disabled = true;
    const signal = this._listeners.signal;
    try {
      if (saveDraft && game.user.isGM && WorldConfig.instance?.dirty) await WorldConfig.instance.saveDraft();
      if (saveDraft) await this._persist();
      if (signal.aborted) return;
      if (!window.isSecureContext) throw new Error("Abra o Foundry por HTTPS (ou localhost) para permitir a câmera no iframe.");
      let world = worldConfig();
      if (!world.roomId?.trim()) throw new Error("Room não configurada. GM: abra World / OBS e salve a sala.");
      // Validate room/assignment before fetching an image for a waiting player.
      participantURL(world, game.user, this.prefs, Array.from(game.users), location.href, null);
      let avatar;
      try {
        const avatarUser = { avatar: world.avatars?.[game.user.id] || game.user.avatar };
        const budget = avatarURLBudget(world, game.user, this.prefs, Array.from(game.users), location.href);
        const prepared = await prepareAvatar(avatarUser, this.prefs, { signal, maxEncodedLength: budget });
        avatar = prepared.value;
        this._avatarPreview.hidden = !avatar || avatar === "default";
        if (!this._avatarPreview.hidden) this._avatarPreview.src = avatar;
        this._avatarStatus.textContent = avatar ? "Placeholder preparado e aplicado à entrada da sala. Ele aparece quando a câmera está desligada." : "Placeholder desativado.";
      } catch (error) {
        if (signal.aborted) return;
        avatar = "default";
        this._avatarPreview.hidden = true;
        this._avatarStatus.textContent = `Placeholder personalizado não aplicado: ${error.message}`;
        ui.notifications.warn(this._avatarStatus.textContent);
      }
      if (signal.aborted) return;
      // Settings may have arrived while a static image was being fetched.
      world = worldConfig();
      const url = participantURL(world, game.user, this.prefs, Array.from(game.users), location.href, avatar);
      const director = new URL(url).searchParams.has("director");
      this._directorHelp.hidden = true;
      if (director && !this._directorNoticeShown) {
        ui.notifications.info(this._directorHelp.textContent);
        this._directorNoticeShown = true;
      }
      if (!this._iframe) {
        this._iframe = element("iframe", undefined, {
          title: "Room oficial do VDO.Ninja", referrerpolicy: "no-referrer", allowfullscreen: ""
        });
        this._iframe.addEventListener("load", () => {
          if (this._pending) return;
          this._applyExperimentalPresentation();
          this._status.textContent = "Documento do iframe carregado. Câmera e conexão: confira na UI VDO.Ninja. PiP: clique na UI nativa ou Ctrl+Alt+P com foco no iframe.";
        }, { signal: this._listeners.signal });
        this._frameHost.replaceChildren(this._iframe);
      }
      this._iframe.allow = "camera; autoplay; fullscreen; display-capture; picture-in-picture" + (world.audio === "vdo" ? "; microphone" : "");
      this._pending = false;
      this._settingsButton.classList.remove("rpgup-attention");
      tooltip(this._settingsButton, "Abrir o HUD de câmeras na barra lateral do Foundry.");
      this._alert.hidden = true;
      this._activeURL = url;
      this._iframe.src = url;
      this._zoomFrame();
      this._status.textContent = "Abrindo a Room. Ative sua câmera na UI nativa do VDO.Ninja. Reconectar encerra a conexão anterior.";
    } catch (error) {
      if (!signal.aborted) {
        this._status.textContent = error.message;
        this._settingsButton?.classList.add("rpgup-attention");
        if (this._settingsButton) tooltip(this._settingsButton, error.message + " Abra as configurações para conferir.");
        this._alert.textContent = error.message;
        this._alert.hidden = Boolean(this._iframe);
      }
    } finally {
      // An aborted avatar fetch may finish after this dock was reopened.
      if (this._listeners.signal === signal) {
        this._connecting = false;
        this._reloadButton.disabled = false;
      }
    }
  }

  _applyExperimentalPresentation() {
    if (!this._iframe?.contentWindow || !this._activeURL) return;
    const director = new URL(this._activeURL).searchParams.has("director");
    const css = presentationCSS(this.prefs.presentation, { director });
    if (!css) return; // "Original" is a real no-op: no manipulation of VDO.
    // Official iframe API; never inspect cross-origin DOM or alter streams.
    // Target a specific trusted origin, not '*'.
    this._iframe.contentWindow.postMessage({ style: css }, new URL(this._activeURL).origin);
  }

  configChanged() {
    if (!this._status) return;
    // A player waiting for an assignment has no active capture to interrupt.
    if (!this._iframe) {
      this._connect({ saveDraft: false });
      return;
    }
    this._pending = true;
    this._settingsButton?.classList.add("rpgup-attention");
    this._status.textContent = "Configuração alterada. Abra a aba HUD e clique em Aplicar / reconectar (a câmera será desconectada).";
    if (this._settingsButton) tooltip(this._settingsButton, this._status.textContent);
  }

  _layout() {
    if (!this.element) return;
    this._layingOut = true;
    try {
      this.element.dataset.dock = this.prefs.dock;
      const position = dockPosition(this.prefs, { width: window.innerWidth, height: window.innerHeight });
      this.setPosition(position);
      this._reserveInterface(position);
      this._undockButton.disabled = this.prefs.dock === "floating";
    } finally {
      this._layingOut = false;
    }
  }

  _prePosition(position) {
    super._prePosition(position);
    if (!this.prefs || this._layingOut) return;
    const next = { ...this.position, ...position };
    if (["left", "right"].includes(this.prefs.dock)) this.prefs.sideWidth = next.width;
    else if (["top", "bottom"].includes(this.prefs.dock)) this.prefs.barHeight = next.height;
    else this.prefs.floating = { width: next.width, height: next.height, left: next.left, top: next.top };
    this.prefs = normalizePrefs(this.prefs);
    Object.assign(position, dockPosition(this.prefs, { width: window.innerWidth, height: window.innerHeight }));
  }

  _onPosition(position) {
    super._onPosition(position);
    if (this._root && !this._layingOut) {
      this._reserveInterface(position);
      this._scheduleSave();
    }
  }

  _zoomFrame() {
    if (!this._iframe) return;
    const scale = this.prefs.zoom;
    this._iframe.style.width = `${100 / scale}%`;
    this._iframe.style.height = `${100 / scale}%`;
    this._iframe.style.transform = `scale(${scale})`;
  }

  _reserveInterface(position) {
    // Scoped CSS reserves the main interface's margins, like the native AV dock.
    // Do not move Foundry nodes or replace CameraViews/AVClient.
    const docked = this.prefs.dock !== "floating";
    document.body.classList.toggle("rpgup-vdo-docked", docked);
    for (const side of ["left", "right", "top", "bottom"]) {
      const amount = docked && this.prefs.dock === side ? (["left", "right"].includes(side) ? position.width : position.height) : 0;
      document.body.style.setProperty(`--rpgup-vdo-${side}`, `${amount}px`);
    }
  }

  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._persist(), 400);
  }

  _persist() {
    clearTimeout(this._saveTimer);
    const snapshot = structuredClone(this.prefs);
    this._saveQueue = this._saveQueue.then(() => savePrefs(snapshot)).catch(report);
    return this._saveQueue;
  }

  async _preClose(options) {
    await this._persist();
    await super._preClose(options);
  }

  _onClose(options) {
    super._onClose(options);
    this._listeners?.abort();
    this._connecting = false;
    this._observer?.disconnect();
    this._observer = null;
    document.body.classList.remove("rpgup-vdo-docked");
    for (const side of ["left", "right", "top", "bottom"]) document.body.style.removeProperty(`--rpgup-vdo-${side}`);
    // Removing the iframe closes its session/capture; reopening creates only one frame.
    this._iframe?.remove();
    this._iframe = this._root = this._status = this._resizeListener = null;
    this._alert = null;
    document.querySelectorAll(".rpgup-open-dock").forEach(button => button.setAttribute("aria-pressed", "false"));
    this._activeURL = null;
  }
}

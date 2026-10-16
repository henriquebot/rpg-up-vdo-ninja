import { MODULE_ID, fillMissingSlots, validateWorld, normalizePrefs, suggestRoomId, QUALITY_PRESETS, ROOM_LAYOUTS, CAMERA_THEMES, AUDIO_FILTER_PRESETS, audioFilterPreset, validateAudioFilters } from "./config.js";
import { worldConfig, saveWorld } from "./settings.js";
import { participantURL, soloURL, obsExport, avatarURLBudget } from "./urls.js";
import { prepareAvatar } from "./avatar.js";
import { themeVisual, foundryUserColor, THEME_STYLES } from "./theme.js";
import { createVDOOptionsEditor } from "./advanced-options.js";
import { element, select, field, tooltip, button, downloadJSON, report } from "./dom.js";
import { createIconTabs } from "./tabs.js";
import { createPersonalTabs } from "./personal-settings.js";

export class WorldConfig extends foundry.applications.api.ApplicationV2 {
  static instance;
  static DEFAULT_OPTIONS = {
    id: "rpgup-vdo-world-config", classes: ["rpgup-vdo", "rpgup-world-config"],
    window: { title: "RPGUP VDO.Ninja — Configurações", icon: "fas fa-video", resizable: true },
    position: { width: 1120, height: 740 }
  };

  constructor(options = {}) {
    super(options);
    if (WorldConfig.instance) return WorldConfig.instance;
    WorldConfig.instance = this;
  }

  async _renderHTML() {
    if (!game.user.isGM) {
      if (this._form) return this._form;
      const personal = createPersonalTabs();
      const container = element("section", undefined, { class: "rpgup-config-form rpgup-personal-only" });
      const tabs = createIconTabs({
        id: "rpgup-world",
        label: "Preferências pessoais VDO.Ninja",
        initial: this._selectedTab ?? "connect",
        onChange: tab => { this._selectedTab = tab; },
        tabs: personal.tabs,
        tourSteps: personal.tourSteps
      });
      container.append(tabs.root);
      this._form = container;
      return container;
    }
    const users = Array.from(game.users);
    const signature = JSON.stringify(users.map(user => [user.id, user.name, user.isGM, user.avatar, user.color?.css ?? String(user.color ?? ""), user.active]));
    if (this._form && this._userSignature === signature) return this._form;
    const draft = this._form ? this._readDraft() : null;
    // Stop background avatar preparation whenever the panel is rebuilt.
    this._linksAbort?.abort();
    const linksAbort = new AbortController();
    this._linksAbort = linksAbort;
    const pendingJoinLinks = [];
    const savedConfig = worldConfig();
    const config = draft ?? savedConfig;
    if (!draft) this._baseConfig = structuredClone(config);
    this._userSignature = signature;
    const form = element("form", undefined, { class: "rpgup-config-form" });
    this._form = form;
    const room = element("input", undefined, { name: "roomId", required: "", maxlength: "49", pattern: "[A-Za-z0-9]+" });
    room.value = config.roomId || suggestRoomId(game.world);
    const extra = element("input", undefined, { name: "extraQuery", placeholder: "password=Senha123&roombitrate=500" });
    extra.value = config.extraQuery;
    const audio = select({ discord: "Discord (VDO sem microfone/reprodução)", vdo: "Áudio e controles nativos VDO.Ninja" }, config.audio, "audio");
    const directors = { "": "GM entra como participante comum" };
    for (const user of users.filter(user => user.isGM)) directors[user.id] = user.name;
    const director = select(directors, config.directorUserId, "directorUserId");
    const quality = select(Object.fromEntries(Object.entries(QUALITY_PRESETS).map(([key, value]) => [key, value.label])), config.quality ?? "native", "quality");
    const roomLayout = select(ROOM_LAYOUTS, config.roomLayout ?? "native", "roomLayout");
    const theme = select(CAMERA_THEMES, config.theme ?? "modern", "theme");
    const filters = validateAudioFilters(config.audioFilters);
    const filterPreset = select(AUDIO_FILTER_PRESETS, filters.preset, "audioFilterPreset");
    const filterDescriptions = {
      denoise: ["Redução de ruído", "Diminui ruídos contínuos do ambiente. Nem todo ruído ou teclado será eliminado."],
      echoCancellation: ["Cancelamento de eco", "Reduz o retorno do som das caixas de áudio para o microfone. Recomendado sem fones."],
      autoGain: ["Ganho automático", "Ajusta o volume do microfone ao falar baixo ou alto. Pode elevar o ruído quando ninguém fala."],
      noiseGate: ["Portão de ruído (agressivo)", "Abaixa o volume durante o silêncio, mas pode cortar palavras curtas. Use para ambientes muito barulhentos."],
      compressor: ["Compressor", "Diminui as diferenças entre trechos altos e baixos; pode alterar a naturalidade da voz."]
    };
    const filterControls = new Map();
    const filterGrid = element("div", undefined, { class: "rpgup-audio-filter-grid" });
    for (const [key, [name, description]] of Object.entries(filterDescriptions)) {
      const control = element("input", undefined, { type: "checkbox", name: "filter_" + key, "aria-label": name });
      control.checked = filters[key];
      tooltip(control, description);
      const label = element("label", undefined, { class: "rpgup-audio-filter-toggle" });
      label.append(control, element("span", name));
      tooltip(label, description);
      filterGrid.append(label);
      filterControls.set(key, control);
    }
    const filterLowcut = select({ "0": "Desligado", "80": "80 Hz", "100": "100 Hz", "120": "120 Hz", "150": "150 Hz", "180": "180 Hz", "200": "200 Hz" }, String(filters.lowcutHz), "audioLowcut");
    const filterNotice = element("p", "", { class: "rpgup-help", role: "status" });
    const togglePreset = () => {
      if (filterPreset.value !== "custom") {
        const settings = audioFilterPreset(filterPreset.value);
        for (const [key, control] of filterControls) control.checked = settings[key];
        filterLowcut.value = String(settings.lowcutHz);
      }
      for (const control of filterControls.values()) control.disabled = filterPreset.value !== "custom";
      filterLowcut.disabled = filterPreset.value !== "custom";
      filterNotice.textContent = audio.value === "discord"
        ? "A mesa está usando Discord. Estes filtros ficam preparados, mas não são aplicados nem ativam o microfone do VDO."
        : "O filtro atua no microfone do VDO.Ninja, antes da transmissão. Salve e peça para os participantes reconectarem. Pode variar conforme o navegador.";
    };
    filterPreset.addEventListener("change", togglePreset);
    audio.addEventListener("change", togglePreset);
    togglePreset();
    const audioFiltersPanel = element("div", undefined, { class: "rpgup-tab-section" });
    audioFiltersPanel.append(
      element("p", "Perfis de tratamento do microfone VDO.Ninja. Voz limpa vem como padrão e usa redução de ruído, cancelamento de eco e ganho automático. Não equivale ao filtro Krisp do Discord.", { class: "rpgup-help" }),
      field("Perfil de tratamento", filterPreset, "O mestre escolhe o tratamento de áudio compartilhado. Voz limpa é o padrão; Reforçado ativa também portão de ruído e compressor."),
      filterGrid,
      field("Corte de ruídos graves", filterLowcut, "Filtro passa-altas: reduz vibrações e sons graves abaixo da frequência escolhida. Pode retirar corpo da voz."),
      filterNotice,
      element("p", "O navegador pode exigir permissão de microfone. Se usar fones, o cancelamento de eco geralmente continua seguro. O portão de ruído pode cortar o começo de frases; desligue se acontecer.", { class: "rpgup-help" })
    );
    const qualityHelp = element("p", QUALITY_PRESETS[quality.value].help, { class: "rpgup-help", role: "status" });
    quality.addEventListener("change", () => { qualityHelp.textContent = QUALITY_PRESETS[quality.value].help; });
    const intro = element("div", undefined, { class: "rpgup-intro" });
    intro.append(element("h2", "Configurar sala"), element("span", `${users.length} usuários · ${users.filter(user => savedConfig.slots?.[user.id]).length} slots salvos`, { class: "rpgup-badge" }));
    const roomFields = element("div", undefined, { class: "rpgup-grid" });
    roomFields.append(
      field("Nome da sala", room, "Nome da sala VDO usada por todos os participantes deste World. Use 1–49 letras ou números; maiúsculas fazem diferença. Mudar a Room exige reconectar e atualizar os links OBS."),
      field("Áudio", audio, "Discord desativa microfone e reprodução de áudio do VDO. Áudio VDO permite seus controles nativos. Todos precisam reconectar após mudar; evite ouvir a mesma voz pelos dois serviços."),
      field("Direção da transmissão", director, "Escolha um GM para usar o painel de direção no mesmo iframe. Ele começa em Scene Preview; Toggle Director Vision alterna cena/painel. A opção vazia mantém todos como participantes comuns."),
      field("Qualidade de vídeo", quality, "Escolha um limite para os vídeos da mesa. Automático mantém o VDO adaptativo. As opções avançadas têm prioridade sobre o preset. Todos precisam aplicar/reconectar após mudar."),
      field("Organização das câmeras", roomLayout, "Compacto usa cover nativo para preencher as áreas das câmeras, podendo recortar a imagem e o self-preview. Padrão não adiciona layout. Só afeta a Room, inclusive o preview do Director; links OBS não mudam. Salve e aplique/reconecte. Resultado visual depende da Room; parâmetros avançados continuam ativos.")
    );
    const advanced = element("div", undefined, { class: "rpgup-tab-section" });
    advanced.append(
      element("p", "Escolha as opções oficiais mais usadas e passe o mouse nos controles para ver o que fazem. O VDO.Ninja tem centenas de outras opções; algumas podem impedir a conexão, por isso o módulo permite apenas as listadas.", { class: "rpgup-help" }),
      createVDOOptionsEditor(extra),
      field("Parâmetros adicionais (editor manual)", extra, "Para usuários experientes: use chave=valor&chave2=valor2. Valores nesta linha são compartilhados com todos. O módulo valida e bloqueia parâmetros de conexão perigosos."),
      element("p", "O preset de qualidade é aplicado primeiro; os parâmetros manuais podem sobrescrevê-lo. Não edite Room, push, label, avatar, noaudio ou o código de bordas por aqui.", { class: "rpgup-help" })
    );
    const nativeDocs = element("a", "Consultar todas as opções oficiais do VDO.Ninja", { href: "https://docs.vdo.ninja/advanced-settings", target: "_blank", rel: "noopener noreferrer" });
    advanced.append(nativeDocs);
    const general = element("div", undefined, { class: "rpgup-tab-section" });
    general.append(
      intro,
      element("p", "Configuração compartilhada. O Room ID sugerido usa o nome deste mundo, mas você pode mudá-lo antes de salvar.", { class: "rpgup-help" }),
      roomFields, qualityHelp
    );
    const appearance = element("div", undefined, { class: "rpgup-tab-section" });
    const appearanceHelp = element("p", "", { class: "rpgup-help", role: "status" });
    const updateAppearanceHelp = () => {
      appearanceHelp.textContent = theme.value === "none"
        ? "Sem bordas ou CSS de tema; os nomes Foundry continuam visíveis por padrão."
        : (audio.value === "discord"
          ? "Bordas discretas usam as cores dos usuários Foundry. O Discord não informa quem está falando ao VDO, então a borda não pulsa nesse modo."
          : "Bordas discretas usam as cores dos usuários Foundry. No modo de áudio VDO, o medidor nativo destaca o jogador que fala.");
    };
    const preview = element("div", undefined, { class: "rpgup-camera-demo", "aria-label": "Prévia da câmera com tema selecionado" });
    const screen = element("div", undefined, { class: "rpgup-camera-demo-screen" });
    screen.append(
      element("i", undefined, { class: "fa-solid fa-user", "aria-hidden": "true" }),
      element("span", "PRÉVIA", { class: "rpgup-camera-demo-live" })
    );
    const cameraLabel = element("span", game.user.name || "Jogador Foundry", { class: "rpgup-camera-demo-name" });
    const previewMeter = element("div", undefined, { class: "rpgup-camera-demo-meter" });
    const frame = element("div", undefined, { class: "rpgup-camera-demo-frame" });
    frame.append(screen, cameraLabel, previewMeter);
    preview.append(frame);
    const speechTest = button("Simular fala", "fa-microphone-lines", { "aria-label": "Simular fala na prévia" });
    let simulatedSpeech = false;
    speechTest.addEventListener("click", () => {
      simulatedSpeech = !simulatedSpeech;
      frame.classList.toggle("rpgup-camera-demo-speaking", simulatedSpeech);
      speechTest.setAttribute("aria-pressed", String(simulatedSpeech));
    });
    tooltip(speechTest, "Demonstra apenas o efeito na prévia; numa chamada real, a indicação depende de áudio ativo no VDO.Ninja.");
    const previewNote = element("p", "Prévia local. Ela não liga a câmera nem altera a sala até você salvar.", { class: "rpgup-help" });
    const repaint = () => {
      const palette = themeVisual(theme.value, foundryUserColor(game.user));
      frame.style.border = palette.border;
      frame.style.borderRadius = palette.radius;
      frame.style.boxShadow = palette.shadow;
      frame.style.backgroundColor = palette.background;
      cameraLabel.style.backgroundColor = palette.label;
      screen.style.borderRadius = palette.radius;
      frame.dataset.theme = theme.value;
      speechTest.disabled = theme.value === "none" || audio.value !== "vdo";
      if (speechTest.disabled) {
        simulatedSpeech = false;
        frame.classList.remove("rpgup-camera-demo-speaking");
        speechTest.setAttribute("aria-pressed", "false");
      }
      previewNote.textContent = audio.value !== "vdo"
        ? "Prévia local; usando Discord, o VDO não sabe quem fala. Para testar o indicador, escolha Áudio nativo VDO na guia Sala."
        : "Simular fala demonstra o indicador nativo aproximado. A prévia não acessa o microfone.";
    };
    theme.addEventListener("change", () => { updateAppearanceHelp(); repaint(); });
    audio.addEventListener("change", () => { updateAppearanceHelp(); repaint(); });
    updateAppearanceHelp();
    repaint();
    appearance.append(
      field("Estilo das câmeras", theme, "Selecione um tema para todas as câmeras. Cada jogador mantém a cor escolhida no Foundry."),
      preview, speechTest, previewNote, appearanceHelp,
      element("p", "Nomes vêm automaticamente do Foundry. O VDO destaca a fala apenas com áudio nativo; no Discord esse recurso fica indisponível. As fontes solo OBS não são modificadas.", { class: "rpgup-help" })
    );
    const table = element("table");
    const head = element("tr");
    const columns = ["Jogador", "ID da câmera", "Imagem", "Link para OBS", "Link pessoal"];
    for (const label of columns) head.append(element("th", label, { scope: "col" }));
    const thead = element("thead");
    thead.append(head);
    const body = element("tbody");
    this._inputs = new Map();
    this._avatarInputs = new Map();
    for (const user of users) {
      const row = element("tr");
      const name = element("td", `${user.name}${user.isGM ? " (GM)" : ""}`);
      name.append(element("small", user.id));
      const role = element("span", user.active ? "No Foundry" : "Offline", { class: "rpgup-badge rpgup-presence" });
      tooltip(role, "Presença no Foundry. Não indica se a câmera está ligada ou se o VDO está conectado.");
      name.append(role);
      const slot = element("input", undefined, { maxlength: "64", pattern: "[A-Za-z0-9_]+", "aria-label": `Stream ID de ${user.name}` });
      tooltip(slot, "ID de publicação estável deste usuário: 1–64 letras, números ou underscore. Não deve se repetir. Gere os faltantes ou informe um ID; deixe vazio para desassociar. Salve para aplicar.");
      slot.value = config.slots[user.id] ?? "";
      this._inputs.set(user.id, slot);
      const slotCell = element("td");
      slotCell.append(slot);
      const avatar = element("input", undefined, { "aria-label": `Avatar da mesa de ${user.name}`, maxlength: "2048", placeholder: "Usar avatar Foundry" });
      avatar.value = config.avatars?.[user.id] ?? "";
      tooltip(avatar, "Imagem opcional definida pelo GM para esta mesa. Use caminho Foundry ou URL HTTPS; vazio usa a imagem do usuário Foundry. O jogador precisa aplicar/reconectar. A URL personalizada individual ainda tem prioridade.");
      this._avatarInputs.set(user.id, avatar);
      const avatarCell = element("td");
      avatarCell.append(avatar);
      const obsCell = element("td");
      try {
        const url = soloURL(savedConfig, user.id, users);
        const link = element("input", undefined, { readonly: "", "aria-label": `Solo link OBS de ${user.name}` });
        tooltip(link, "URL individual baseada na configuração salva. Cole numa Browser Source do OBS. Clique para selecionar; alterações não salvas ainda não aparecem neste link.");
        link.value = url;
        link.addEventListener("click", () => link.select());
        const copy = button("Copiar", "fa-copy", { "aria-label": `Copiar link OBS de ${user.name}` });
        tooltip(copy, "Copiar o solo link salvo deste usuário para usar no OBS.");
        copy.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(url);
            ui.notifications.info(`Solo link de ${user.name} copiado.`);
          } catch {
            link.focus();
            link.select();
            ui.notifications.warn("Clipboard indisponível. Use Ctrl+C no link selecionado.");
          }
        });
        const obsField = element("div", undefined, { class: "rpgup-copy-link" });
        obsField.append(link, copy);
        obsCell.append(obsField);
      } catch {
        obsCell.textContent = "Configure a Room e salve o slot para gerar o link.";
      }
      const joinCell = element("td");
      try {
        // This is a publisher link, NOT the viewer-only solo link for OBS.
        // It must use the saved configuration so the same Stream ID is never silently changed.
        participantURL(savedConfig, user, {}, users, location.href, null);
        const joinField = element("div", undefined, { class: "rpgup-copy-link" });
        const joinLink = element("input", undefined, {
          readonly: "", "aria-label": `Link de entrada no navegador de ${user.name}`,
          placeholder: "Preparando link…"
        });
        joinLink.addEventListener("click", () => joinLink.select());
        const joinCopy = button("Copiar", "fa-copy", { "aria-label": `Copiar link de entrada de ${user.name}` });
        joinCopy.disabled = true;
        joinField.append(joinLink, joinCopy);
        joinCell.append(joinField);
        pendingJoinLinks.push(async () => {
          // Respect this user's placeholder preference, then the GM's table avatar,
          // then the Foundry avatar. Embed a small raster so VDO works without Foundry login/CORS.
          let prefs = normalizePrefs();
          try { prefs = normalizePrefs(user.getFlag?.(MODULE_ID, "preferences") ?? {}); } catch { /* User flags unavailable to GM: use Foundry/avatar defaults. */ }
          let preparedAvatar = "default";
          let avatarError = "";
          try {
            const avatarUser = { avatar: savedConfig.avatars?.[user.id] || user.avatar };
            const budget = avatarURLBudget(savedConfig, user, prefs, users, location.href);
            preparedAvatar = (await prepareAvatar(avatarUser, prefs, {
              signal: linksAbort.signal, baseURL: location.href, maxEncodedLength: budget
            })).value;
          } catch (error) {
            if (linksAbort.signal.aborted) return;
            avatarError = error.message;
          }
          if (linksAbort.signal.aborted || this._form !== form) return;
          const url = participantURL(savedConfig, user, prefs, users, location.href, preparedAvatar);
          joinLink.value = url;
          joinCopy.disabled = false;
          tooltip(joinLink, "Entrada externa com nome, Stream ID e Room salvos. Compartilhe apenas com este jogador e feche a dock embutida para não publicar duas vezes.");
          tooltip(joinCopy, "Copiar link de entrada externa. Contém o acesso à sala; envie somente ao jogador correspondente.");
          joinCopy.addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(url);
              ui.notifications.info(`Link de entrada de ${user.name} copiado.`);
            } catch {
              joinLink.focus();
              joinLink.select();
              ui.notifications.warn("Clipboard indisponível. Use Ctrl+C no link selecionado.");
            }
          }, { signal: linksAbort.signal });
          if (avatarError) {
            joinCell.append(element("small", "Avatar não carregado: link usa o avatar padrão VDO.", { class: "rpgup-link-warning" }));
            tooltip(joinCell.lastElementChild, avatarError);
          }
        });
      } catch {
        joinCell.textContent = "Configure a Room e salve o slot para gerar o link.";
      }
      [name, slotCell, avatarCell, obsCell, joinCell].forEach((cell, index) => { cell.dataset.label = columns[index]; });
      row.append(name, slotCell, avatarCell, obsCell, joinCell);
      body.append(row);
    }
    table.append(thead, body);
    // Never block the GM panel while avatars are prepared for external browser links.
    void Promise.allSettled(pendingJoinLinks.map(start => start()));
    const generate = button("Criar IDs faltantes", "fa-wand-magic-sparkles");
    tooltip(generate, "Criar IDs somente para usuários que ainda não têm slot e salvar a Room e as associações no World. IDs existentes são preservados.");
    generate.addEventListener("click", async () => {
      if (this._saving) return;
      // A player may have been created after this panel opened.
      await this._refreshView();
      const slots = { ...config.slots };
      for (const [userId, input] of this._inputs) slots[userId] = input.value.trim();
      const filled = fillMissingSlots(slots, Array.from(game.users));
      for (const [userId, input] of this._inputs) input.value = filled[userId];
      this._notice.textContent = "Salvando os slots no mundo…";
      try { await this.saveDraft(); } catch (error) { this._notice.textContent = `Não salvo: ${error.message}`; report(error); }
    });
    const save = button("Salvar mudanças", "fa-check", { type: "submit", class: "rpgup-primary" });
    tooltip(save, "Salvar Room, áudio, Director e IDs no World. Usuários aguardando um ID entram na sala; quem já está conectado precisa aplicar/reconectar.");
    const obsNotice = element("p", "Links OBS e links externos usam os valores salvos. Após salvar mudanças de Room, senha ou Stream ID, copie novamente os links.", { role: "status", class: "rpgup-save-status" });
    this._notice = obsNotice;
    form.addEventListener("input", event => {
      if (event.target.closest(".rpgup-personal-settings")) return;
      obsNotice.textContent = "Há alterações não salvas. Os links OBS e de entrada externa acima ainda correspondem à configuração anterior; salve para atualizar.";
    });
    const exportLinks = tooltip(button("Exportar links OBS", "fa-download"), "Baixar JSON organizado com nome, ID e solo link de cada usuário associado na configuração salva. É uma lista de URLs para Browser Sources, não uma coleção de cenas OBS.");
    exportLinks.addEventListener("click", () => {
      try {
        const value = obsExport(worldConfig(), Array.from(game.users));
        if (!value.sources.length) throw new Error("Salve ao menos um slot para exportar os links OBS.");
        downloadJSON(value, `rpgup-obs-${value.roomId}.json`);
      } catch (error) { report(error); }
    });
    const participantActions = element("div", undefined, { class: "rpgup-actions" });
    participantActions.append(generate, exportLinks);
    const tableWrap = element("div", undefined, { class: "rpgup-table-wrap" });
    tableWrap.append(table);
    const footer = element("footer", undefined, { class: "rpgup-config-footer" });
    footer.append(obsNotice, save);
    const participants = element("div", undefined, { class: "rpgup-tab-section" });
    participants.append(
      element("p", "Gere somente os IDs que faltam. Links externos são individuais: envie ao jogador certo e peça para fechar a dock embutida. Links podem conter senha.", { class: "rpgup-help" }),
      participantActions, tableWrap
    );
    const help = element("div", undefined, { class: "rpgup-tab-section" });
    help.append(
      element("p", "Primeiro escolha a sala e salve; depois gere os IDs faltantes na guia de participantes. Para entrar na chamada, use a guia Conexão desta janela.", { class: "rpgup-help" }),
      element("p", "Solo link OBS é só para o OBS visualizar uma câmera. Entrar pelo navegador publica a câmera do jogador usando o ID estável; envie esse link somente a ele.", { class: "rpgup-help" }),
      element("p", "Discord mantém o áudio fora do VDO. O GM pode ativar o Director e controlar a cena na própria interface do VDO.Ninja.", { class: "rpgup-help" })
    );
    const personal = createPersonalTabs();
    const personalKeys = new Set(personal.tabs.map(tab => tab.key));
    const tabs = createIconTabs({
      id: "rpgup-world", label: "Configurações da mesa e da chamada",
      initial: this._selectedTab ?? "general",
      onChange: tab => {
        this._selectedTab = tab;
        footer.hidden = personalKeys.has(tab);
      },
      tabs: [
        { key: "general", title: "Sala", group: "Mesa", icon: "fa-house", children: [general] },
        { key: "participants", title: "Participantes", group: "Mesa", icon: "fa-users", children: [participants] },
        { key: "appearance", title: "Visual", group: "Mesa", icon: "fa-palette", children: [appearance] },
        { key: "audioFilters", title: "Filtro de áudio", group: "Avançado", icon: "fa-headphones", children: [audioFiltersPanel] },
        { key: "advanced", title: "Opções VDO", group: "Avançado", icon: "fa-sliders", children: [advanced] },
        { key: "help", title: "Ajuda", group: "Avançado", icon: "fa-circle-question", children: [help] },
        ...personal.tabs
      ],
      tourSteps: [
        { tab: "general", target: () => room, text: "A sala é sugerida a partir do nome do mundo. Você pode editar o ID antes de salvar." },
        { tab: "general", target: () => audio, text: "Selecione Discord para manter o áudio fora do VDO ou ative o áudio nativo." },
        { tab: "general", target: () => roomLayout, text: "Escolha o layout das câmeras. Compacto preenche os espaços e pode recortar imagens." },
        { tab: "participants", target: () => generate, text: "Gere e salve somente os IDs dos jogadores que ainda não têm um." },
        { tab: "participants", target: () => tableWrap, text: "Aqui ficam o link OBS de visualização e o link para entrar diretamente no navegador." },
        { tab: "appearance", target: () => theme, text: "O mestre escolhe o tema ou Sem bordas. A cor principal de cada câmera usa a cor configurada pelo respectivo usuário Foundry." },
        { tab: "audioFilters", target: () => filterPreset, text: "O perfil Voz limpa usa os filtros de microfone oficiais do VDO. Escolha Personalizado para ajustar cada filtro." },
        { tab: "advanced", target: () => extra, text: "Parâmetros extras são opcionais. Use apenas se sua mesa realmente precisar." },
        { tab: "help", target: () => help, text: "Consulte esta ajuda quando quiser lembrar a diferença entre OBS e entrada externa." },
        { tab: "general", target: () => save, text: "Salve as mudanças. Depois use Aplicar / reconectar na guia Conexão." },
        ...personal.tourSteps
      ]
    });
    form.append(tabs.root, footer);
    this._readDraft = () => {
      const slots = { ...config.slots };
      for (const [userId, input] of this._inputs) {
        const value = input.value.trim();
        if (value) slots[userId] = value;
        else delete slots[userId];
      }
      const avatars = { ...(config.avatars ?? {}) };
      for (const [userId, input] of this._avatarInputs) {
        const value = input.value.trim();
        if (value) avatars[userId] = value;
        else delete avatars[userId];
      }
      return {
        roomId: room.value.trim(), extraQuery: extra.value.trim(), audio: audio.value,
        audioFilters: validateAudioFilters({
          preset: filterPreset.value,
          ...Object.fromEntries(Array.from(filterControls, ([key, control]) => [key, control.checked])),
          lowcutHz: Number(filterLowcut.value)
        }),
        directorUserId: director.value, slots, quality: quality.value, avatars,
        roomLayout: roomLayout.value, theme: theme.value
      };
    };
    this._saveDraft = async () => {
      if (JSON.stringify(worldConfig()) !== JSON.stringify(this._baseConfig)) throw new Error("Outro GM alterou a configuração. Feche e reabra o painel antes de salvar.");
      const next = validateWorld(this._readDraft(), Array.from(game.users));
      this._saving = true;
      save.disabled = generate.disabled = true;
      try {
        this._baseConfig = await saveWorld(next);
        this._form = null;
        ui.notifications.info("Room e slots confirmados no mundo. Jogadores sem sala entram automaticamente; participantes conectados podem reconectar.");
        await this._refreshView();
      } finally {
        this._saving = false;
        save.disabled = generate.disabled = false;
      }
    };
    form.addEventListener("submit", async event => {
      event.preventDefault();
      try { await this.saveDraft(); } catch (error) { obsNotice.textContent = `Não salvo: ${error.message}`; report(error); }
    });
    return form;
  }

  async _refreshView() {
    if (this._sidebarHost?.isConnected) {
      const form = await this._renderHTML();
      this._sidebarHost.replaceChildren(form);
    } else if (this.rendered) await this.render({ force: true });
  }

  _replaceHTML(result, content) {
    if (!content.contains(result)) content.replaceChildren(result);
  }

  get dirty() {
    if (!game.user.isGM || !this._form) return false;
    const base = { ...this._baseConfig, quality: this._baseConfig.quality ?? "native", avatars: this._baseConfig.avatars ?? {}, roomLayout: this._baseConfig.roomLayout ?? "native", theme: this._baseConfig.theme ?? "modern", audioFilters: validateAudioFilters(this._baseConfig.audioFilters) };
    return JSON.stringify(this._readDraft()) !== JSON.stringify(base);
  }

  async saveDraft() {
    if (!game.user.isGM) throw new Error("Somente o GM pode salvar configurações.");
    if (this._savePromise) return this._savePromise;
    this._savePromise = this._saveDraft();
    try { await this._savePromise; } finally { this._savePromise = null; }
  }

  configChanged() {
    if (!this._form || this._saving) return;
    if (this.dirty) {
      this._notice.textContent = "A configuração salva mudou. Seu rascunho foi preservado; feche e reabra para usar os dados atuais.";
      return;
    }
    this._form = null;
    this._refreshView().catch(report);
  }

  refreshUsers() {
    if (this._form) this._refreshView().catch(report);
  }

  _onClose(options) {
    super._onClose(options);
    this._linksAbort?.abort();
    this._linksAbort = null;
    this._sidebarHost = null;
    this._form = this._readDraft = this._saveDraft = null;
  }
}

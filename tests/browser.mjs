import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Optional development-only dependency; never ships with the Foundry module.
const { chromium } = await import(process.env.PLAYWRIGHT_PACKAGE ? pathToFileURL(process.env.PLAYWRIGHT_PACKAGE).href : "playwright");
const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const mime = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".css": "text/css" };
const avatarSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#285b8a"/><circle cx="256" cy="256" r="190" fill="#e9b35a"/></svg>';
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (pathname === "/tests/users/avatar-gm.webp") {
      response.setHeader("Content-Type", "image/svg+xml");
      response.end(avatarSVG); // No CORS header, like the user's Foundry assets.
      return;
    }
    const file = path.resolve(root, "." + pathname);
    if (!file.startsWith(root + path.sep) && file !== root) throw new Error("Path outside fixture");
    response.setHeader("Content-Type", mime[path.extname(file)] ?? "text/plain");
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
let navigations = 0;
const screenshotDirectory = path.join(root, "test-results");
await mkdir(screenshotDirectory, { recursive: true });
async function openSettings(page) {
  if (await page.locator("#rpgup-vdo-world-config").count()) return;
  await page.evaluate(() => game.modules.get("rpgup-vdo-ninja").api.toggleOptions());
  await page.locator("#rpgup-vdo-world-config").waitFor({ state: "visible" });
}
async function dockTab(page, key) {
  await openSettings(page);
  const tab = page.locator(`#rpgup-world-tab-${key}`);
  if (!await tab.isVisible()) {
    await page.getByRole("button", { name: "Minha câmera", exact: true }).click();
  }
  await tab.click();
}
async function worldTab(page, key) {
  await openSettings(page);
  const tab = page.locator(`#rpgup-world-tab-${key}`);
  if (!await tab.isVisible()) {
    const group = ["general", "participants", "appearance"].includes(key) ? "Mesa" : "Avançado";
    await page.getByRole("button", { name: group, exact: true }).click();
  }
  await tab.click();
}
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  console.log(`Chromium ${browser.version()}; ApplicationV2 fixture; VDO iframe interceptado, sem câmera/rede de mídia.`);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route("https://images.example/**", route => route.fulfill({ contentType: "image/svg+xml", headers: { "Access-Control-Allow-Origin": "*" }, body: avatarSVG.replace("#e9b35a", "#eb4747") }));
  await context.route("https://vdo.ninja/**", route => {
    navigations++;
    return route.fulfill({ contentType: "text/html", body: "<title>VDO fixture</title><p>Iframe controlado, sem mídia</p>" });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/tests/harness.html");
  await page.waitForFunction(() => globalThis.fixtureReady && document.querySelector("iframe"));
  assert.equal(await page.locator("#rpgup-vdo-world-config").count(), 0);
  assert.equal(await page.locator("#rpgup-vdo-room").getAttribute("data-dock"), "left", "Novo usuário começa com dock à esquerda");
  assert.equal(await page.locator(".window-header [data-action=toggleModuleSettings]").count(), 1);
  assert.equal(await page.locator(".window-header [data-action=undock]").count(), 1);
  assert.equal(await page.locator(".window-header [data-action=reloadRoom]").count(), 1);
  assert.equal(await page.locator("#rpgup-vdo-room > .window-header").isVisible(), false, "Dock não mostra barra de título");
  assert.equal(await page.locator(".rpgup-vdo-quick-controls").count(), 0, "Não inserir engrenagem no canvas");
  assert.equal(await page.getByRole("button", { name: "Opções VDO.Ninja", exact: true }).count(), 1, "Segundo botão na aba Configurações");
  assert.equal(await page.locator(".rpgup-open-dock").getAttribute("aria-pressed"), "true", "Dock inicia aberta");
  const closedHost = await page.locator(".rpgup-frame-host").boundingBox();
  assert.ok(closedHost.height >= 560, "Controles escondidos deixam a sala ocupar toda a janela");
  const initialLoads = navigations;
  const roomBeforeReload = await page.locator("iframe").getAttribute("src");
  await page.evaluate(() => { globalThis.sameWorld = true; globalThis.originalFrame = document.querySelector("iframe"); });
  await openSettings(page);
  await dockTab(page, "connect");
  await page.getByRole("button", { name: "Recarregar sala VDO", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("iframe").contentWindow !== null);
  await page.locator("iframe").contentFrame().locator("p").waitFor();
  assert.equal(navigations, initialLoads + 1, "Reload navega só o iframe uma vez");
  assert.equal(await page.locator("iframe").getAttribute("src"), roomBeforeReload);
  assert.equal(await page.evaluate(() => sameWorld && originalFrame === document.querySelector("iframe")), true);
  assert.equal(await page.locator(".window-header [data-action=toggleModuleSettings]").innerText(), "");
  await page.locator("iframe").contentFrame().locator("p").waitFor();
  assert.equal(await page.locator("iframe").count(), 1);
  assert.equal(await page.locator('#rpgup-world-tab-connect').getAttribute("aria-selected"), "true");
  assert.equal(await page.locator('#rpgup-world-tab-window').innerText(), "", "Guias usam apenas ícones");
  assert.equal(await page.locator('#rpgup-vdo-world-config [role="tab"][aria-selected="true"]').count(), 1);
  await page.locator("#rpgup-vdo-world-config [aria-label='Iniciar tour guiado']").click();
  assert.match(await page.locator("#rpgup-vdo-world-config .rpgup-tour").innerText(), /sala/i);
  await page.locator("#rpgup-vdo-world-config .rpgup-tour-next").click();
  await page.locator("#rpgup-vdo-world-config .rpgup-tour-close").click();
  assert.equal(await page.locator("#rpgup-vdo-world-config .rpgup-tour").isVisible(), false);
  await page.screenshot({ path: path.join(screenshotDirectory, "dock-settings-desktop.png") });
  const initial = navigations;
  const initialURL = await page.locator("iframe").getAttribute("src");
  assert.equal(new URL(initialURL).searchParams.has("hideheader"), true, "VDO.Ninja não mostra a linha You are in room");
  assert.equal(new URL(initialURL).searchParams.get("push"), "slot_gm");
  assert.equal(new URL(initialURL).searchParams.get("showlabels"), "rounded");
  const initialCSS = decodeURIComponent(atob(new URL(initialURL).searchParams.get("base64css")));
  assert.match(initialCSS, /#d3a45a/);
  assert.match(initialCSS, /#3399cc/);
  assert.doesNotMatch(initialCSS, /data-speaking/, "Discord does not provide VDO voice activity");
  assert.ok(new URL(initialURL).searchParams.get("avatar").startsWith("data:image/webp;base64,"), "Avatar sem CORS vira uma imagem autossuficiente");
  assert.ok(new URL(initialURL).searchParams.get("avatar")?.startsWith("data:image/webp;base64,"), "Mesmo com limite de URL, avatar deve continuar embutido");
  const preparedDimensions = await page.evaluate(async src => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, new URL(initialURL).searchParams.get("avatar"));
  assert.ok(preparedDimensions[0] >= 384 && preparedDimensions[1] >= 384, "Avatar de alta resolução não pode encolher indevidamente");
  assert.ok(initialURL.length <= 6900, "Nunca enviar request URI grande o bastante para o nginx responder 414");
  assert.equal(await page.locator('[name="Câmera padrão"], [name="Interface VDO"], [name="Self-preview"]').count(), 0);
  await dockTab(page, "window");
  assert.match(await page.locator('.rpgup-personal-window .rpgup-field:has(input[type="checkbox"]) .rpgup-info-icon').getAttribute("title"), /não liga sua câmera/i);
  await dockTab(page, "avatar");
  assert.match(await page.locator('.rpgup-personal-avatar .rpgup-field:has(select[name="Placeholder"]) .rpgup-info-icon').getAttribute("data-tooltip"), /cada sessão/);
  await dockTab(page, "window");
  assert.equal((await page.locator("iframe").getAttribute("allow")).includes("microphone"), false);
  assert.equal(await page.locator("iframe").getAttribute("sandbox"), null);
  for (const dock of ["left", "right", "top", "bottom", "floating"]) {
    await page.getByRole("combobox", { name: "Posição do dock", exact: true }).selectOption(dock);
    const geometry = await page.locator("#rpgup-vdo-room").boundingBox();
    assert.ok(geometry.width >= 320 && geometry.height >= 240);
    assert.ok(geometry.x >= 0 && geometry.y >= 0 && geometry.x + geometry.width <= 1440 && geometry.y + geometry.height <= 900);
    const iface = await page.locator("#interface").boundingBox();
    if (dock === "left") {
      assert.equal(geometry.x, 0);
      assert.equal(geometry.y, 0);
      assert.equal(geometry.height, 900);
      assert.ok(iface.x >= geometry.x + geometry.width, "Canvas após dock esquerda");
    }
    if (dock === "right") {
      assert.equal(geometry.x + geometry.width, 1440);
      assert.equal(geometry.y, 0);
      assert.equal(geometry.height, 900);
      assert.ok(iface.x + iface.width <= geometry.x);
    }
    if (dock === "top") {
      assert.equal(geometry.x, 0);
      assert.equal(geometry.y, 0);
      assert.equal(geometry.width, 1440);
      assert.ok(iface.y >= geometry.y + geometry.height);
    }
    if (dock === "bottom") {
      assert.equal(geometry.x, 0);
      assert.equal(geometry.y + geometry.height, 900);
      assert.equal(geometry.width, 1440);
      assert.ok(iface.y + iface.height <= geometry.y);
    }
    if (dock === "floating") assert.equal(iface.width, 1440);
  }
  await page.evaluate(async () => { await game.modules.get("rpgup-vdo-ninja").api.openDock(); await game.modules.get("rpgup-vdo-ninja").api.openDock(); });
  assert.equal(await page.locator("iframe").count(), 1);
  assert.equal(navigations, initial, "Dock/rerender não deve navegar ou recriar o iframe");
  assert.ok(await page.evaluate(async () => (await fixture.dock()).frontCount >= 3), "Reabrir chama bringToFront sem recarregar a sala");
  await page.getByRole("combobox", { name: "Posição do dock", exact: true }).selectOption("left");
  await page.getByRole("combobox", { name: "Posição do dock", exact: true }).selectOption("floating");
  assert.equal(await page.locator("#rpgup-vdo-room > .window-header").isVisible(), true, "Janela flutuante recupera cabeçalho");
  assert.equal(await page.locator(".rpgup-vdo-quick-controls").count(), 0);
  assert.equal(await page.getByRole("combobox", { name: "Posição do dock", exact: true }).inputValue(), "floating");
  assert.equal(navigations, initial, "Desacoplar não deve recarregar a sala");
  await page.getByRole("button", { name: "Diminuir zoom", exact: true }).click();
  await page.getByRole("button", { name: "Diminuir zoom", exact: true }).click();
  assert.equal(await page.locator("iframe").evaluate(node => node.style.transform), "scale(0.8)");
  assert.equal(navigations, initial, "Zoom não deve recarregar a sala");
  await dockTab(page, "avatar");
  await page.getByRole("combobox", { name: "Placeholder", exact: true }).selectOption("custom");
  await page.getByRole("textbox", { name: "URL do placeholder", exact: true }).fill("https://images.example/avatar.webp");
  assert.equal(await page.locator("iframe").getAttribute("src"), initialURL);
  await dockTab(page, "connect");
  await page.getByRole("button", { name: "Aplicar / reconectar", exact: true }).click();
  await page.waitForFunction(previous => document.querySelector("iframe").src !== previous, initialURL);
  await page.locator("iframe").contentFrame().locator("p").waitFor();
  assert.equal(new URL(await page.locator("iframe").getAttribute("src")).searchParams.has("view"), false);
  await worldTab(page, "general");
  await page.locator(".rpgup-config-form").waitFor();
  assert.equal(await page.locator("#rpgup-world-tab-general").getAttribute("aria-selected"), "true");
  await worldTab(page, "appearance");
  assert.equal(await page.getByRole("combobox", { name: "theme" }).inputValue(), "modern");
  assert.equal(await page.locator(".rpgup-camera-demo-frame").count(), 1, "Theme picker previews a sample camera");
  await page.getByRole("combobox", { name: "theme" }).selectOption("scifi");
  const glow = await page.locator(".rpgup-camera-demo-frame").evaluate(node => getComputedStyle(node).boxShadow);
  assert.notEqual(glow, "none", "Sci-fi glow must be visible");
  assert.match(glow, /rgb/);
  await page.screenshot({ path: path.join(screenshotDirectory, "theme-scifi-preview.png") });
  assert.equal(await page.getByRole("button", { name: "Simular fala na prévia" }).isDisabled(), true, "Discord cannot detect VDO speech");
  for (const value of ["scifi", "neon", "rustic", "fantasy", "none", "modern"]) {
    await page.getByRole("combobox", { name: "theme" }).selectOption(value);
  }
  assert.match(await page.locator("#rpgup-world-pane-appearance").innerText(), /Discord não informa/);
  await worldTab(page, "advanced");
  await page.getByRole("combobox", { name: "vdoOption" }).selectOption("codec");
  assert.match(await page.locator(".rpgup-option-editor .rpgup-help").innerText(), /Codec|codec/);
  await page.getByRole("combobox", { name: "vdoOptionChoice" }).selectOption("vp9");
  await page.getByRole("button", { name: "Adicionar parâmetro VDO" }).click();
  assert.match(await page.locator('input[name="extraQuery"]').inputValue(), /codec=vp9/);
  assert.equal((await page.evaluate(() => fixture.config())).extraQuery, "password=Fixture123", "Options editor does not auto-save");
  await page.getByRole("button", { name: "Remover parâmetro codec" }).click();
  assert.equal(await page.locator('input[name="extraQuery"]').inputValue(), "password=Fixture123");
  await worldTab(page, "appearance");
  assert.equal(await page.getByRole("button", { name: "Simular fala na prévia" }).isDisabled(), true);
  await worldTab(page, "audioFilters");
  // Theme V2 regression: the same AppV2 must be legible in Light and Dark,
  // including the audio filters tab, active icons, select menus and footer.
  const mediaURLBeforeThemeCheck = await page.locator("iframe").getAttribute("src");
  for (const mode of ["light", "dark"]) {
    await page.evaluate(value => document.body.classList.toggle("theme-light", value === "light"), mode);
    const visual = await page.evaluate(() => {
      const get = selector => getComputedStyle(document.querySelector(selector));
      const app = get("#rpgup-vdo-world-config");
      const tab = get("#rpgup-world-tab-audioFilters");
      const nav = get("#rpgup-vdo-world-config .rpgup-tab-bar");
      const select = get('select[name="audioFilterPreset"]');
      const footer = get("#rpgup-vdo-world-config .rpgup-config-footer");
      const help = get("#rpgup-world-pane-audioFilters .rpgup-help");
      const label = get("#rpgup-world-pane-audioFilters .rpgup-audio-filter-toggle > span");
      const parse = color => {
        const parts = color.match(/[\d.]+/g)?.map(Number) ?? [];
        return parts.slice(0, 3).map(x => {
          const v = x / 255;
          return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
        });
      };
      const luminance = color => parse(color).reduce((sum, value, index) => sum + value * [.2126,.7152,.0722][index], 0);
      const contrast = (fg,bg) => {
        const a=luminance(fg), b=luminance(bg);
        return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      };
      return {
        text: app.color, tabColor: tab.color, tabBg: tab.backgroundColor,
        navBg: nav.backgroundColor, selectColor: select.color, selectBg: select.backgroundColor,
        selectScheme: select.colorScheme, footerBg: footer.backgroundColor, footerColor: footer.color,
        helpColor: help.color, labelColor: label.color,
        contrastSelect: contrast(select.color, select.backgroundColor),
        contrastTab: contrast(tab.color, tab.backgroundColor),
        contrastFooter: contrast(footer.color, footer.backgroundColor)
      };
    });
    assert.ok(visual.contrastSelect >= 4.5, `${mode}: dropdown text contrast, ${JSON.stringify(visual)}`);
    assert.ok(visual.contrastTab >= 4.5, `${mode}: selected icon contrast, ${JSON.stringify(visual)}`);
    assert.ok(visual.contrastFooter >= 4.5, `${mode}: footer text contrast, ${JSON.stringify(visual)}`);
    assert.equal(visual.selectScheme, mode, `${mode}: native dropdown must match Foundry theme`);
    assert.equal(visual.navBg, visual.footerBg, `${mode}: tabs and footer share theme background`);
    assert.equal(visual.labelColor, visual.text, `${mode}: audio labels inherit window text`);
    await page.screenshot({ path: path.join(screenshotDirectory, `audio-filters-${mode}.png`) });
    if (mode === "light") {
      await worldTab(page, "participants");
      await page.screenshot({ path: path.join(screenshotDirectory, "participants-light.png") });
      await worldTab(page, "appearance");
      await page.screenshot({ path: path.join(screenshotDirectory, "appearance-light.png") });
      await worldTab(page, "advanced");
      await page.screenshot({ path: path.join(screenshotDirectory, "advanced-light.png") });
      await worldTab(page, "audioFilters");
    }
  }
  assert.equal(await page.locator("iframe").getAttribute("src"), mediaURLBeforeThemeCheck, "Theme switch must not reconnect media");
  assert.equal(await page.evaluate(() => fixture.config().audio), "discord", "Theme check must not edit world settings");
  assert.equal(await page.getByRole("combobox", { name: "audioFilterPreset" }).inputValue(), "voice", "Legacy worlds start with safe voice preset");
  assert.match(await page.locator("#rpgup-world-pane-audioFilters").innerText(), /Discord/);
  assert.equal(await page.locator('input[name="filter_denoise"]').isChecked(), true);
  assert.equal(await page.locator('input[name="filter_noiseGate"]').isChecked(), false);
  await page.getByRole("combobox", { name: "audioFilterPreset" }).selectOption("enhanced");
  assert.equal(await page.locator('input[name="filter_noiseGate"]').isChecked(), true);
  await page.getByRole("combobox", { name: "audioFilterPreset" }).selectOption("custom");
  await page.locator('input[name="filter_noiseGate"]').uncheck();
  assert.equal((await page.evaluate(() => fixture.config())).audioFilters.preset, "voice", "Audio changes do not auto-save");
  await page.getByRole("combobox", { name: "audioFilterPreset" }).selectOption("voice");
  await worldTab(page, "general");
  await page.locator("#rpgup-vdo-world-config [aria-label='Iniciar tour guiado']").click();
  assert.match(await page.locator("#rpgup-vdo-world-config .rpgup-tour").innerText(), /sala/i);
  await page.locator("#rpgup-vdo-world-config .rpgup-tour-close").click();
  await worldTab(page, "participants");
  await page.getByRole("textbox", { name: "Stream ID de Jogador A", exact: true }).fill("draft_reload");
  const beforeDraftReload = await page.locator("iframe").getAttribute("src");
  await page.evaluate(() => document.querySelector('[data-action="reloadRoom"]').click());
  await page.locator("iframe").contentFrame().locator("p").waitFor();
  assert.equal((await page.evaluate(() => fixture.config().slots)).p1, "slot_a");
  assert.equal(await page.getByRole("textbox", { name: "Stream ID de Jogador A", exact: true }).inputValue(), "draft_reload");
  assert.equal(await page.locator("iframe").getAttribute("src"), beforeDraftReload);
  await page.getByRole("textbox", { name: "Stream ID de Jogador A", exact: true }).fill("slot_a");
  await worldTab(page, "general");
  assert.match(await page.locator('.rpgup-field:has(select[name="directorUserId"]) .rpgup-info-icon').getAttribute("data-tooltip"), /Scene Preview/);
  await worldTab(page, "participants");
  assert.equal(await page.getByRole("textbox", { name: "Solo link OBS", exact: false }).count(), 3);
  await page.waitForFunction(() => document.querySelector('input[aria-label="Link de entrada no navegador de Jogador A"]')?.value.startsWith("https://vdo.ninja/"));
  const browserJoin = new URL(await page.getByRole("textbox", { name: "Link de entrada no navegador de Jogador A" }).inputValue());
  assert.equal(browserJoin.searchParams.get("room"), "FixtureRoom123");
  assert.equal(browserJoin.searchParams.get("push"), "slot_a");
  assert.equal(browserJoin.searchParams.get("label"), "Jogador A");
  assert.equal(browserJoin.searchParams.get("password"), "Fixture123");
  assert.equal(browserJoin.searchParams.has("view"), false, "Link de jogador publica, não é viewer OBS");
  assert.equal(browserJoin.searchParams.get("avatar"), "default", "Jogador sem avatar usa placeholder padrão");
  assert.equal(await page.getByRole("button", { name: "Copiar link de entrada de Jogador A" }).isEnabled(), true);
  await worldTab(page, "general");
  await page.getByRole("combobox", { name: "audio", exact: true }).selectOption("vdo");
  await worldTab(page, "audioFilters");
  assert.match(await page.locator("#rpgup-world-pane-audioFilters").innerText(), /microfone do VDO/);
  await page.getByRole("combobox", { name: "audioFilterPreset" }).selectOption("enhanced");
  await worldTab(page, "appearance");
  const talking = page.getByRole("button", { name: "Simular fala na prévia" });
  assert.equal(await talking.isEnabled(), true);
  await talking.click();
  assert.equal(await page.locator(".rpgup-camera-demo-frame").getAttribute("class"), "rpgup-camera-demo-frame rpgup-camera-demo-speaking");
  await talking.click();
  await worldTab(page, "general");
  await page.getByRole("combobox", { name: "directorUserId", exact: true }).selectOption("gm1");
  await page.getByRole("combobox", { name: "quality", exact: true }).selectOption("economy");
  assert.equal(await page.getByRole("combobox", { name: "roomLayout", exact: true }).inputValue(), "native");
  await page.getByRole("combobox", { name: "roomLayout", exact: true }).selectOption("compact");
  await worldTab(page, "participants");
  await page.getByRole("textbox", { name: "Avatar da mesa de Jogador A", exact: true }).fill("/tests/users/avatar-gm.webp");
  await page.getByRole("button", { name: "Salvar mudanças", exact: true }).click();
  await page.waitForFunction(() => fixture.config().audio === "vdo");
  assert.equal((await page.evaluate(() => fixture.config())).quality, "economy");
  assert.equal((await page.evaluate(() => fixture.config())).audioFilters.preset, "enhanced");
  assert.equal((await page.evaluate(() => fixture.config())).roomLayout, "compact");
  await worldTab(page, "general");
  assert.equal(await page.getByRole("combobox", { name: "roomLayout", exact: true }).inputValue(), "compact");
  await worldTab(page, "participants");
  await page.waitForFunction(() => {
    const input = document.querySelector('input[aria-label="Link de entrada no navegador de Jogador A"]');
    return input?.value && new URL(input.value).searchParams.get("avatar")?.startsWith("data:image/");
  });
  const updatedJoin = new URL(await page.getByRole("textbox", { name: "Link de entrada no navegador de Jogador A" }).inputValue());
  assert.equal(updatedJoin.searchParams.get("push"), "slot_a", "Link externo preserva Stream ID");
  assert.equal(updatedJoin.searchParams.get("label"), "Jogador A");
  assert.equal(updatedJoin.searchParams.has("noaudio"), false, "Link externo segue áudio VDO configurado");
  assert.equal(updatedJoin.searchParams.get("denoise"), "1");
  assert.equal(updatedJoin.searchParams.get("noisegate"), "1");
  assert.equal(updatedJoin.searchParams.get("lowcut"), "100");
  assert.ok(updatedJoin.href.length <= 6900);
  assert.ok(updatedJoin.searchParams.get("avatar").startsWith("data:image/"), "Avatar Foundry da mesa incorporado funciona no navegador externo");
  const obsDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar links OBS", exact: true }).click();
  const downloadedLinks = await obsDownload;
  const exportedLinks = JSON.parse(await readFile(await downloadedLinks.path(), "utf8"));
  assert.equal(exportedLinks.sources.length, 3);
  assert.equal(exportedLinks.sources.find(source => source.userId === "p1").streamId, "slot_a");
  assert.equal(new URL(exportedLinks.sources[0].url).searchParams.has("maxframerate"), false);
  for (const source of exportedLinks.sources) {
    assert.equal(new URL(source.url).searchParams.has("cover"), false);
    assert.equal(new URL(source.url).searchParams.has("structure"), false);
  }
  await page.screenshot({ path: path.join(screenshotDirectory, "world-obs-desktop.png") });
  await page.evaluate(async () => { const { WorldConfig } = await import("/src/world-config.js"); WorldConfig.instance.setPosition({ width: 420 }); });
  assert.equal(await page.locator(".rpgup-config-form thead").isVisible(), false, "Tabela vira lista ao estreitar a janela mesmo em um monitor largo");
  await worldTab(page, "general");
  assert.equal(await page.locator(".rpgup-grid").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length), 1);
  await worldTab(page, "participants");
  await page.screenshot({ path: path.join(screenshotDirectory, "world-obs-narrow-window.png") });
  await page.evaluate(async () => { const { WorldConfig } = await import("/src/world-config.js"); WorldConfig.instance.setPosition({ width: 920 }); });
  const appliedURL = await page.locator("iframe").getAttribute("src");
  assert.equal(new URL(appliedURL).searchParams.has("vdo"), false);
  assert.ok(new URL(appliedURL).searchParams.get("avatar").startsWith("data:image/webp;base64,"));
  assert.equal(new URL(appliedURL).searchParams.has("mobile"), false);
  assert.equal(await page.evaluate(async () => (await fixture.dock()).prefs.avatarURL), "https://images.example/avatar.webp");
  await page.evaluate(() => fixture.closeConfig());
  await dockTab(page, "connect");
  await page.getByRole("button", { name: "Aplicar / reconectar", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("iframe").allow.includes("microphone"));
  const director = new URL(await page.locator("iframe").getAttribute("src"));
  assert.equal(director.searchParams.get("director"), "FixtureRoom123");
  assert.equal(director.searchParams.get("push"), "slot_gm");
  assert.ok(director.searchParams.has("previewmode"));
  assert.equal(director.searchParams.get("roombitrate"), "200");
  assert.equal(director.searchParams.get("maxframerate"), "20");
  assert.equal(director.searchParams.get("cover"), "");
  assert.equal(director.searchParams.get("showlabels"), "rounded");
  assert.equal(director.searchParams.get("meterstyle"), "2", "Use official VDO speaker outline");
  assert.equal(director.searchParams.get("denoise"), "1");
  assert.equal(director.searchParams.get("echocancellation"), "1");
  assert.equal(director.searchParams.get("autogain"), "1");
  assert.equal(director.searchParams.get("noisegate"), "1");
  assert.ok(decodeURIComponent(atob(director.searchParams.get("base64css"))).includes("outline:"));
  assert.ok(director.href.length <= 6900);
  assert.equal(director.searchParams.has("structure"), false);
  await page.evaluate(() => { globalThis.layoutFrame = document.querySelector("iframe"); });
  const layoutLoads = navigations;
  await dockTab(page, "window");
  for (const dock of ["left", "right", "top", "bottom", "floating"]) {
    await page.getByRole("combobox", { name: "Posição do dock", exact: true }).selectOption(dock);
    assert.equal(await page.locator("iframe").getAttribute("src"), director.href);
    assert.equal(await page.evaluate(() => layoutFrame === document.querySelector("iframe")), true);
    assert.equal(await page.locator("iframe").count(), 1);
  }
  assert.equal(navigations, layoutLoads, "Reposicionar com cover não cria/navega iframe");
  assert.equal(await page.evaluate(() => notices.filter(notice => notice.value.includes("Toggle Director Vision")).length), 1);
  await page.evaluate(async () => { await (await fixture.dock()).close(); await fixture.menu("openDock"); });
  await page.waitForFunction(() => document.querySelector("iframe"));
  assert.equal(await page.locator("iframe").count(), 1);
  await page.reload();
  await page.waitForFunction(() => globalThis.fixtureReady && document.querySelector("iframe"));
  assert.equal(await page.locator("#rpgup-vdo-world-config").count(), 0);
  await openSettings(page);
  await dockTab(page, "window");
  assert.equal(await page.getByRole("combobox", { name: "Posição do dock", exact: true }).inputValue(), "floating");
  assert.equal(await page.locator("iframe").evaluate(node => node.style.transform), "scale(0.8)");
  assert.equal((await page.evaluate(() => fixture.config())).roomLayout, "compact", "Layout da Room persiste após reload");
  await dockTab(page, "avatar");
  assert.equal(await page.getByRole("combobox", { name: "Placeholder", exact: true }).inputValue(), "custom");
  assert.equal(await page.getByRole("textbox", { name: "URL do placeholder", exact: true }).inputValue(), "https://images.example/avatar.webp");
  assert.ok(new URL(await page.locator("iframe").getAttribute("src")).searchParams.get("avatar").startsWith("data:image/webp;base64,"));
  assert.deepEqual(errors, []);
  console.log("GM: singleton, cinco posições, iframe preservado, rejoin, persistência e painel OBS: OK.");

  const guest = await context.newPage();
  const guestErrors = [];
  guest.on("pageerror", error => guestErrors.push(error.message));
  await guest.goto(base + "/tests/harness.html?user=p1");
  await guest.waitForFunction(() => globalThis.fixtureReady && document.querySelector("iframe"));
  await openSettings(guest);
  assert.equal(await guest.locator("#rpgup-world-tab-general").count(), 0, "Jogador não recebe configuração de Room");
  assert.equal(await guest.locator("#rpgup-world-tab-participants").count(), 0, "Jogador não recebe links e slots");
  assert.equal(await guest.locator("#rpgup-world-tab-connect").count(), 1);
  assert.equal(new URL(await guest.locator("iframe").getAttribute("src")).searchParams.get("push"), "slot_a");
  assert.ok(new URL(await guest.locator("iframe").getAttribute("src")).searchParams.get("avatar").startsWith("data:image/"));
  assert.equal(await guest.locator('[name="Self-preview"]').count(), 0);
  await guest.evaluate(() => fixture.menu("worldConfig"));
  assert.equal(await guest.locator("#rpgup-world-tab-general").count(), 0, "Menu de opções não concede permissões de GM");
  assert.deepEqual(guestErrors, []);
  console.log("Jogador: slot automático, preferências separadas e configuração GM negada: OK.");

  // Connected clients receive world Setting changes. A player without an assigned
  // stream waits; the GM generates and saves, and the player opens automatically.
  await page.evaluate(() => fixture.setConfig({ ...fixture.config(), slots: { gm1: "slot_gm" } }));
  await guest.reload();
  await guest.waitForFunction(() => globalThis.fixtureReady);
  assert.equal(await guest.locator("iframe").count(), 0);
  assert.match(await guest.locator(".rpgup-connection-alert").innerText(), /GM ainda não associou/);
  await page.evaluate(() => fixture.menu("worldConfig"));
  await worldTab(page, "participants");
  await page.getByRole("button", { name: "Criar IDs faltantes", exact: true }).click();
  await page.waitForFunction(() => fixture.config().slots.p1 && fixture.config().slots.p2);
  const generated = await page.evaluate(() => fixture.config().slots);
  await guest.waitForFunction(() => document.querySelector("iframe"));
  assert.equal(new URL(await guest.locator("iframe").getAttribute("src")).searchParams.get("push"), generated.p1);
  await page.getByRole("button", { name: "Criar IDs faltantes", exact: true }).click();
  assert.deepEqual(await page.evaluate(() => fixture.config().slots), generated);
  await page.getByRole("textbox", { name: "Stream ID de Jogador A", exact: true }).fill("player_custom");
  await page.evaluate(() => fixture.menu("worldConfig"));
  assert.equal(await page.getByRole("textbox", { name: "Stream ID de Jogador A", exact: true }).inputValue(), "player_custom", "Rerender/reabrir o mesmo menu conserva o rascunho");
  assert.equal(await page.locator(".rpgup-config-form").count(), 1);
  // Click the dock behind the config frame to reproduce apply while editing.
  await page.evaluate(() => Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Aplicar / reconectar").click());
  await page.waitForFunction(() => fixture.config().slots.p1 === "player_custom");
  await page.evaluate(() => fixture.closeConfig());
  await dockTab(page, "connect");
  await page.getByRole("button", { name: "Aplicar / reconectar", exact: true }).click();
  assert.equal((await page.evaluate(() => fixture.config().slots)).p2, generated.p2, "Reconnect nunca recria slots");
  await openSettings(guest);
  await guest.getByRole("button", { name: "Aplicar / reconectar", exact: true }).click();
  await guest.waitForFunction(() => new URL(document.querySelector("iframe").src).searchParams.get("push") === "player_custom");
  await guest.reload();
  await guest.waitForFunction(() => globalThis.fixtureReady && document.querySelector("iframe"));
  assert.equal(new URL(await guest.locator("iframe").getAttribute("src")).searchParams.get("push"), "player_custom");
  console.log("Regressão: gerar/salvar sincroniza GM e jogador; rascunho sobrevive; reconectar/recarregar preserva IDs: OK.");

  await page.evaluate(() => fixture.menu("worldConfig"));
  await worldTab(page, "participants");
  await page.getByRole("textbox", { name: "Stream ID de Jogador B", exact: true }).fill("unsaved_b");
  await page.evaluate(() => fixture.setConfig({ ...fixture.config(), roomId: "OtherGMRoom" }));
  await page.getByRole("button", { name: "Salvar mudanças", exact: true }).click();
  await page.waitForFunction(() => notices.some(notice => notice.value.includes("Outro GM")));
  assert.equal((await page.evaluate(() => fixture.config().slots)).p2, generated.p2);
  assert.equal(await page.getByRole("textbox", { name: "Stream ID de Jogador B", exact: true }).inputValue(), "unsaved_b");
  await page.evaluate(() => fixture.closeConfig());
  await page.evaluate(() => fixture.menu("worldConfig"));
  await worldTab(page, "participants");
  await page.getByRole("textbox", { name: "Stream ID de Jogador B", exact: true }).fill("");
  await page.evaluate(() => { fixture.failSave = true; });
  await page.getByRole("button", { name: "Criar IDs faltantes", exact: true }).click();
  await page.waitForFunction(() => notices.some(notice => notice.value.includes("gravação recusada")));
  assert.equal((await page.evaluate(() => fixture.config().slots)).p2, generated.p2);
  assert.match(await page.locator(".rpgup-config-form .rpgup-save-status").innerText(), /Não salvo/);
  await page.evaluate(() => { fixture.failSave = false; return fixture.closeConfig(); });
  console.log("Conflito entre GMs e gravação recusada: sem falso sucesso nem perda do rascunho: OK.");

  await page.evaluate(() => fixture.menu("worldConfig"));
  await worldTab(page, "participants");
  await page.getByRole("textbox", { name: "Stream ID de Jogador B", exact: true }).fill("membership_draft");
  await page.evaluate(() => {
    const user = { id: "replacement", name: "Jogador criado depois", isGM: false };
    game.users.push(user);
    Hooks.callAll("createUser", user);
  });
  await page.getByRole("textbox", { name: "Stream ID de Jogador criado depois", exact: true }).waitFor();
  assert.equal(await page.getByRole("textbox", { name: "Stream ID de Jogador B", exact: true }).inputValue(), "membership_draft");
  await page.getByRole("button", { name: "Criar IDs faltantes", exact: true }).click();
  await page.waitForFunction(() => fixture.config().slots.replacement && fixture.config().slots.p2 === "membership_draft");
  await page.evaluate(() => fixture.closeConfig());
  console.log("Usuário criado com painel aberto: lista atualizada, rascunho preservado e slot salvo: OK.");

  await dockTab(page, "avatar");
  await page.getByRole("textbox", { name: "URL do placeholder", exact: true }).fill(base + "/missing-avatar.svg");
  await dockTab(page, "connect");
  await page.getByRole("button", { name: "Aplicar / reconectar", exact: true }).click();
  await page.waitForFunction(() => notices.some(notice => notice.value.includes("HTTP 404")));
  assert.equal(new URL(await page.locator("iframe").getAttribute("src")).searchParams.get("avatar"), "default");
  assert.ok(await page.evaluate(() => notices.some(notice => notice.value.includes("Placeholder personalizado não aplicado"))));
  await dockTab(page, "avatar");
  await page.getByRole("textbox", { name: "URL do placeholder", exact: true }).fill("file:///invalid-avatar.svg");
  await dockTab(page, "connect");
  await page.getByRole("button", { name: "Aplicar / reconectar", exact: true }).click();
  await page.waitForFunction(() => notices.some(notice => notice.value.includes("use uma imagem por URL HTTP/HTTPS")));
  assert.equal(new URL(await page.locator("iframe").getAttribute("src")).searchParams.get("avatar"), "default");
  await dockTab(page, "avatar");
  await page.getByRole("combobox", { name: "Placeholder", exact: true }).selectOption("foundry");
  await dockTab(page, "connect");
  await page.getByRole("button", { name: "Aplicar / reconectar", exact: true }).click();
  await page.waitForFunction(() => new URL(document.querySelector("iframe").src).searchParams.get("avatar")?.startsWith("data:image/"));
  const foundryImage = new URL(await page.locator("iframe").getAttribute("src")).searchParams.get("avatar");
  assert.ok(foundryImage.startsWith("data:image/webp;base64,"));
  assert.ok((await page.locator("iframe").getAttribute("src")).length <= 6900, "Reconnect avatar respects nginx URL limit");
  await page.reload();
  await page.waitForFunction(() => globalThis.fixtureReady && document.querySelector("iframe"));
  assert.ok(new URL(await page.locator("iframe").getAttribute("src")).searchParams.get("avatar")?.startsWith("data:image/webp;base64,"), "Avatar is regenerated after reload within current URL budget");
  assert.ok((await page.locator("iframe").getAttribute("src")).length <= 6900, "Reloaded room must not generate 414");
  assert.equal(await page.locator("#rpgup-vdo-world-config").count(), 0);
  assert.equal(await page.locator(".rpgup-director-help").isVisible(), false);
  console.log("Avatar Foundry sem CORS: miniatura aplicada e reaplicada após reload; erro de imagem tem aviso explícito: OK.");

  const autoPage = await context.newPage();
  await autoPage.goto(base + "/tests/harness.html?user=p2");
  await autoPage.waitForFunction(() => globalThis.fixtureReady && document.querySelector("iframe"));
  await openSettings(autoPage);
  await dockTab(autoPage, "window");
  await autoPage.getByRole("checkbox").uncheck();
  await autoPage.evaluate(async () => { await (await fixture.dock())._persist(); });
  await autoPage.reload();
  await autoPage.waitForFunction(() => globalThis.fixtureReady);
  assert.equal(await autoPage.locator("#rpgup-vdo-room").count(), 0);
  await autoPage.evaluate(() => fixture.menu("openDock"));
  await autoPage.waitForFunction(() => document.querySelector("iframe"));
  console.log("Abrir ao entrar: desmarcar impede abertura no próximo login; menu reabre manualmente: OK.");

  await autoPage.evaluate(async () => {
    await (await fixture.dock()).close();
    Hooks.callAll("renderSettings", {}, document.querySelector("#settings"));
  });
  const cameras = autoPage.getByRole("button", { name: "Câmeras VDO.Ninja", exact: true });
  const options = autoPage.getByRole("button", { name: "Opções VDO.Ninja", exact: true });
  assert.equal(await cameras.count(), 1);
  assert.equal(await options.count(), 1);
  await cameras.click();
  await autoPage.waitForFunction(() => document.querySelector("iframe"));
  assert.equal(await cameras.getAttribute("aria-pressed"), "true");
  await cameras.click();
  await autoPage.waitForFunction(() => !document.querySelector("#rpgup-vdo-room"));
  assert.equal(await autoPage.locator("iframe").count(), 0, "Fechar dock fecha o iframe VDO");
  assert.equal(await cameras.getAttribute("aria-pressed"), "false");
  await options.click();
  await autoPage.waitForFunction(() => document.querySelector("#rpgup-vdo-world-config"));
  assert.equal(await autoPage.locator("iframe").count(), 0, "Abrir opções não cria dock nem conexão VDO");
  await options.click();
  await autoPage.waitForFunction(() => !document.querySelector("#rpgup-vdo-world-config"));
  assert.equal(await autoPage.locator("iframe").count(), 0, "Segundo clique fecha apenas opções");
  await cameras.click();
  await autoPage.waitForFunction(() => document.querySelector("iframe"));
  await cameras.click();
  await autoPage.waitForFunction(() => !document.querySelector("#rpgup-vdo-room"));
  await cameras.click();
  await autoPage.waitForFunction(() => document.querySelector("iframe"));
  assert.equal(await autoPage.locator("iframe").count(), 1);
  console.log("Botão Câmeras alterna abrir/fechar; segundo botão abre opções; iframe único: OK.");

  // Closing during image preparation must cancel the old connection, while an
  // immediate reopen can start its own image fetch and create exactly one frame.
  let heldAvatar;
  await autoPage.route(base + "/delayed-avatar.svg", route => {
    if (!heldAvatar) { heldAvatar = route; return; }
    return route.fulfill({ contentType: "image/svg+xml", body: avatarSVG });
  });
  const firstAvatarRequest = autoPage.waitForRequest(base + "/delayed-avatar.svg");
  await autoPage.evaluate(async () => {
    await (await fixture.dock()).close();
    game.user.avatar = "/delayed-avatar.svg";
    await fixture.menu("openDock");
  });
  await firstAvatarRequest;
  assert.equal(await autoPage.locator("iframe").count(), 0);
  await autoPage.evaluate(async () => { await (await fixture.dock()).close(); await fixture.menu("openDock"); });
  await autoPage.waitForFunction(() => document.querySelector("iframe"));
  assert.equal(await autoPage.locator("iframe").count(), 1);
  assert.ok(new URL(await autoPage.locator("iframe").getAttribute("src")).searchParams.get("avatar").startsWith("data:image/"));
  await heldAvatar.abort().catch(() => {});
  console.log("Avatar pendente: fechar cancela; reabrir imediatamente cria somente uma sala: OK.");

  for (const viewport of [{ width: 900, height: 650 }, { width: 390, height: 640 }, { width: 360, height: 280 }]) {
    await page.setViewportSize(viewport);
    // ResizeObserver updates the scaled iframe on the next render frame.
    const settled = await page.waitForFunction(() => {
      const host = document.querySelector(".rpgup-frame-host")?.getBoundingClientRect();
      const frame = document.querySelector(".rpgup-frame-host iframe")?.getBoundingClientRect();
      return Boolean(host && frame && host.height > 50 && host.width > 0 &&
        Math.abs(host.width - frame.width) <= 1 &&
        Math.abs(host.height - frame.height) <= 1);
    }, null, { timeout: 2000 }).then(() => true, () => false);
    const host = await page.locator(".rpgup-frame-host").boundingBox();
    const frame = await page.locator("iframe").boundingBox();
    assert.ok(host.height > 50 && host.width > 0, "A sala continua visível em janela pequena");
    assert.ok(settled, "Zoom preenche o espaço disponível após resize: " +
      JSON.stringify({ viewport, host, frame, deltaWidth: host.width - frame.width, deltaHeight: host.height - frame.height }));
  }
  await page.setViewportSize({ width: 390, height: 640 });
  await openSettings(page);
  await page.screenshot({ path: path.join(screenshotDirectory, "unified-settings-mobile.png") });
  await page.evaluate(() => fixture.menu("worldConfig"));
  await page.screenshot({ path: path.join(screenshotDirectory, "world-obs-mobile.png") });
  const panelOverflow = await page.locator(".rpgup-config-form").evaluate(form => form.scrollWidth > form.clientWidth + 2);
  assert.equal(panelOverflow, false, "Painel GM fica legível em viewport estreita");
  await page.evaluate(() => fixture.closeConfig());
  await page.evaluate(async () => {
    game.world = { title: "Crônicas de Artraga" };
    await fixture.setConfig({ ...fixture.config(), roomId: "" });
    await fixture.menu("worldConfig");
  });
  await worldTab(page, "general");
  assert.equal(await page.locator('input[name="roomId"]').inputValue(), "CronicasdeArtraga", "Room vazia sugere nome do mundo");
  assert.equal((await page.evaluate(() => fixture.config())).roomId, "", "Sugestão não altera configuração sem salvar");
  await page.evaluate(() => fixture.closeConfig());
  assert.deepEqual(errors, []);
  assert.deepEqual(guestErrors, []);
  await page.evaluate(async () => { await (await fixture.dock()).close(); });
  assert.equal(await page.locator("body").evaluate(node => node.classList.contains("rpgup-vdo-docked")), false);
  assert.equal(await page.locator("body").evaluate(node => node.style.getPropertyValue("--rpgup-vdo-left")), "");
  console.log("Janela única, separação GM/jogador, posição, zoom, avatar, iframe e resize: OK.");

  // Sidebar navigation simulation: no floating configuration window, full
  // controls hosted in the same column as native Chat/Scenes/Actors tabs.
  const hudContext = await browser.newContext({ viewport: { width: 1280, height: 840 } });
  await hudContext.route("https://vdo.ninja/**", route =>
    route.fulfill({ contentType: "text/html", body: "<p>VDO fixture</p>" }));
  const hudPage = await hudContext.newPage();
  const hudErrors = [];
  hudPage.on("pageerror", error => hudErrors.push(error.message));
  await hudPage.goto(base + "/tests/harness.html");
  await hudPage.waitForFunction(() => globalThis.fixtureReady);
  await hudPage.evaluate(() => {
    const sidebar = document.createElement("section");
    sidebar.id = "sidebar";
    sidebar.style.cssText = "position:absolute;right:0;top:0;width:340px;height:800px;display:flex;flex-direction:column;background:#24262d;";
    const tabs = document.createElement("nav");
    tabs.id = "sidebar-tabs";
    tabs.innerHTML = '<button class="sidebar-tab active" type="button" data-tab="settings" aria-selected="true">Configurações</button>';
    const content = document.createElement("div");
    content.id = "sidebar-content";
    content.style.cssText = "flex:1;min-height:0;";
    content.innerHTML = '<section class="native-settings">Painel original</section>';
    sidebar.append(tabs, content);
    document.body.append(sidebar);
    ui.sidebar = { element: sidebar, expand() { return Promise.resolve(); } };
    Hooks.callAll("renderSidebar", ui.sidebar, sidebar);
  });
  assert.equal(await hudPage.locator("#sidebar-tabs .rpgup-hud-tab").count(), 1);
  assert.equal(await hudPage.locator("#sidebar-content .rpgup-sidebar-pane").count(), 1);
  await hudPage.evaluate(() => game.modules.get("rpgup-vdo-ninja").api.toggleOptions());
  assert.equal(await hudPage.locator(".rpgup-sidebar-pane").isVisible(), true);
  assert.equal(await hudPage.locator("#rpgup-vdo-world-config").count(), 0, "HUD não cria janela separada");
  assert.match(await hudPage.locator(".rpgup-invite-copy input").inputValue(), /room=FixtureRoom123/);
  assert.equal(await hudPage.locator(".rpgup-invite-copy button").isEnabled(), true);
  assert.equal(await hudPage.locator(".rpgup-group-button").count(), 3);
  await hudPage.getByRole("button", { name: "Avançado", exact: true }).click();
  assert.equal(await hudPage.locator("#rpgup-world-tab-audioFilters").isVisible(), true);
  await hudPage.getByRole("button", { name: "Mesa", exact: true }).click();
  assert.equal(await hudPage.locator("#rpgup-world-tab-general").isVisible(), true);
  await hudPage.locator('.rpgup-sidebar-pane input[name="roomId"]').fill("HudTestRoom001");
  await hudPage.locator(".rpgup-sidebar-pane .rpgup-config-footer button[type=submit]").click();
  await hudPage.waitForFunction(() =>
    document.querySelector(".rpgup-invite-copy input")?.value.includes("HudTestRoom001"));
  assert.equal(await hudPage.locator("#rpgup-vdo-world-config").count(), 0, "Salvar não reabre janela antiga");
  assert.equal(await hudPage.locator('.rpgup-sidebar-pane input[name="roomId"]').inputValue(), "HudTestRoom001");
  await hudPage.locator("#sidebar-tabs [data-tab=settings]").click();
  assert.equal(await hudPage.locator(".rpgup-sidebar-pane").isVisible(), false);
  await hudPage.locator("#sidebar-tabs .rpgup-hud-tab").click();
  assert.equal(await hudPage.locator(".rpgup-sidebar-pane").isVisible(), true);
  await hudPage.evaluate(() => Hooks.callAll("renderSidebar", ui.sidebar, ui.sidebar.element));
  assert.equal(await hudPage.locator("#sidebar-tabs .rpgup-hud-tab").count(), 1, "Renderizar a barra não duplica o HUD");
  await hudPage.screenshot({ path: path.join(screenshotDirectory, "premium-sidebar-hud.png") });
  assert.deepEqual(hudErrors, []);
  await hudContext.close();
  console.log("HUD nativo: convite, cópia visível, categorias, salvar e retorno à sidebar: OK.");

} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}

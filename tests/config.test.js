import test from "node:test";
import assert from "node:assert/strict";
import { fillMissingSlots, validateWorld, parseExtraQuery, normalizePrefs, dockPosition, suggestRoomId, validateAudioFilters, audioFilterPreset } from "../src/config.js";
import { participantURL, soloURL, obsExport, roomInviteURL } from "../src/urls.js";
import { themeCSS, foundryUserColor, themeVisual } from "../src/theme.js";
import { VDO_OPTIONS } from "../src/advanced-options.js";

const users = [
  { id: "gm1", name: "Henrique", isGM: true },
  { id: "p1", name: "Ana & João + ç", isGM: false },
  { id: "p2", name: "Bia", isGM: false }
];
const world = {
  roomId: "RPGUPPrototype123", extraQuery: "password=Private123&roombitrate=500&width=1280&fps=30",
  audio: "discord", directorUserId: "", slots: { gm1: "slot_a81k2", p1: "slot_92md4", p2: "slot_c3" }
};

test("1 GM e 2 jogadores entram na mesma Room com labels e push do Foundry", () => {
  for (const user of users) {
    const url = new URL(participantURL(world, user, {}, users));
    assert.equal(url.origin, "https://vdo.ninja");
    assert.equal(url.searchParams.get("room"), world.roomId);
    assert.equal(url.searchParams.get("push"), world.slots[user.id]);
    assert.equal(url.searchParams.get("label"), user.name);
    assert.equal(url.searchParams.get("showlabels"), "rounded");
    assert.ok(url.searchParams.has("base64css"), "Tema padrão moderno aplica molduras");
    for (const key of ["autostart", "cleanoutput", "view", "scene", "director"]) assert.equal(url.searchParams.has(key), false);
  }
});

test("barra superior original do VDO permanece visível para todos os participantes, sem afetar OBS", () => {
  const modes = [
    world,
    { ...world, audio: "vdo" },
    { ...world, directorUserId: "gm1", roomLayout: "compact" }
  ];
  for (const config of modes) for (const user of users) {
    const source = new URL(participantURL(config, user, {}, users));
    assert.equal(source.searchParams.has("showheader"), true, "VDO mantém a barra superior");
    for (const hidden of ["hideheader", "noheader", "hh", "hidemenu", "hm"])
      assert.equal(source.searchParams.has(hidden), false, hidden);
    assert.equal(source.searchParams.get("push"), config.slots[user.id]);
  }
  const obs = new URL(soloURL(world, users[0].id, users));
  assert.equal(obs.searchParams.has("showheader"), false, "Link OBS continua limpo");
  assert.equal(obs.searchParams.has("cleanoutput"), true);
  const guest = new URL(roomInviteURL(world, users));
  assert.equal(guest.searchParams.has("showheader"), false, "Convite público conserva interface padrão");
});

test("reconexões preservam slots e ignoram overrides antigos de câmera/interface/preview", () => {
  const before = structuredClone(world);
  for (const preview of ["native", "mini", "pip"]) {
    const url = new URL(participantURL(world, users[1], { preview, camera: "OBS", interface: "mobile" }, users));
    assert.equal(url.searchParams.get("push"), world.slots.p1);
    for (const key of ["pipme", "minipreview", "vdo", "mobile", "notmobile"]) assert.equal(url.searchParams.has(key), false);
    assert.equal(url.searchParams.has("view"), false);
    assert.equal(url.searchParams.has("autostart"), false);
  }
  assert.deepEqual(world, before);
});

test("gerar slots preserva usuários existentes, removidos e evita colisões", () => {
  let n = 0;
  const random = size => new Uint8Array(size).fill(++n);
  const original = { gm1: "slot_a81k2", removed: "slot_" + "01".repeat(10) };
  const filled = fillMissingSlots(original, users, random);
  assert.equal(filled.gm1, original.gm1);
  assert.equal(filled.removed, original.removed);
  assert.equal(new Set(Object.values(filled)).size, 4);
  assert.deepEqual(fillMissingSlots(filled, users, () => { throw new Error("não regenerar"); }), filled);
  assert.deepEqual(original, { gm1: "slot_a81k2", removed: "slot_" + "01".repeat(10) });
});

test("IDs inválidos, slots duplicados e Director jogador são rejeitados", () => {
  assert.throws(() => validateWorld({ ...world, roomId: "wrong room" }, users));
  assert.throws(() => validateWorld({ ...world, slots: { gm1: "a", p1: "a" } }, users), /duplicado/);
  assert.throws(() => validateWorld({ ...world, slots: { p1: "x&push=evil" } }, users));
  assert.throws(() => validateWorld({ ...world, directorUserId: "p1" }, users), /GM/);
  assert.throws(() => participantURL({ ...world, slots: {} }, users[1], {}, users), /GM/);
});

test("parâmetros extras não podem trocar identidade, papel, transporte ou UI", () => {
  for (const extraQuery of ["push=x", "id=x", "room=other", "r=other", "view=x", "director=x", "dir=x", "label=x", "whipout=x", "whep=x", "meshcast=x", "avatar=x", "autostart", "cleanoutput", "password=a#push=bad", "password=a&password=b", "Password=a", "roombitrate=0"]) {
    assert.throws(() => parseExtraQuery(extraQuery), extraQuery);
  }
  assert.equal(parseExtraQuery("password=Private123&fps=30").get("password"), "Private123");
});

test("áudio é isolado e configurável, VDO nativo não recebe overrides de áudio", () => {
  const muted = new URL(participantURL(world, users[0], {}, users));
  assert.equal(muted.searchParams.get("audiodevice"), "0");
  assert.equal(muted.searchParams.has("noaudio"), true);
  const native = new URL(participantURL({ ...world, audio: "vdo" }, users[0], {}, users));
  assert.equal(native.searchParams.has("audiodevice"), false);
  assert.equal(native.searchParams.has("noaudio"), false);
});

test("Director designado usa o mesmo stream; demais usuários seguem como guests", () => {
  const directorWorld = { ...world, directorUserId: "gm1" };
  const gm = new URL(participantURL(directorWorld, users[0], {}, users));
  assert.equal(gm.searchParams.get("director"), world.roomId);
  assert.equal(gm.searchParams.get("push"), world.slots.gm1);
  assert.equal(gm.searchParams.get("showdirector"), "1");
  assert.equal(gm.searchParams.has("previewmode"), true);
  const guest = new URL(participantURL(directorWorld, users[1], {}, users));
  assert.equal(guest.searchParams.has("director"), false);
  assert.equal(guest.searchParams.has("previewmode"), false);
});

test("OBS gera solo/view do slot certo, com Room/senha e sem publicar nem capturar", () => {
  for (const user of users) {
    const obs = new URL(soloURL(world, user.id, users));
    assert.equal(obs.searchParams.get("room"), world.roomId);
    assert.equal(obs.searchParams.get("view"), world.slots[user.id]);
    assert.equal(obs.searchParams.get("password"), "Private123");
    assert.equal(obs.searchParams.has("solo"), true);
    assert.equal(obs.searchParams.has("cleanoutput"), true);
    for (const key of ["push", "director", "width", "fps", "audiodevice", "pipme"]) assert.equal(obs.searchParams.has(key), false);
  }
});

test("preferências e geometria são normalizadas sem escapar da viewport", () => {
  assert.equal(normalizePrefs({ dock: "invalid", preview: "network", sideWidth: NaN }).dock, "left");
  assert.equal(normalizePrefs({}).dock, "left");
  assert.equal(normalizePrefs({}).schemaVersion, 4);
  for (const dock of ["left", "right", "top", "bottom", "floating"]) {
    for (const [width, height] of [[1920, 1080], [360, 640], [250, 200]]) {
      const pos = dockPosition({ dock, floating: { width: 2400, height: 1800, left: 9999, top: 9999 } }, { width, height });
      assert.ok(pos.width > 0 && pos.height > 0);
      assert.ok(pos.left >= 0 && pos.top >= 0);
      assert.ok(pos.left + pos.width <= width);
      assert.ok(pos.top + pos.height <= height);
    }
  }
});

test("avatar Foundry/customizado é validado e a miniatura preparada usa o parâmetro oficial", () => {
  const gm = { ...users[0], avatar: "users/henrique.webp" };
  const defaultURL = new URL(participantURL(world, gm, {}, users, "https://foundry.example/game"));
  assert.equal(defaultURL.searchParams.get("avatar"), "https://foundry.example/users/henrique.webp");
  const custom = new URL(participantURL(world, gm, {
    camera: "OBS Virtual Camera", interface: "mobile", avatar: "custom", avatarURL: "https://images.example/a.webp?x=1&y=2"
  }, users));
  assert.equal(custom.searchParams.get("avatar"), "https://images.example/a.webp?x=1&y=2");
  assert.equal(custom.searchParams.has("mobile"), false);
  assert.equal(custom.searchParams.has("notmobile"), false);
  const desktop = new URL(participantURL(world, gm, { interface: "desktop", avatar: "none" }, users));
  assert.equal(desktop.searchParams.has("notmobile"), false);
  assert.equal(desktop.searchParams.has("avatar"), false);
  assert.equal(custom.searchParams.get("push"), world.slots.gm1);
  const prepared = new URL(participantURL(world, gm, {}, users, "https://foundry.example/game", "data:image/webp;base64,AA=="));
  assert.equal(prepared.searchParams.get("avatar"), "data:image/webp;base64,AA==");
  const obs = new URL(soloURL(world, gm.id, users));
  for (const key of ["avatar", "vdo", "mobile", "notmobile", "previewmode"]) assert.equal(obs.searchParams.has(key), false);
  for (const image of ["javascript:alert(1)", "blob:https://foundry.example/id", "https://user:password@example.com/a.webp", "http://example.com/a.webp"]) {
    assert.throws(() => participantURL(world, gm, { avatar: "custom", avatarURL: image }, users, "https://foundry.example/game"), /Placeholder/);
  }
});

test("presets mantêm captura adaptativa, parâmetros avançados prevalecem e OBS não herda limites da mesa", () => {
  const config = { ...world, quality: "economy", extraQuery: "password=Private123&roombitrate=450" };
  const url = new URL(participantURL(config, users[1], {}, users));
  assert.equal(url.searchParams.get("roombitrate"), "450");
  assert.equal(url.searchParams.get("maxframerate"), "20");
  assert.equal(url.searchParams.has("fps"), false);
  const obs = new URL(soloURL(config, users[1].id, users));
  for (const name of ["roombitrate", "maxframerate", "width", "height"]) assert.equal(obs.searchParams.has(name), false);
  assert.equal(obs.searchParams.get("password"), "Private123");
  assert.equal(validateWorld(world, users).quality, "native", "Configuração antiga mantém os padrões e os parâmetros existentes");
  assert.throws(() => validateWorld({ ...world, quality: "unknown" }, users), /Preset/);
});

test("avatar definido pelo GM usa o parâmetro nativo; preferência pessoal pode escolher outra imagem", () => {
  const config = { ...world, avatars: { p1: "users/mesa.webp" } };
  const url = new URL(participantURL(config, users[1], {}, users, "https://foundry.example/game"));
  assert.equal(url.searchParams.get("avatar"), "https://foundry.example/users/mesa.webp");
  const custom = new URL(participantURL(config, users[1], { avatar: "custom", avatarURL: "https://images.example/personal.webp" }, users));
  assert.equal(custom.searchParams.get("avatar"), "https://images.example/personal.webp");
  const none = new URL(participantURL(config, users[1], { avatar: "none" }, users));
  assert.equal(none.searchParams.has("avatar"), false);
  for (const image of ["javascript:alert(1)", "data:image/svg+xml,test", "https://user:secret@example.com/a.webp"]) {
    assert.throws(() => validateWorld({ ...world, avatars: { p1: image } }, users), /Avatar/);
  }
});

test("seis participantes conservam IDs e exportam somente usuários associados, com nome e link solo", () => {
  const group = [...users, ...[3, 4, 5].map(n => ({ id: `p${n}`, name: `Jogador ${n}`, isGM: false }))];
  const config = { ...world, slots: fillMissingSlots(world.slots, group) };
  assert.equal(Object.keys(config.slots).length, 6);
  assert.equal(config.slots.p1, world.slots.p1);
  const data = obsExport(config, group);
  assert.equal(data.sources.length, 6);
  for (const source of data.sources) {
    assert.equal(new URL(source.url).searchParams.get("view"), config.slots[source.userId]);
    assert.equal(source.streamId, config.slots[source.userId]);
    assert.ok(source.name);
  }
  assert.equal(obsExport(config, [...group, { id: "no_slot", name: "Sem slot" }]).sources.length, 6);
  assert.deepEqual(config.slots, fillMissingSlots(config.slots, group));
});

test("Room ID inicial é derivada do título do mundo sem alterar salas salvas", () => {
  assert.equal(suggestRoomId({ title: "Crônicas de Artraga" }), "CronicasdeArtraga");
  assert.equal(suggestRoomId({ title: "  Poké & Dragons!  " }), "PokeDragons");
  assert.equal(suggestRoomId({ title: "!!!", id: "world123" }), "MesaVDO");
  assert.equal(suggestRoomId({ title: "A".repeat(80) }).length, 49);
  assert.match(suggestRoomId({ title: "Ção — Vórtice" }), /^[A-Za-z0-9]{1,49}$/);
});

test("temas usam cores Foundry e o destaque de fala nativo do VDO", () => {
  const colorUsers = [
    { ...users[0], color: "#12aB78" },
    { ...users[1], color: { css: "#fab" } },
    { ...users[2], color: "not-a-color" }
  ];
  const css = themeCSS(world, colorUsers);
  assert.match(css, /--c:#12aB78/);
  assert.match(css, /--c:#ffaabb/);
  assert.match(css, /--c:#a5a5b2/);
  assert.match(css, /slot_a81k2/);
  assert.doesNotMatch(css, /data-speaking/);
  const vdo = { ...world, audio: "vdo", theme: "neon" };
  const url = new URL(participantURL(vdo, colorUsers[0], { schemaVersion: 4, presentation: "native" }, colorUsers));
  assert.equal(url.searchParams.get("meterstyle"), "2");
  const encoded = url.searchParams.get("base64css");
  const restored = decodeURIComponent(atob(encoded));
  assert.doesNotMatch(restored, /data-speaking/);
  assert.match(restored, /outline:/);
  assert.match(restored, /--c:#12aB78/);
  assert.equal(url.searchParams.get("showlabels"), "rounded");
  assert.equal(foundryUserColor({ color: "#abc" }), "#aabbcc");
  assert.equal(foundryUserColor({ color: "red;}" }), "#a5a5b2");
});

test("sem tema mantém nomes mas não adiciona estilos nem medidor", () => {
  const config = { ...world, theme: "none", audio: "vdo" };
  const url = new URL(participantURL(config, users[0], { schemaVersion: 4, presentation: "native" }, users));
  assert.equal(url.searchParams.get("showlabels"), "rounded");
  assert.equal(url.searchParams.has("base64css"), false);
  assert.equal(url.searchParams.has("meterstyle"), false);
  assert.equal(themeCSS(config, users), "");
  for (const theme of ["scifi", "modern", "neon", "rustic", "fantasy", "none"]) {
    assert.equal(validateWorld({ ...world, theme }, users).theme, theme);
  }
  assert.throws(() => validateWorld({ ...world, theme: "background-image:evil" }, users), /Tema/);
  assert.equal(new URL(soloURL({ ...world, theme: "neon" }, users[0].id, users)).searchParams.has("base64css"), false);
});

test("414 regression: even pathological avatars and many members never create an oversized VDO URL", () => {
  const huge = "data:image/webp;base64," + "A".repeat(22000);
  const enormous = participantURL(world, users[0], {}, users, "https://foundry.example/game", huge);
  assert.ok(enormous.length <= 6900);
  assert.equal(new URL(enormous).searchParams.get("avatar"), "default");
  assert.equal(new URL(enormous).searchParams.get("label"), users[0].name);
  const crowd = Array.from({ length: 35 }, (_, i) => ({
    id: "extra" + i, name: "Player " + i, color: "#aa8844"
  }));
  const slots = { ...world.slots };
  for (let i = 0; i < crowd.length; i++) slots[crowd[i].id] = "slot_long_id_" + i.toString().padStart(3, "0");
  const crowded = participantURL({ ...world, slots }, users[0], {}, [...users, ...crowd], "https://foundry.example/game", huge);
  assert.ok(crowded.length <= 6900);
  assert.equal(new URL(crowded).searchParams.get("room"), world.roomId);
  assert.equal(new URL(crowded).searchParams.get("push"), world.slots[users[0].id]);
});

test("sci-fi e neon têm brilho real nas bordas, compartilhado com a prévia", () => {
  for (const style of ["scifi", "neon", "modern", "rustic", "fantasy", "none"]) {
    const sample = themeVisual(style, "#4466dd");
    assert.equal(typeof sample.shadow, "string");
    if (style !== "none") assert.match(themeCSS({ ...world, theme: style }, users), /outline:/);
  }
  assert.match(themeVisual("scifi", "#abcdef").shadow, /0 0 13px #abcdef/);
  assert.match(themeVisual("neon", "#abcdef").shadow, /0 0 22px #abcdef/);
  assert.equal(themeVisual("none", "#abcdef").border, "none");
  assert.throws(() => themeVisual("not-defined", "#abcdef"), /inválido/);
});
test("catálogo avançado contém apenas opções da whitelist e deixa chaves críticas protegidas", () => {
  for (const [key, details] of Object.entries(VDO_OPTIONS)) {
    assert.ok(details.help.length > 40, key);
    assert.ok(details.label);
    assert.doesNotThrow(() => parseExtraQuery(key + "=" + details.sample));
  }
  assert.throws(() => parseExtraQuery("push=stolen"), /não permitido/);
  assert.throws(() => parseExtraQuery("noaudio=0"), /não permitido/);
  assert.throws(() => parseExtraQuery("meterstyle=2"), /não permitido/);
});

test("filtros de microfone são opcionais e não mudam salas legadas Discord", () => {
  const unchanged = structuredClone(world);
  const config = validateWorld(world, users);
  assert.equal(config.audioFilters.preset, "voice");
  assert.equal(config.audioFilters.denoise, true);
  assert.deepEqual(world, unchanged, "A configuração antiga não deve ser alterada");
  const discord = new URL(participantURL(world, users[0], {}, users));
  for (const key of ["denoise", "echocancellation", "autogain", "noisegate", "compressor", "lowcut"]) {
    assert.equal(discord.searchParams.has(key), false, key);
  }
  assert.equal(discord.searchParams.has("noaudio"), true);
});
test("tratamento Voz limpa por padrão no áudio VDO, também para links externos", () => {
  const config = { ...world, audio: "vdo" };
  const url = new URL(participantURL(config, users[0], {}, users));
  assert.equal(url.searchParams.get("denoise"), "1");
  assert.equal(url.searchParams.get("echocancellation"), "1");
  assert.equal(url.searchParams.get("autogain"), "1");
  assert.equal(url.searchParams.has("noisegate"), false);
  assert.equal(url.searchParams.has("compressor"), false);
  assert.equal(url.searchParams.has("lowcut"), false);
  assert.equal(url.searchParams.get("push"), world.slots.gm1);
  assert.equal(url.searchParams.get("label"), users[0].name);
  assert.ok(url.href.length <= 6900);
  const solo = new URL(soloURL(config, users[0].id, users));
  for (const key of ["denoise", "echocancellation", "autogain", "noisegate", "compressor", "lowcut"]) assert.equal(solo.searchParams.has(key), false);
});
test("perfis podem ser desligados, reforçados ou ajustados pelo mestre", () => {
  const raw = { ...world, audio: "vdo" };
  const off = new URL(participantURL({ ...raw, audioFilters: audioFilterPreset("off") }, users[0], {}, users));
  for (const key of ["denoise", "echocancellation", "autogain"]) assert.equal(off.searchParams.get(key), "0");
  assert.equal(off.searchParams.has("noisegate"), false);
  const enhanced = new URL(participantURL({ ...raw, audioFilters: audioFilterPreset("enhanced") }, users[0], {}, users));
  assert.equal(enhanced.searchParams.get("noisegate"), "1");
  assert.equal(enhanced.searchParams.get("compressor"), "1");
  assert.equal(enhanced.searchParams.get("lowcut"), "100");
  const custom = validateAudioFilters({
    preset: "custom", denoise: true, echoCancellation: false,
    autoGain: false, noiseGate: false, compressor: true, lowcutHz: 120
  });
  const url = new URL(participantURL({ ...raw, audioFilters: custom }, users[0], {}, users));
  assert.equal(url.searchParams.get("denoise"), "1");
  assert.equal(url.searchParams.get("echocancellation"), "0");
  assert.equal(url.searchParams.get("autogain"), "0");
  assert.equal(url.searchParams.get("compressor"), "1");
  assert.equal(url.searchParams.get("lowcut"), "120");
  assert.ok(url.href.length <= 6900);
});
test("rejeita configurações de áudio inválidas sem permitir alterar a Room ou o Stream ID", () => {
  assert.throws(() => validateAudioFilters({ preset: "unknown" }), /Preset/);
  assert.throws(() => validateAudioFilters({ preset: "custom", denoise: "on" }), /Filtro/);
  assert.throws(() => validateAudioFilters({ ...audioFilterPreset("voice"), preset: "custom", lowcutHz: 900 }), /Corte/);
  assert.throws(() => validateWorld({ ...world, audioFilters: [] }, users), /Filtros/);
  assert.equal(new URL(participantURL({ ...world, audio: "vdo" }, users[1], {}, users)).searchParams.get("push"), world.slots.p1);
  assert.throws(() => parseExtraQuery("noaudio=1"), /não permitido/);
});

test("convite geral da sala não reaproveita identidade individual e preserva senha", () => {
  const url = new URL(roomInviteURL(world, users));
  assert.equal(url.origin, "https://vdo.ninja");
  assert.equal(url.searchParams.get("room"), world.roomId);
  assert.equal(url.searchParams.get("password"), "Private123");
  assert.equal(url.searchParams.get("audiodevice"), "0");
  assert.equal(url.searchParams.has("noaudio"), true);
  for (const key of ["push", "view", "director", "label", "avatar", "base64css"])
    assert.equal(url.searchParams.has(key), false, key);
  const native = new URL(roomInviteURL({ ...world, audio: "vdo" }, users));
  assert.equal(native.searchParams.has("noaudio"), false);
  assert.equal(native.searchParams.has("audiodevice"), false);
  assert.equal(new URL(roomInviteURL({ ...world, extraQuery: "" }, users)).searchParams.has("password"), false);
  assert.throws(() => roomInviteURL({ ...world, roomId: "" }, users), /Room ID/);
});

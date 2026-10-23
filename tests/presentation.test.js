import test from "node:test";
import assert from "node:assert/strict";
import { normalizePrefs } from "../src/config.js";
import { participantURL, soloURL } from "../src/urls.js";
import { DOCK_PRESENTATIONS, presentationCSS } from "../src/presentation.js";

const gm = { id: "gm", name: "Mestre", isGM: true, avatar: "" };
const world = { roomId: "RoomBeta001", extraQuery: "", audio: "vdo", directorUserId: "", slots: { gm: "slot_master" } };

const decodeCSS = source => {
  const encoded = new URL(source).searchParams.get("base64css");
  return encoded ? decodeURIComponent(atob(encoded)) : "";
};

test("original é padrão por jogador, sempre reversível", () => {
  assert.deepEqual(Object.keys(DOCK_PRESENTATIONS), ["native", "minimal", "adaptive"]);
  assert.equal(normalizePrefs({}).presentation, "native");
  assert.equal(normalizePrefs({ presentation: "invalid" }).presentation, "native");
  assert.equal(normalizePrefs({ presentation: "adaptive" }).presentation, "adaptive");
  assert.equal(presentationCSS("native"), "");
  assert.throws(() => presentationCSS("invalid"), /inválida/);
});

test("cabeçalho compacto é carregado com a sala sem apagar indicadores ou controles", () => {
  const baseline = decodeCSS(participantURL(world, gm, { avatar: "none" }, [gm]));
  const css = decodeCSS(participantURL(world, gm, { avatar: "none", presentation: "minimal" }, [gm]));
  assert.match(css, /#logoname/);
  assert.match(css, /#head2/);
  assert.match(css, /#head5/);
  assert.ok(css.length > baseline.length, "Personalização precisa constar da URL, antes do ingresso");
  assert.doesNotMatch(css, /#controlButtons|#mutebutton|#hangupbutton/);
});

test("adaptativo atinge filhos reais do mosaico e calcula altura no iframe", () => {
  const css = presentationCSS("adaptive");
  assert.match(css, /#gridlayout/);
  assert.match(css, /#gridlayout>\*/);
  assert.match(css, /100dvh/);
  assert.match(css, /100vw/);
  assert.match(css, /:has\(>:nth-child\(6\)\)/);
  assert.match(css, /--rg-count/);
  assert.match(css, /object-fit:contain/);
  assert.doesNotMatch(css, /#controlButtons|#mutebutton|#hangupbutton/);
  assert.equal(presentationCSS("adaptive", { director: true }), "");
});

test("URL nativa e exportações OBS preservadas, apresentações continuam individuais", () => {
  const native = participantURL(world, gm, { avatar: "none" }, [gm]);
  for (const presentation of ["minimal", "adaptive"]) {
    const modified = participantURL(world, gm, { avatar: "none", presentation }, [gm]);
    assert.notEqual(modified, native, "O estilo deve estar presente já no carregamento VDO");
    assert.equal(new URL(modified).searchParams.get("push"), "slot_master");
    assert.ok(modified.length <= 6900);
  }
  const directorWorld = { ...world, directorUserId: "gm" };
  const originalDirector = participantURL(directorWorld, gm, { avatar: "none" }, [gm]);
  const adaptiveDirector = participantURL(directorWorld, gm, { avatar: "none", presentation: "adaptive" }, [gm]);
  assert.equal(originalDirector, adaptiveDirector, "Director mantém interface oficial");
  const obs = soloURL(world, gm.id, [gm]);
  for (const key of ["base64css", "showheader", "push"]) assert.equal(new URL(obs).searchParams.has(key), false);
});

test("URLs lotadas não perdem identidade nem ultrapassam orçamento", () => {
  const extras = Array.from({ length: 22 }, (_, index) => ({
    id: `p${index}`, name: `Pessoa${index}`, color: "#aacc22"
  }));
  const slots = { ...world.slots };
  for (const user of extras) slots[user.id] = `slot_${user.id}`;
  const crowded = { ...world, slots };
  const url = participantURL(crowded, gm, { avatar: "none", presentation: "adaptive" }, [gm, ...extras]);
  assert.ok(url.length <= 6900);
  assert.equal(new URL(url).searchParams.get("push"), "slot_master");
  assert.match(decodeCSS(url), /#gridlayout/, "Layout selecionado prevalece às cores individuais quando necessário");
});

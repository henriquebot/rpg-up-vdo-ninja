import test from "node:test";
import assert from "node:assert/strict";
import { normalizePrefs } from "../src/config.js";
import { participantURL, soloURL } from "../src/urls.js";
import { DOCK_PRESENTATIONS, presentationCSS } from "../src/presentation.js";

const gm = { id: "gm", name: "Mestre", isGM: true, avatar: "" };
const world = {
  roomId: "RoomBeta001", extraQuery: "", audio: "vdo",
  directorUserId: "", slots: { gm: "slot_master" }
};

test("layout experimental é opt-in por usuário e reverte ao VDO original", () => {
  assert.deepEqual(Object.keys(DOCK_PRESENTATIONS), ["native", "minimal", "adaptive"]);
  assert.equal(normalizePrefs({}).presentation, "native");
  assert.equal(normalizePrefs({ presentation: "invalid" }).presentation, "native");
  assert.equal(normalizePrefs({ presentation: "adaptive" }).presentation, "adaptive");
  assert.equal(presentationCSS("native"), "");
  assert.throws(() => presentationCSS("invalid"), /inválida/);
});

test("cabeçalho mínimo conserva o contador nativo e todos os controles", () => {
  const css = presentationCSS("minimal");
  assert.match(css, /#head5/);
  assert.match(css, /#logoname/);
  assert.match(css, /#head2/);
  assert.doesNotMatch(css, /#controlButtons|#mutebutton|#hangupbutton/);
  assert.doesNotMatch(css, /#gridlayout/);
});

test("layout adaptativo respeita o viewport local e o número de vídeos", () => {
  const css = presentationCSS("adaptive");
  assert.match(css, /#gridlayout/);
  assert.match(css, /100dvh/);
  assert.match(css, /100vw/);
  assert.match(css, /:has\(>\.vidcon:nth-child\(5\)\)/);
  assert.match(css, /--rpgup-rows/);
  assert.match(css, /object-fit:contain/);
  assert.doesNotMatch(css, /#controlButtons|#mutebutton|#hangupbutton/);
  assert.equal(presentationCSS("adaptive", { director: true }), "",
    "Diretor conserva sua disposição nativa");
  assert.equal(presentationCSS("minimal", { director: true }), "");
});

test("experimento nunca altera link pessoal, identidade, OBS ou orçamento da URL", () => {
  const native = participantURL(world, gm, { avatar: "none" }, [gm]);
  for (const presentation of ["minimal", "adaptive"]) {
    const source = participantURL(world, gm, { avatar: "none", presentation }, [gm]);
    assert.equal(source, native, "CSS experimental fica fora da URL do VDO");
    assert.equal(new URL(source).searchParams.get("push"), "slot_master");
    assert.ok(source.length <= 6900);
    assert.equal(soloURL(world, gm.id, [gm]), soloURL(world, gm.id, [gm]));
  }
});

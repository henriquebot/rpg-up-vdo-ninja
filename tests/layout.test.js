import test from "node:test";
import assert from "node:assert/strict";
import { parseExtraQuery, validateWorld, DEFAULT_WORLD, dockPosition } from "../src/config.js";
import { participantURL, soloURL, obsExport } from "../src/urls.js";

const users = Array.from({ length: 4 }, (_, index) => ({ id: `u${index}`, name: `Câmera ${index} & +`, isGM: index === 0 }));
const world = { roomId: "LayoutRoom123", extraQuery: "password=Private123&codec=vp9", audio: "discord", directorUserId: "", slots: Object.fromEntries(users.map(user => [user.id, `slot_${user.id}`])) };

test("flags de layout sem valor, cover=2 e whitelist restrita", () => {
  for (const query of ["structure&cover", "&structure=&cover=", "cover=2&structure", "structure", "cover"]) {
    const parsed = parseExtraQuery(query);
    assert.ok(parsed.has("structure") || parsed.has("cover"));
  }
  assert.equal(parseExtraQuery("structure&cover").get("structure"), "");
  assert.equal(parseExtraQuery("structure&cover").get("cover"), "");
  for (const query of ["structure=0", "structure=true", "cover=false", "cover=0", "cover=1", "cover=3", "rows=2", "css=x", "js=x", "scene", "pipme", "minipreview", "cover&cover=2", "structure&structure", "Cover", "cover%26push=x", "password", "fps"]) {
    assert.throws(() => parseExtraQuery(query), query);
  }
});

test("configuração antiga conserva layout nativo; opção compacta é validada", () => {
  assert.equal(DEFAULT_WORLD.roomLayout, "native");
  assert.equal(validateWorld(world, users).roomLayout, "native");
  assert.equal(validateWorld({ ...world, roomLayout: "compact" }, users).roomLayout, "compact");
  for (const roomLayout of ["rows", "constructor", "", "cover", 2]) assert.throws(() => validateWorld({ ...world, roomLayout }, users));
  assert.equal(new URL(participantURL(world, users[0], { avatar: "none" }, users)).searchParams.has("cover"), false);
});

for (let count = 1; count <= 4; count++) {
  for (const dock of ["left", "right", "top", "bottom"]) {
    test(`${count} participantes / dock ${dock}: somente layout da Room muda`, () => {
      const members = users.slice(0, count);
      const base = { ...world, slots: Object.fromEntries(members.map(user => [user.id, world.slots[user.id]])) };
      const before = structuredClone(base);
      const prefs = { dock, avatar: "none" };
      for (const audio of ["discord", "vdo"]) {
        for (const directorUserId of ["", "u0"]) {
          const normal = { ...base, audio, directorUserId };
          for (const choice of [
            { roomLayout: "compact", expected: { cover: "" } },
            { extraQuery: base.extraQuery + "&structure&cover", expected: { structure: "", cover: "" } },
            { roomLayout: "compact", extraQuery: base.extraQuery + "&structure&cover", expected: { structure: "", cover: "" } },
            { roomLayout: "compact", extraQuery: base.extraQuery + "&cover=2", expected: { cover: "2" } }
          ]) {
            const { expected, ...changes } = choice;
            const changed = { ...normal, ...changes };
            for (const user of members) {
              const original = new URL(participantURL(normal, user, prefs, members));
              const next = new URL(participantURL(changed, user, prefs, members));
              for (const [key, value] of Object.entries(expected)) {
                assert.equal(next.searchParams.get(key), value);
                assert.equal(next.searchParams.getAll(key).length, 1);
                next.searchParams.delete(key);
              }
              // Exact equality also protects Room, push, label, audio, Director,
              // previewmode and absence of pipme/minipreview overrides.
              assert.equal(next.href, original.href);
              assert.equal(soloURL(changed, user.id, members), soloURL(normal, user.id, members));
            }
            assert.deepEqual(obsExport(changed, members), obsExport(normal, members));
          }
        }
      }
      assert.deepEqual(base, before, "não mutar IDs/configuração ao gerar URLs");
    });
  }
}


test("iframe mostra sempre o cabeçalho original do VDO; OBS continua com saída limpa", () => {
  const sender = new URL(participantURL(world, users[0], { avatar: "none" }, users));
  assert.equal(sender.searchParams.has("hideheader"), false);
  assert.equal(sender.searchParams.has("showheader"), true);
  assert.equal(sender.searchParams.has("cleanoutput"), false);
  assert.equal(sender.searchParams.get("push"), "slot_u0");
  const viewer = new URL(soloURL(world, "u0", users));
  assert.equal(viewer.searchParams.has("showheader"), false);
  assert.equal(viewer.searchParams.has("hideheader"), false);
  assert.equal(viewer.searchParams.has("cleanoutput"), true);
});

test("dock acoplada toca os quatro cantos sem margens; flutuante mantém distância", () => {
  const viewport = { width: 1440, height: 900 };
  const cases = {
    left: { left: 0, top: 0, height: 900 },
    right: { left: 1000, top: 0, height: 900 },
    top: { left: 0, top: 0, width: 1440 },
    bottom: { left: 0, top: 540, width: 1440 }
  };
  for (const [dock, expected] of Object.entries(cases)) {
    const position = dockPosition({ dock, sideWidth: 440, barHeight: 360 }, viewport);
    for (const [key, value] of Object.entries(expected)) assert.equal(position[key], value, dock + " " + key);
  }
  const floating = dockPosition({ dock: "floating", floating: { width: 720, height: 600, left: 120, top: 80 } }, viewport);
  assert.equal(floating.left, 120);
  assert.equal(floating.top, 80);
});

import test from "node:test";
import assert from "node:assert/strict";
import { canUseDirectAvatar } from "../src/avatar.js";

test("O avatar original requer HTTPS público e CORS válido para VDO", () => {
  assert.equal(canUseDirectAvatar("https://cdn.example/a.webp", "*", "image/webp"), true);
  assert.equal(canUseDirectAvatar("https://foundry.example/a.webp", "https://vdo.ninja", "image/webp"), true);
  assert.equal(canUseDirectAvatar("https://foundry.example/a.webp", null, "image/webp"), false);
  assert.equal(canUseDirectAvatar("https://cdn.example/a.webp", "https://foundry.example", "image/webp"), false);
  assert.equal(canUseDirectAvatar("http://example.com/a.webp", "*", "image/webp"), false);
  assert.equal(canUseDirectAvatar("https://u:p@example.com/a.webp", "*", "image/webp"), false);
  assert.equal(canUseDirectAvatar("https://cdn.example/not-image.js", "*", "text/javascript"), false);
});

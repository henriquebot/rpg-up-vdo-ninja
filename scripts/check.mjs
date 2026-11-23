import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
assert.equal(manifest.id, "rpgup-vdo-ninja");
assert.deepEqual(manifest.compatibility, { minimum: "13", verified: "14", maximum: "14" });
assert.equal(manifest.version, JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).version);
assert.equal(manifest.manifest, "https://raw.githubusercontent.com/henriquebot/rpgup-vdo-ninja/main/module.json");
assert.equal(manifest.download, `https://github.com/henriquebot/rpgup-vdo-ninja/releases/download/v${manifest.version}/rpgup-vdo-ninja.zip`);
for (const entry of [...manifest.esmodules, ...manifest.styles]) await readFile(path.join(root, entry));
const cameraSettingsIcon = await readFile(path.join(root, "assets", "camera-settings.svg"), "utf8");
assert.match(cameraSettingsIcon, /<svg\\b/);
assert.match(await readFile(path.join(root, "styles", "module.css"), "utf8"), /camera-settings\\.svg/);
for (const dir of ["src", "scripts", "tests"]) {
  for (const file of await readdir(path.join(root, dir))) {
    if (!/\.m?js$/.test(file)) continue;
    const result = spawnSync(process.execPath, ["--check", path.join(root, dir, file)], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
}
console.log("Manifest, referências e sintaxe JavaScript: OK.");

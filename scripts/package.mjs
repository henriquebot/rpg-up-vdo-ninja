import { cp, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = path.join(root, "dist", "rpgup-vdo-ninja");
await mkdir(target, { recursive: true });
for (const name of ["module.json", "src", "styles", "assets", "README.md", "docs"]) {
  await cp(path.join(root, name), path.join(target, name), { recursive: true });
}
const manifest = JSON.parse(await readFile(path.join(target, "module.json"), "utf8"));
console.log(`Módulo ${manifest.version}: ${target}`);
console.log("Copie a pasta rpgup-vdo-ninja para Data/modules e habilite RPGUP VDO.Ninja no World.");

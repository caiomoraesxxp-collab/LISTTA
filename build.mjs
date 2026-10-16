import { cp, mkdir, rm } from "node:fs/promises";

const files = ["index.html", "app.js", "style.css", "manifest.json", "sw.js"];
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const file of files) await cp(file, `dist/${file}`);
console.log("LISTTA: arquivos estáticos copiados para dist/.");

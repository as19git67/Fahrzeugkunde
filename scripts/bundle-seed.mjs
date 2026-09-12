/**
 * Bündelt die Seed-Logik (src/db/seed-data.ts + seed-hlf20.ts) zu einem
 * einzelnen CommonJS-Modul: dist/seed-data.cjs.
 *
 * Warum: startup.js (CommonJS, läuft im Standalone-Image ohne tsx und ohne
 * TypeScript-Quellen) soll beim ersten Start das KOMPLETTE Demo-Fahrzeug
 * anlegen – mit derselben Logik wie `npm run db:seed` und der Reset-Seed-
 * Route. Ein zweites, handgeschriebenes JS-Seed wäre eine Zweitschrift, die
 * auseinanderläuft.
 *
 * Läuft als Teil von `npm run build` (siehe package.json) und einzeln als
 * `npm run bundle:seed`.
 */
import { build } from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: ["src/db/seed-data.ts"],
  outfile: "dist/seed-data.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  // seed-data importiert von `pg` nur Typen; zur Laufzeit stellt der
  // Aufrufer (startup.js) den Client.
  external: ["pg"],
  logLevel: "info",
});

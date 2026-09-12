/**
 * Konsistenz der Deploy-Konfiguration für die Backup-/Restore-Kette.
 *
 * Hintergrund: Das App-Image hatte postgresql-client-16, während DB und
 * Backup-Sidecar mit Postgres 18 liefen – pg_restore 16 kann Archive von
 * pg_dump 18 nicht lesen. Außerdem war das backups-Volume nur im Sidecar
 * gemountet, sodass startup.js den Restore-Trigger nie finden konnte. Beides
 * fällt erst beim Ernstfall auf; dieser Test fängt es vorher.
 *
 * Braucht keine Datenbank – läuft immer.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (...segs: string[]) =>
  fs.readFileSync(path.join(process.cwd(), ...segs), "utf8");

function majorOf(text: string, re: RegExp, label: string): number {
  const m = text.match(re);
  if (!m) throw new Error(`${label}: Postgres-Version nicht gefunden (${re})`);
  return Number(m[1]);
}

describe("Deploy-Konfiguration: Backup-/Restore-Kette", () => {
  const dockerfile = read("Dockerfile");
  const compose = read("docker-compose.yml");
  const sidecar = read("scripts", "backup", "Dockerfile");
  const startup = read("startup.js");

  it("Postgres-Major-Version ist in App-Image, DB-Image und Backup-Sidecar identisch", () => {
    const client = majorOf(dockerfile, /postgresql-client-(\d+)/, "Dockerfile");
    const db = majorOf(compose, /image:\s*postgres:(\d+)/, "docker-compose.yml");
    const dump = majorOf(sidecar, /FROM\s+postgres:(\d+)/, "scripts/backup/Dockerfile");
    expect({ client, dump }).toEqual({ client: db, dump: db });
  });

  it("der App-Container mountet /backups, wo startup.js den Restore-Trigger sucht", () => {
    const trigger = startup.match(/RESTORE_TRIGGER = "([^"]+)"/)?.[1];
    expect(trigger).toBe("/backups/restore.backup");

    // app-Service-Block ausschneiden: ab "  app:" bis zum nächsten Service auf
    // derselben Einrückung.
    const appBlock = compose.match(/^  app:\n([\s\S]*?)(?=^  [\w-]+:\s*$)/m)?.[1];
    expect(appBlock, "app-Service in docker-compose.yml").toBeTruthy();
    expect(appBlock).toMatch(/^\s+-\s+backups:\/backups\s*$/m);
    // …und das Volume ist definiert
    expect(compose).toMatch(/^  backups:\s*$/m);
  });

  it("CI-Workflow: Lint vor Tests, Concurrency-Schutz, kein Publish für Fork-PRs", () => {
    const wf = read(".github", "workflows", "docker-image.yml");
    expect(wf).toMatch(/^concurrency:\n\s+group: .*\n\s+cancel-in-progress: true/m);
    const lintAt = wf.indexOf("run: npm run lint");
    const testAt = wf.indexOf("run: npm test");
    expect(lintAt).toBeGreaterThan(-1);
    expect(testAt).toBeGreaterThan(lintAt);
    expect(wf).toMatch(/run: npm ci/);
    // Login/Push/Deploy nur, wenn der PR aus diesem Repo kommt
    expect(wf).toMatch(/CAN_PUBLISH: .*head\.repo\.full_name == github\.repository/);
    for (const step of ["Log in to the container registry", "Build and push Docker image", "Deploy to TrueNAS \\(test\\)"]) {
      const block = wf.slice(wf.indexOf(`- name: ${step.replace(/\\/g, "")}`));
      expect(block.slice(0, 200), step).toMatch(/env\.CAN_PUBLISH == 'true'/);
    }
  });

  it("das Seed-Bundle wird gebaut und ins Image kopiert", () => {
    // startup.js braucht dist/seed-data.cjs fuer den Voll-Seed beim Start.
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts.build).toMatch(/bundle-seed\.mjs/);
    expect(dockerfile).toMatch(/COPY --from=builder[^\n]*\/app\/dist\/seed-data\.cjs \.\/dist\/seed-data\.cjs/);
  });
});

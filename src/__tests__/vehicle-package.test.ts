/**
 * Unit-Tests für die Paket-Helper in src/lib/vehicle-package.ts.
 *
 * Braucht keine Datenbank – testet nur die pure Logik (Pfad-Auflösung,
 * Slug-Erzeugung, Paket-Aufbau und Parser-Validierungen).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import {
  buildPackageZip,
  collectReferencedAssetPaths,
  generateUploadFilename,
  MAX_PACKAGE_ASSET_BYTES,
  PACKAGE_ASSET_PREFIX,
  PACKAGE_MAGIC,
  PACKAGE_SCHEMA_VERSION,
  PackageValidationError,
  readPackageZip,
  resolveTargetForAsset,
  resolveUploadFsPath,
  safeExtFromPath,
  slugifyName,
  uploadPathToPackagePath,
  UPLOAD_DIR,
  validatePackageAssets,
  type PackageManifest,
  type PackageVehicle,
} from "@/lib/vehicle-package";
import { createZip } from "@/lib/zip";

describe("slugifyName", () => {
  it("erzeugt dateisystemsichere Slugs aus deutschen Umlauten", () => {
    expect(slugifyName("HLF 20/16")).toBe("hlf-20-16");
    expect(slugifyName("Drehleiter DLK 23/12")).toBe("drehleiter-dlk-23-12");
    expect(slugifyName("Löschzug München")).toBe("loeschzug-muenchen");
    expect(slugifyName("Übergabe süß")).toBe("uebergabe-suess");
  });

  it("fällt auf 'vehicle' zurück, wenn der Name nur aus Sonderzeichen besteht", () => {
    expect(slugifyName("!!!###")).toBe("vehicle");
    expect(slugifyName("")).toBe("vehicle");
  });

  it("kürzt extrem lange Namen auf 64 Zeichen", () => {
    const slug = slugifyName("x".repeat(500));
    expect(slug.length).toBe(64);
  });
});

describe("safeExtFromPath", () => {
  it("extrahiert gängige Bildendungen", () => {
    expect(safeExtFromPath("assets/items/foo.jpg")).toBe("jpg");
    expect(safeExtFromPath("assets/items/foo.PNG")).toBe("png");
    expect(safeExtFromPath("views/hlf_left.svg")).toBe("svg");
  });

  it("fällt auf 'bin' zurück bei unbekannter oder fehlender Endung", () => {
    expect(safeExtFromPath("foo")).toBe("bin");
    expect(safeExtFromPath("assets/weird.verylongthing")).toBe("bin");
    expect(safeExtFromPath("foo.")).toBe("bin");
  });
});

describe("generateUploadFilename", () => {
  it("liefert eindeutige Namen mit der angegebenen Endung", () => {
    const a = generateUploadFilename("jpg");
    const b = generateUploadFilename("jpg");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^\d+_[a-z0-9]+\.jpg$/);
  });
});

describe("uploadPathToPackagePath / resolveUploadFsPath", () => {
  it("wandelt /api/uploads-Pfade korrekt in Paket-Pfade um", () => {
    expect(uploadPathToPackagePath("/api/uploads/items/foo.jpg")).toBe(
      "assets/items/foo.jpg"
    );
    expect(uploadPathToPackagePath("/uploads/items/seed/x.svg")).toBe(
      "assets/items/seed/x.svg"
    );
  });

  it("gibt null bei externen URLs zurück", () => {
    expect(uploadPathToPackagePath("https://example.com/x.jpg")).toBeNull();
    expect(resolveUploadFsPath("https://example.com/x.jpg")).toBeNull();
    expect(resolveUploadFsPath(null)).toBeNull();
    expect(resolveUploadFsPath("")).toBeNull();
  });

  it("verhindert Directory-Traversal", () => {
    expect(resolveUploadFsPath("/api/uploads/../secret.txt")).toBeNull();
    expect(resolveUploadFsPath("/api/uploads/items/../../etc/passwd")).toBeNull();
    expect(resolveUploadFsPath("/api/uploads//absolute")).toBeNull();
  });

  it("löst einen gültigen Upload-Pfad in einen Pfad unterhalb des Upload-Ordners auf", () => {
    const resolved = resolveUploadFsPath("/api/uploads/items/foo.jpg");
    expect(resolved).not.toBeNull();
    expect(resolved!.startsWith(UPLOAD_DIR)).toBe(true);
    expect(resolved!.endsWith(path.join("items", "foo.jpg"))).toBe(true);
  });
});

describe("collectReferencedAssetPaths", () => {
  it("sammelt alle asset/-Pfade aus einem Fahrzeug-Baum", () => {
    const vehicle: PackageVehicle = {
      name: "T", description: null,
      views: [
        {
          side: "left", label: "Links", imagePath: "assets/views/l.svg", sortOrder: 0,
          compartments: [
            {
              label: "G1", imagePath: "assets/items/c.svg", sortOrder: 0,
              hotspotX: null, hotspotY: null, hotspotW: null, hotspotH: null,
              positions: [
                {
                  label: "oben", sortOrder: 0,
                  hotspotX: null, hotspotY: null, hotspotW: null, hotspotH: null,
                  boxes: [
                    {
                      label: "Kiste", imagePath: "assets/items/k.svg", sortOrder: 0,
                      hotspotX: null, hotspotY: null, hotspotW: null, hotspotH: null,
                      items: [
                        { name: "A", article: null,
                          imagePath: "assets/items/a.svg", locationImagePath: "assets/items/al.svg",
                          silhouettePath: "assets/items/as.svg",
                          difficulty: 1 },
                      ],
                    },
                  ],
                  items: [
                    { name: "B", article: null,
                      imagePath: "assets/items/b.svg", locationImagePath: null,
                      silhouettePath: null,
                      difficulty: 1 },
                    // Externe URL, darf NICHT im Set landen:
                    { name: "Ext", article: null,
                      imagePath: "https://example.com/x.jpg", locationImagePath: null,
                      silhouettePath: null,
                      difficulty: 1 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const refs = collectReferencedAssetPaths(vehicle);
    expect(refs).toEqual(
      new Set([
        "assets/views/l.svg",
        "assets/items/c.svg",
        "assets/items/k.svg",
        "assets/items/a.svg",
        "assets/items/al.svg",
        "assets/items/as.svg",
        "assets/items/b.svg",
      ])
    );
  });
});

describe("buildPackageZip + readPackageZip", () => {
  let tmpDir: string;
  let imgA: string;
  let imgB: string;
  const dataA = Buffer.from("Image A bytes", "utf8");
  const dataB = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // fake PNG header

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fzk-test-"));
    imgA = path.join(tmpDir, "a.txt");
    imgB = path.join(tmpDir, "b.bin");
    await fs.writeFile(imgA, dataA);
    await fs.writeFile(imgB, dataB);
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("erzeugt ein Paket mit korrektem Manifest und liest es wieder ein", async () => {
    const vehicle: PackageVehicle = {
      name: "HLF Test",
      description: "nur zum Testen",
      views: [
        {
          side: "left", label: "Links", imagePath: "assets/items/a.txt", sortOrder: 0,
          compartments: [],
        },
      ],
    };
    const assetFiles = new Map<string, string>([
      ["assets/items/a.txt", imgA],
      ["assets/items/b.bin", imgB],
    ]);

    const zipBuf = await buildPackageZip({ vehicle, assetFiles });
    const parsed = readPackageZip(zipBuf);

    expect(parsed.manifest.magic).toBe(PACKAGE_MAGIC);
    expect(parsed.manifest.schemaVersion).toBe(PACKAGE_SCHEMA_VERSION);
    expect(parsed.manifest.vehicle.name).toBe("HLF Test");
    expect(parsed.manifest.vehicle.description).toBe("nur zum Testen");
    // Beide Assets sind im Paket und im Manifest aufgeführt
    expect(parsed.assets.size).toBe(2);
    expect(parsed.assets.get("assets/items/a.txt")?.equals(dataA)).toBe(true);
    expect(parsed.assets.get("assets/items/b.bin")?.equals(dataB)).toBe(true);
    expect(Object.keys(parsed.manifest.assetChecksums)).toHaveLength(2);
    expect(parsed.vehicle.name).toBe("HLF Test");
  });
});

describe("readPackageZip: Validierung", () => {
  function fakeManifest(overrides: Partial<PackageManifest>): PackageManifest {
    return {
      magic: PACKAGE_MAGIC,
      schemaVersion: PACKAGE_SCHEMA_VERSION,
      appName: "fahrzeugkunde",
      exportedAt: new Date().toISOString(),
      vehicle: { name: "X", description: null },
      assetChecksums: {},
      ...overrides,
    };
  }

  function emptyVehicle(): PackageVehicle {
    return { name: "X", description: null, views: [] };
  }

  function buildZipWith(
    manifest: unknown,
    vehicle: unknown,
    extra: { name: string; data: Buffer }[] = []
  ): Buffer {
    return createZip([
      { name: "manifest.json", data: Buffer.from(JSON.stringify(manifest)) },
      { name: "vehicle.json", data: Buffer.from(JSON.stringify(vehicle)) },
      ...extra,
    ]);
  }

  it("wirft bei fehlendem manifest.json", () => {
    const buf = createZip([
      { name: "vehicle.json", data: Buffer.from("{}") },
    ]);
    expect(() => readPackageZip(buf)).toThrow(PackageValidationError);
    expect(() => readPackageZip(buf)).toThrow(/manifest\.json fehlt/);
  });

  it("wirft bei fehlendem vehicle.json", () => {
    const buf = createZip([
      { name: "manifest.json", data: Buffer.from(JSON.stringify(fakeManifest({}))) },
    ]);
    expect(() => readPackageZip(buf)).toThrow(/vehicle\.json fehlt/);
  });

  it("wirft bei ungültiger Magic", () => {
    const manifest = fakeManifest({ magic: "etwas-anderes" as unknown as typeof PACKAGE_MAGIC });
    const buf = buildZipWith(manifest, emptyVehicle());
    expect(() => readPackageZip(buf)).toThrow(/nicht aus Fahrzeugkunde/);
  });

  it("wirft bei nicht unterstützter Schema-Version", () => {
    const manifest = fakeManifest({ schemaVersion: 99 });
    const buf = buildZipWith(manifest, emptyVehicle());
    expect(() => readPackageZip(buf)).toThrow(/Paket-Version/);
  });

  it("wirft, wenn ein referenziertes Asset nicht im ZIP enthalten ist", () => {
    const manifest = fakeManifest({
      assetChecksums: { "assets/items/missing.jpg": "deadbeef" },
    });
    const buf = buildZipWith(manifest, emptyVehicle());
    expect(() => readPackageZip(buf)).toThrow(/referenziertes Asset fehlt/);
  });

  it("wirft bei manipulierten Asset-Daten (Checksum-Mismatch)", async () => {
    // Manifest behauptet eine bestimmte Checksum, aber die Daten wurden danach verändert.
    const realData = Buffer.from("echte Daten", "utf8");
    const crypto = await import("node:crypto");
    const hash = crypto.createHash("sha256").update(realData).digest("hex");
    const manifest = fakeManifest({
      assetChecksums: { "assets/items/ok.bin": hash },
    });
    const tampered = Buffer.from("manipuliert!!", "utf8");
    const buf = buildZipWith(manifest, emptyVehicle(), [
      { name: "assets/items/ok.bin", data: tampered },
    ]);
    expect(() => readPackageZip(buf)).toThrow(/Checksum stimmt nicht/);
  });

  it("wirft bei ungültigem Asset-Pfad mit .. (Directory-Traversal)", async () => {
    // Checksum stimmt, aber der Pfad ist verboten.
    const data = Buffer.from("x", "utf8");
    const crypto = await import("node:crypto");
    const hash = crypto.createHash("sha256").update(data).digest("hex");
    const manifest = fakeManifest({
      assetChecksums: { "assets/../bad.bin": hash },
    });
    const buf = buildZipWith(manifest, emptyVehicle(), [
      { name: "assets/../bad.bin", data },
    ]);
    expect(() => readPackageZip(buf)).toThrow(/Ungültiger Asset-Pfad/);
  });

  it("ignoriert Einträge außerhalb von assets/ stillschweigend", async () => {
    const manifest = fakeManifest({});
    const buf = buildZipWith(manifest, emptyVehicle(), [
      { name: "README.txt", data: Buffer.from("irrelevant") },
    ]);
    const parsed = readPackageZip(buf);
    expect(parsed.assets.size).toBe(0);
  });
});

describe("validatePackageAssets", () => {
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const SVG_OK = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
  const SVG_BAD = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

  it("akzeptiert Raster- und saubere SVG-Assets mit passender Endung", () => {
    const assets = new Map<string, Buffer>([
      ["assets/items/a.png", PNG],
      ["assets/items/b.jpeg", JPG],
      ["assets/items/c.JPG", JPG],
      ["assets/views/v.svg", SVG_OK],
    ]);
    expect(() => validatePackageAssets(assets)).not.toThrow();
  });

  it("wirft, wenn die Endung nicht zum Inhalt passt", () => {
    const assets = new Map([["assets/items/a.jpg", PNG]]);
    expect(() => validatePackageAssets(assets)).toThrow(PackageValidationError);
    expect(() => validatePackageAssets(assets)).toThrow(/Dateiendung passt nicht zum Inhalt \(png\)/);
  });

  it("wirft bei Nicht-Bildern – auch mit Bild-Endung", () => {
    expect(() =>
      validatePackageAssets(new Map([["assets/items/x.html", Buffer.from("<html>")]]))
    ).toThrow(/kein unterstütztes Bild/);
    expect(() =>
      validatePackageAssets(new Map([["assets/items/x.png", Buffer.from("<html>")]]))
    ).toThrow(/kein unterstütztes Bild/);
  });

  it("wirft bei SVG mit Script", () => {
    expect(() =>
      validatePackageAssets(new Map([["assets/items/x.svg", SVG_BAD]]))
    ).toThrow(/unzulässigen Inhalt \(<script>\)/);
  });

  it("prüft nur die übergebenen Pfade und meldet fehlende", () => {
    const assets = new Map([
      ["assets/items/ok.png", PNG],
      ["assets/items/bad.svg", SVG_BAD],
    ]);
    expect(() => validatePackageAssets(assets, ["assets/items/ok.png"])).not.toThrow();
    expect(() => validatePackageAssets(assets, ["assets/items/fehlt.png"])).toThrow(/fehlt im Paket/);
  });

  it("wirft bei zu großen Assets", () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_PACKAGE_ASSET_BYTES)]);
    expect(() =>
      validatePackageAssets(new Map([["assets/items/big.png", big]]))
    ).toThrow(/zu groß/);
  });
});

describe("resolveTargetForAsset", () => {
  it("behält Unterordner bei und generiert einen neuen Dateinamen", () => {
    const t = resolveTargetForAsset("assets/items/foo.jpg");
    expect(t?.relFolder).toBe("items");
    expect(t?.relPath).toMatch(/^items\/\d+_[a-z0-9]+\.jpg$/);
    expect(t?.absPath.startsWith(path.join(UPLOAD_DIR, "items") + path.sep)).toBe(true);
  });

  it("legt Paket-Assets aus seed/-Ordnern NIE wieder in seed/ ab", () => {
    // Die kuratierten Seed-Ordner werden beim Start aus dem Image gespiegelt –
    // eine Import-Kopie dort wäre beim nächsten Neustart weg.
    expect(resolveTargetForAsset("assets/items/seed/axt.svg")?.relFolder).toBe("items");
    expect(resolveTargetForAsset("assets/views/seed/hlf_left.svg")?.relFolder).toBe("views");
    expect(resolveTargetForAsset("assets/views/seed/hlf_left.svg")?.relPath).toMatch(
      /^views\/\d+_[a-z0-9]+\.svg$/
    );
    // nur "seed" ohne echten Ordner ist ungültig
    expect(resolveTargetForAsset("assets/seed/x.svg")).toBeNull();
  });

  it("lehnt Pfade ohne Ordner, ohne Prefix oder mit bösartigen Segmenten ab", () => {
    expect(resolveTargetForAsset("assets/x.jpg")).toBeNull();
    expect(resolveTargetForAsset("items/x.jpg")).toBeNull();
    expect(resolveTargetForAsset("assets/../x.jpg")).toBeNull();
    expect(resolveTargetForAsset("assets/it ems/x.jpg")).toBeNull();
    expect(resolveTargetForAsset("assets/items\\evil/x.jpg")).toBeNull();
  });
});

describe("readPackageZip: Pfad-Prefix-Konstanten", () => {
  it("PACKAGE_ASSET_PREFIX endet mit '/'", () => {
    // Stellt sicher, dass split / join-Operationen nicht auf Randfällen stolpern.
    expect(PACKAGE_ASSET_PREFIX.endsWith("/")).toBe(true);
  });
});

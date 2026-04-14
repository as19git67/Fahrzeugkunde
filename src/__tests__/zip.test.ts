/**
 * Unit-Tests für die minimale ZIP-Implementierung in src/lib/zip.ts.
 *
 * Braucht keine Datenbank – läuft immer.
 */
import { describe, it, expect } from "vitest";
import { createZip, readZip } from "@/lib/zip";
import { deflateRawSync } from "node:zlib";

describe("zip: createZip + readZip round-trip", () => {
  it("liest einen einzigen Eintrag korrekt zurück", () => {
    const buf = createZip([{ name: "hello.txt", data: Buffer.from("Hallo Welt") }]);
    const [entry] = readZip(buf);
    expect(entry.name).toBe("hello.txt");
    expect(entry.data.toString("utf8")).toBe("Hallo Welt");
  });

  it("behält Reihenfolge und Inhalt mehrerer Einträge", () => {
    const entries = [
      { name: "manifest.json", data: Buffer.from('{"ok":true}') },
      { name: "assets/a.bin", data: Buffer.from([1, 2, 3, 4, 5]) },
      { name: "assets/b.bin", data: Buffer.from([0xff, 0xee, 0xdd]) },
    ];
    const buf = createZip(entries);
    const parsed = readZip(buf);
    expect(parsed.map((e) => e.name)).toEqual(entries.map((e) => e.name));
    for (let i = 0; i < entries.length; i++) {
      expect(parsed[i].data.equals(entries[i].data)).toBe(true);
    }
  });

  it("unterstützt UTF-8-Dateinamen (Umlaute, Emojis)", () => {
    const name = "assets/ünîcode-🚒.txt";
    const data = Buffer.from("äöüß – Fahrzeugkunde", "utf8");
    const buf = createZip([{ name, data }]);
    const [entry] = readZip(buf);
    expect(entry.name).toBe(name);
    expect(entry.data.toString("utf8")).toBe("äöüß – Fahrzeugkunde");
  });

  it("schreibt ein leeres Archiv, wenn keine Einträge angegeben sind", () => {
    const buf = createZip([]);
    // EOCD ist 22 Bytes – ein leeres Archiv besteht nur daraus.
    expect(buf.length).toBe(22);
    expect(readZip(buf)).toEqual([]);
  });

  it("verarbeitet binäre Nullbytes innerhalb der Daten", () => {
    const data = Buffer.from([0, 0, 0, 42, 0, 0, 255, 0]);
    const buf = createZip([{ name: "binary.bin", data }]);
    const [entry] = readZip(buf);
    expect(entry.data.equals(data)).toBe(true);
  });
});

describe("zip: Fehlerbehandlung", () => {
  it("wirft, wenn das Archiv kein EOCD enthält", () => {
    const garbage = Buffer.from("das ist kein ZIP");
    expect(() => readZip(garbage)).toThrow(/End-of-Central-Directory/);
  });

  it("wirft, wenn CRC32 nach Manipulation nicht mehr passt", () => {
    const buf = createZip([{ name: "a.txt", data: Buffer.from("abcdef") }]);
    // Manipulation: erstes Byte der Nutzdaten (Position 30 + Länge von "a.txt" = 35) verändern.
    const manipulated = Buffer.from(buf);
    manipulated[35] = manipulated[35] ^ 0xff;
    expect(() => readZip(manipulated)).toThrow(/CRC32/);
  });

  it("wirft bei Backslashes im Eintragsnamen", () => {
    expect(() =>
      createZip([{ name: "bad\\name.txt", data: Buffer.from("x") }])
    ).toThrow(/Backslashes/);
  });
});

describe("zip: Kompatibilität mit DEFLATE beim Lesen", () => {
  /**
   * Wir erzeugen ein Minimal-ZIP mit einem DEFLATE-Eintrag von Hand, um zu
   * prüfen, dass `readZip` auch solche Archive (z. B. von externen Tools)
   * öffnen kann.
   */
  function buildDeflateZip(name: string, raw: Buffer): Buffer {
    const nameBuf = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(raw);
    // CRC32 der ORIGINAL-Daten – via Node zlib.crc32
    const { crc32 } = require("node:zlib");
    const crc = crc32(raw);

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0x0800, 6);
    lfh.writeUInt16LE(8, 8); // DEFLATE
    lfh.writeUInt16LE(0, 10);
    lfh.writeUInt16LE(0, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(compressed.length, 18);
    lfh.writeUInt32LE(raw.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0x0800, 8);
    cdh.writeUInt16LE(8, 10);
    cdh.writeUInt16LE(0, 12);
    cdh.writeUInt16LE(0, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(compressed.length, 20);
    cdh.writeUInt32LE(raw.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(0, 42);

    const localSize = 30 + nameBuf.length + compressed.length;
    const centralSize = 46 + nameBuf.length;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(centralSize, 12);
    eocd.writeUInt32LE(localSize, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([lfh, nameBuf, compressed, cdh, nameBuf, eocd]);
  }

  it("liest einen DEFLATE-komprimierten Eintrag", () => {
    const payload = Buffer.from("hallo ".repeat(200), "utf8");
    const zipBuf = buildDeflateZip("text.txt", payload);
    const [entry] = readZip(zipBuf);
    expect(entry.name).toBe("text.txt");
    expect(entry.data.equals(payload)).toBe(true);
  });
});

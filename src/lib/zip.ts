/**
 * Minimaler ZIP-Reader/-Writer, STORE-Methode (keine Kompression).
 *
 * Für das Fahrzeug-Paket-Format ausreichend:
 *  - Bilder (JPG/PNG/WebP) sind bereits komprimiert → STORE ist ideal.
 *  - Die Struktur-JSON ist klein → kein relevanter Gewinn durch DEFLATE.
 *
 * Vorteil: keine zusätzliche npm-Abhängigkeit, keine Transitiv-Deps.
 *
 * Implementiert nur die ZIP-Felder, die wir schreiben bzw. erwarten:
 *  - Local File Header (Signatur 0x04034b50)
 *  - Central Directory Header (Signatur 0x02014b50)
 *  - End of Central Directory Record (Signatur 0x06054b50)
 *
 * ZIP64, verschlüsselte Archive, mehrteilige Archive und Kompression werden
 * bewusst nicht unterstützt. Filenames > 65535 Bytes oder Dateien > 4 GiB
 * werden abgelehnt.
 */
import { crc32, inflateRawSync } from "node:zlib";

export interface ZipEntry {
  /** Pfad im Archiv, z. B. "assets/items/foo.jpg". Nur Forward-Slashes. */
  name: string;
  data: Buffer;
}

const SIG_LFH = 0x04034b50;
const SIG_CDH = 0x02014b50;
const SIG_EOCD = 0x06054b50;

function ensureZipCompatible(entry: ZipEntry): void {
  const nameBytes = Buffer.byteLength(entry.name, "utf8");
  if (nameBytes === 0 || nameBytes > 0xffff) {
    throw new Error(`ZIP-Eintrag hat ungültige Namenslänge: ${entry.name}`);
  }
  if (entry.data.length > 0xffffffff) {
    throw new Error(`ZIP-Eintrag zu groß (max 4 GiB): ${entry.name}`);
  }
  if (entry.name.includes("\\")) {
    throw new Error(`ZIP-Eintrag darf keine Backslashes enthalten: ${entry.name}`);
  }
}

/**
 * Erzeugt ein ZIP-Archiv im STORE-Modus aus den gegebenen Einträgen.
 * Die Reihenfolge der Einträge im Archiv entspricht der übergebenen Reihenfolge.
 */
export function createZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    ensureZipCompatible(entry);
    const nameBuf = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // Local File Header
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(SIG_LFH, 0);
    lfh.writeUInt16LE(20, 4); // version needed
    lfh.writeUInt16LE(0x0800, 6); // flags: bit 11 = UTF-8 filenames
    lfh.writeUInt16LE(0, 8); // compression: STORE
    lfh.writeUInt16LE(0, 10); // mod time
    lfh.writeUInt16LE(0, 12); // mod date
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(size, 18); // compressed size
    lfh.writeUInt32LE(size, 22); // uncompressed size
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28); // extra length

    localParts.push(lfh, nameBuf, entry.data);

    // Central Directory Header
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(SIG_CDH, 0);
    cdh.writeUInt16LE(20, 4); // version made by
    cdh.writeUInt16LE(20, 6); // version needed
    cdh.writeUInt16LE(0x0800, 8); // flags
    cdh.writeUInt16LE(0, 10); // compression
    cdh.writeUInt16LE(0, 12); // mod time
    cdh.writeUInt16LE(0, 14); // mod date
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(size, 20);
    cdh.writeUInt32LE(size, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30); // extra length
    cdh.writeUInt16LE(0, 32); // comment length
    cdh.writeUInt16LE(0, 34); // disk number
    cdh.writeUInt16LE(0, 36); // internal attrs
    cdh.writeUInt32LE(0, 38); // external attrs
    cdh.writeUInt32LE(offset, 42); // local header offset

    centralParts.push(cdh, nameBuf);

    offset += 30 + nameBuf.length + size;
  }

  const centralSize = centralParts.reduce((a, b) => a + b.length, 0);
  const centralOffset = offset;

  // End of Central Directory Record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // cd disk
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

/**
 * Liest alle Einträge aus einem ZIP-Archiv im STORE-Modus. Unterstützt
 * zusätzlich DEFLATE-Einträge (Code 8) via `zlib.inflateRawSync`, falls jemand
 * ein extern erstelltes Paket importiert.
 */
export function readZip(buf: Buffer): ZipEntry[] {
  // EOCD suchen: rückwärts vom Ende nach Signatur.
  let eocdOffset = -1;
  const minEocd = 22;
  const maxCommentLen = 0xffff;
  const searchStart = Math.max(0, buf.length - minEocd - maxCommentLen);
  for (let i = buf.length - minEocd; i >= searchStart; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error("Ungültiges ZIP: End-of-Central-Directory nicht gefunden");
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdSize = buf.readUInt32LE(eocdOffset + 12);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  if (cdOffset + cdSize > buf.length) {
    throw new Error("Ungültiges ZIP: Central Directory außerhalb des Buffers");
  }

  const entries: ZipEntry[] = [];
  let p = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(p) !== SIG_CDH) {
      throw new Error("Ungültiges ZIP: Central Directory Header beschädigt");
    }
    const compression = buf.readUInt16LE(p + 10);
    const crcExpected = buf.readUInt32LE(p + 16);
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const lhOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;

    // Local File Header parsen (enthält evtl. abweichende extra-Längen)
    if (buf.readUInt32LE(lhOffset) !== SIG_LFH) {
      throw new Error(`Ungültiges ZIP: Local File Header für ${name} fehlt`);
    }
    const lfhNameLen = buf.readUInt16LE(lhOffset + 26);
    const lfhExtraLen = buf.readUInt16LE(lhOffset + 28);
    const dataStart = lhOffset + 30 + lfhNameLen + lfhExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buf.length) {
      throw new Error(`Ungültiges ZIP: Daten für ${name} abgeschnitten`);
    }
    const compressed = buf.subarray(dataStart, dataEnd);

    let data: Buffer;
    if (compression === 0) {
      data = Buffer.from(compressed);
    } else if (compression === 8) {
      // DEFLATE (für importierte Pakete von anderen Tools)
      data = inflateRawSync(compressed);
    } else {
      throw new Error(`Nicht unterstützte ZIP-Kompression ${compression} für ${name}`);
    }

    if (data.length !== uncompressedSize) {
      throw new Error(`Ungültiges ZIP: Größen-Mismatch für ${name}`);
    }
    if (crc32(data) !== crcExpected) {
      throw new Error(`Ungültiges ZIP: CRC32-Fehler für ${name}`);
    }

    entries.push({ name, data });
  }

  return entries;
}

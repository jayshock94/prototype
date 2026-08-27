/**
 * A minimal ZIP writer.
 *
 * Hand-written rather than a dependency, because what this needs is the
 * smallest corner of the format: two or three small files, names we generate
 * ourselves, and no directory tricks. That is about a hundred lines, and it
 * keeps package.json where CLAUDE.md wants it.
 *
 * Deliberate limits, all of which hold for a feedback export and none of which
 * are checked at runtime:
 *
 *  - No ZIP64. Entries and the archive must stay under 4 GB.
 *  - No more than 65,535 entries.
 *  - Filenames are written as UTF-8 with the language-encoding flag set, which
 *    every unzip made this century understands -- but keep them to plain ASCII
 *    anyway (see `slug` in export-report.ts) so nothing has to.
 *
 * If a later chunk needs more than this -- an export big enough for ZIP64, say
 * -- swap in a real library rather than growing this file.
 */

import "server-only";

import { deflateRawSync } from "node:zlib";

export interface ZipEntry {
  /** Path inside the archive. Forward slashes, no leading slash. */
  name: string;
  data: Buffer | string;
}

/**
 * CRC-32, the checksum every ZIP entry carries.
 *
 * Written out rather than taken from node:zlib, whose `crc32` only arrived in
 * Node 22. Vercel decides which runtime this lands on, and a build that works
 * here and throws in production is exactly the failure mode worth avoiding.
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS packed date and time, which is what the format stores. */
function dosStamp(date: Date): { time: number; date: number } {
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    // Years are counted from 1980, and months from 1 rather than 0.
    date:
      ((date.getFullYear() - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  };
}

/** Bit 11 of the general-purpose flags: filenames and comments are UTF-8. */
const UTF8_NAMES = 0x0800;
const DEFLATED = 8;
const STORED = 0;

export function createZip(entries: ZipEntry[], now = new Date()): Buffer {
  const stamp = dosStamp(now);
  const chunks: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(entry.data, "utf8");

    const deflated = deflateRawSync(raw);

    // Compression that made the file bigger is worse than none, which happens
    // with tiny or already-compressed entries. Store those instead.
    const useDeflate = deflated.length < raw.length;
    const body = useDeflate ? deflated : raw;
    const method = useDeflate ? DEFLATED : STORED;
    const checksum = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed to extract (2.0)
    local.writeUInt16LE(UTF8_NAMES, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // no extra field

    chunks.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(UTF8_NAMES, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attributes
    // External attributes: 0644, in the high word, where Unix tools look.
    central.writeUInt32LE(0o644 << 16, 38);
    central.writeUInt32LE(offset, 42); // where this entry's local header is

    directory.push(central, name);

    offset += local.length + name.length + body.length;
  }

  const centralDirectory = Buffer.concat(directory);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  end.writeUInt16LE(0, 4); // this disk
  end.writeUInt16LE(0, 6); // disk with the central directory
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // no archive comment

  return Buffer.concat([...chunks, centralDirectory, end]);
}

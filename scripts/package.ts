// Builds release/<slug>-<version>.zip from dist/ for Chrome Web Store upload.
// Pure Node (no `zip` binary needed). Entries are sorted and use a fixed timestamp, so the same dist/
// always gives the same zip. Source maps are left out. Run via `npm run package` (verify runs first).
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

const dist = "dist";
const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8")) as { version: string; name: string };
const config = JSON.parse(readFileSync("extension.config.json", "utf8")) as { slug: string };
if (manifest.name.endsWith("(dev)")) {
  console.error("✖ dist/ is a dev build. Run `npm run build` first (npm run package does this).");
  process.exit(1);
}

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(dist)
  .filter((f) => !f.endsWith(".map"))
  .map((f) => ({ abs: f, name: relative(dist, f).split(sep).join("/") }))
  .sort((a, b) => (a.name < b.name ? -1 : 1));

const DOS_TIME = 0; // 00:00:00
const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01
const locals: Buffer[] = [];
const centrals: Buffer[] = [];
let offset = 0;
for (const f of files) {
  const data = readFileSync(f.abs);
  const packed = deflateRawSync(data, { level: 9 });
  const name = Buffer.from(f.name, "utf8");
  const crc = crc32(data);
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0);
  head.writeUInt16LE(20, 4); // version needed
  head.writeUInt16LE(0x0800, 6); // UTF-8 names
  head.writeUInt16LE(8, 8); // deflate
  head.writeUInt16LE(DOS_TIME, 10);
  head.writeUInt16LE(DOS_DATE, 12);
  head.writeUInt32LE(crc, 14);
  head.writeUInt32LE(packed.length, 18);
  head.writeUInt32LE(data.length, 22);
  head.writeUInt16LE(name.length, 26);
  head.writeUInt16LE(0, 28);
  locals.push(head, name, packed);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0);
  cen.writeUInt16LE(20, 4);
  cen.writeUInt16LE(20, 6);
  cen.writeUInt16LE(0x0800, 8);
  cen.writeUInt16LE(8, 10);
  cen.writeUInt16LE(DOS_TIME, 12);
  cen.writeUInt16LE(DOS_DATE, 14);
  cen.writeUInt32LE(crc, 16);
  cen.writeUInt32LE(packed.length, 20);
  cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(name.length, 28);
  cen.writeUInt32LE(offset, 42);
  centrals.push(cen, name);
  offset += head.length + name.length + packed.length;
}
const central = Buffer.concat(centrals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(central.length, 12);
end.writeUInt32LE(offset, 16);

mkdirSync("release", { recursive: true });
const out = `release/${config.slug}-${manifest.version}.zip`;
writeFileSync(out, Buffer.concat([...locals, central, end]));
console.log(`✔ Packaged ${out} (${files.length} files)`);

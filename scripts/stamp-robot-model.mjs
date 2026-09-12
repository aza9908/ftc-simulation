// Keep attribution inside each downloadable GLB as well as its companion credits.
import fs from 'node:fs';
const [filename, id] = process.argv.slice(2);
const info =
  id === 'sideswipe-v3'
    ? {
        copyright:
          'Original CAD copyright 2026 Adrian Contraș. Modified educational simulator mesh. Non-commercial use only; no endorsement implied.',
        source: 'https://github.com/adisimaimulte1/ftc-cad-archive',
        license:
          'https://github.com/adisimaimulte1/ftc-cad-archive/blob/main/LICENSE.md',
      }
    : {
        copyright:
          'Original CAD by Team Cicada 31678 and Team Matrix 19348, 2025. Released under the Unlicense. Modified simulator mesh.',
        source:
          'https://github.com/cicadaroboticsteam-art/FTC-Decode-30-hours-Robot-matrix-cicada-',
        license:
          'https://github.com/cicadaroboticsteam-art/FTC-Decode-30-hours-Robot-matrix-cicada-/blob/main/LICENSE',
      };
const file = fs.readFileSync(filename);
const oldLength = file.readUInt32LE(12);
const json = JSON.parse(file.subarray(20, 20 + oldLength).toString());
json.asset.copyright = info.copyright;
json.asset.extras = {
  ...info,
  modifications:
    'Tessellated, simplified, reference artifacts removed, axes and materials converted. Common simulator physics; added turret is not original hardware.',
};
const text = Buffer.from(JSON.stringify(json));
const padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32);
text.copy(padded);
const tail = file.subarray(20 + oldLength);
const header = Buffer.from(file.subarray(0, 20));
header.writeUInt32LE(20 + padded.length + tail.length, 8);
header.writeUInt32LE(padded.length, 12);
fs.writeFileSync(filename, Buffer.concat([header, padded, tail]));

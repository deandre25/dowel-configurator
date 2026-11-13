/**
 * Downsamples a Radiance (.hdr) environment map.
 *
 *   npx tsx scripts/downsample-hdr.ts <source.hdr> <target.hdr> <width>
 *
 * Why: the 1k map from Poly Haven is 1.58 MB, which was four times the weight
 * of all the JavaScript the 3D view loads. It is never seen directly — it is
 * run through a PMREM filter into an irradiance map and a few blurry specular
 * mips, and the unit's materials are matte wood and powder coat. At 256 × 128
 * the rendered result is indistinguishable and the file is a twelfth the size.
 *
 * The decoder handles Radiance's new-style RLE scanlines and the flat form.
 * The encoder writes the flat form: RLE saves little on a photograph and the
 * file is small either way.
 */
import { readFileSync, writeFileSync } from "node:fs";

type Decoded = {
  width: number;
  height: number;
  /** Four bytes per pixel: R, G, B, shared exponent. */
  rgbe: Uint8Array;
};

function decode(buffer: Buffer): Decoded {
  let offset = 0;

  const readLine = (): string => {
    let line = "";
    for (;;) {
      const byte = buffer[offset];
      offset += 1;
      if (byte === undefined || byte === 0x0a) {
        return line;
      }
      line += String.fromCharCode(byte);
    }
  };

  const magic = readLine();
  if (!magic.startsWith("#?")) {
    throw new Error(`Not a Radiance file: first line was ${magic}`);
  }

  let format = "";
  for (;;) {
    const line = readLine();
    if (line === "") {
      break;
    }
    if (line.startsWith("FORMAT=")) {
      format = line.slice("FORMAT=".length);
    }
  }
  if (format !== "32-bit_rle_rgbe") {
    throw new Error(`Unsupported FORMAT: ${format}`);
  }

  const resolution = readLine();
  const match = /^-Y (\d+) \+X (\d+)$/.exec(resolution);
  if (match === null) {
    throw new Error(`Unsupported resolution line: ${resolution}`);
  }
  const height = Number(match[1]);
  const width = Number(match[2]);

  const rgbe = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width * 4;
    const a = buffer[offset];
    const b = buffer[offset + 1];
    const c = buffer[offset + 2];
    const d = buffer[offset + 3];
    if (a === undefined || b === undefined || c === undefined || d === undefined) {
      throw new Error(`File ended inside row ${String(y)}`);
    }

    const newStyleRle =
      a === 2 && b === 2 && ((c << 8) | d) === width && width >= 8 && width < 32768;

    if (!newStyleRle) {
      // Flat scanline: four bytes per pixel, straight through.
      for (let x = 0; x < width; x += 1) {
        for (let channel = 0; channel < 4; channel += 1) {
          const value = buffer[offset + x * 4 + channel];
          if (value === undefined) {
            throw new Error(`File ended inside row ${String(y)}`);
          }
          rgbe[rowStart + x * 4 + channel] = value;
        }
      }
      offset += width * 4;
      continue;
    }

    offset += 4;
    // Each channel is run-length encoded across the whole scanline.
    for (let channel = 0; channel < 4; channel += 1) {
      let x = 0;
      while (x < width) {
        const count = buffer[offset];
        offset += 1;
        if (count === undefined) {
          throw new Error(`File ended inside row ${String(y)}`);
        }
        if (count > 128) {
          const value = buffer[offset];
          offset += 1;
          if (value === undefined) {
            throw new Error(`File ended inside a run in row ${String(y)}`);
          }
          for (let run = 0; run < count - 128; run += 1) {
            rgbe[rowStart + (x + run) * 4 + channel] = value;
          }
          x += count - 128;
          continue;
        }
        for (let literal = 0; literal < count; literal += 1) {
          const value = buffer[offset + literal];
          if (value === undefined) {
            throw new Error(`File ended inside a literal in row ${String(y)}`);
          }
          rgbe[rowStart + (x + literal) * 4 + channel] = value;
        }
        offset += count;
        x += count;
      }
    }
  }

  return { width, height, rgbe };
}

/** RGBE is not linear, so averaging has to happen in linear light. */
function toLinear(
  rgbe: Uint8Array,
  index: number,
): [number, number, number] {
  const exponent = rgbe[index + 3] ?? 0;
  if (exponent === 0) {
    return [0, 0, 0];
  }
  const scale = Math.pow(2, exponent - 136);
  return [
    (rgbe[index] ?? 0) * scale,
    (rgbe[index + 1] ?? 0) * scale,
    (rgbe[index + 2] ?? 0) * scale,
  ];
}

function fromLinear(r: number, g: number, b: number): [number, number, number, number] {
  const brightest = Math.max(r, g, b);
  if (brightest < 1e-32) {
    return [0, 0, 0, 0];
  }
  const exponent = Math.ceil(Math.log2(brightest));
  const scale = Math.pow(2, -exponent) * 256;
  return [
    Math.min(255, Math.floor(r * scale)),
    Math.min(255, Math.floor(g * scale)),
    Math.min(255, Math.floor(b * scale)),
    exponent + 128,
  ];
}

function downsample(source: Decoded, targetWidth: number): Decoded {
  const factor = source.width / targetWidth;
  if (!Number.isInteger(factor) || factor < 1) {
    throw new Error(
      `Target width ${String(targetWidth)} must divide ${String(source.width)}`,
    );
  }
  const targetHeight = source.height / factor;
  if (!Number.isInteger(targetHeight)) {
    throw new Error("Source dimensions are not a clean multiple of the target");
  }

  const out = new Uint8Array(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < factor; dy += 1) {
        for (let dx = 0; dx < factor; dx += 1) {
          const index = ((y * factor + dy) * source.width + x * factor + dx) * 4;
          const [lr, lg, lb] = toLinear(source.rgbe, index);
          r += lr;
          g += lg;
          b += lb;
        }
      }
      const samples = factor * factor;
      const [er, eg, eb, ee] = fromLinear(r / samples, g / samples, b / samples);
      const target = (y * targetWidth + x) * 4;
      out[target] = er;
      out[target + 1] = eg;
      out[target + 2] = eb;
      out[target + 3] = ee;
    }
  }
  return { width: targetWidth, height: targetHeight, rgbe: out };
}

function encode(image: Decoded, note: string): Buffer {
  const header = Buffer.from(
    `#?RADIANCE\n# ${note}\nFORMAT=32-bit_rle_rgbe\n\n-Y ${String(image.height)} +X ${String(image.width)}\n`,
    "ascii",
  );
  return Buffer.concat([header, Buffer.from(image.rgbe)]);
}

const [sourcePath, targetPath, widthArgument] = process.argv.slice(2);
if (
  sourcePath === undefined ||
  targetPath === undefined ||
  widthArgument === undefined
) {
  throw new Error(
    "usage: tsx scripts/downsample-hdr.ts <source.hdr> <target.hdr> <width>",
  );
}

const decoded = decode(readFileSync(sourcePath));
const reduced = downsample(decoded, Number(widthArgument));
const encoded = encode(
  reduced,
  `Downsampled from ${String(decoded.width)}x${String(decoded.height)} by scripts/downsample-hdr.ts`,
);
writeFileSync(targetPath, encoded);

process.stdout.write(
  `${sourcePath} ${String(decoded.width)}x${String(decoded.height)} ` +
    `-> ${targetPath} ${String(reduced.width)}x${String(reduced.height)}, ` +
    `${(readFileSync(sourcePath).length / 1024).toFixed(0)} KB -> ` +
    `${(encoded.length / 1024).toFixed(0)} KB\n`,
);

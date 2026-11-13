import { describe, expect, it } from "vitest";
import {
  SHARE_ID_LENGTH,
  decodeShareId,
  encodeShareId,
  isShareId,
  newShareId,
  normaliseShareId,
} from "@/lib/domain/shareId";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

describe("encodeShareId", () => {
  it("encodes five bytes as eight characters from the alphabet", () => {
    const id = encodeShareId(new Uint8Array([0, 0, 0, 0, 0]));
    expect(id).toBe("00000000");
    expect(id).toHaveLength(SHARE_ID_LENGTH);
  });

  it("encodes all-ones as the last character of the alphabet, eight times", () => {
    expect(encodeShareId(new Uint8Array([255, 255, 255, 255, 255]))).toBe(
      "ZZZZZZZZ",
    );
  });

  it("encodes each five-bit group independently", () => {
    // 0b00001_00010_00011_00100_00101_00110_00111_01000
    const bytes = new Uint8Array([0b00001000, 0b10000110, 0b01000010, 0b10011000, 0b11101000]);
    expect(encodeShareId(bytes)).toBe("12345678");
  });

  it("refuses a wrong number of bytes, naming the count it got", () => {
    expect(() => encodeShareId(new Uint8Array([1, 2, 3, 4]))).toThrow(
      "received 4",
    );
    expect(() => encodeShareId(new Uint8Array(6))).toThrow("received 6");
  });

  it("uses only unambiguous characters — no I, L, O or U", () => {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      for (const character of newShareId()) {
        expect(ALPHABET).toContain(character);
      }
    }
    expect(ALPHABET).not.toMatch(/[ILOU]/);
  });
});

describe("round trip", () => {
  it("decodes what it encoded, for every single-bit value", () => {
    for (let bit = 0; bit < 40; bit += 1) {
      const bytes = new Uint8Array(5);
      const byteIndex = Math.floor(bit / 8);
      const current = bytes[byteIndex];
      expect(current).toBeDefined();
      bytes[byteIndex] = (current ?? 0) | (1 << (7 - (bit % 8)));
      expect(decodeShareId(encodeShareId(bytes))).toEqual(bytes);
    }
  });

  it("decodes what it encoded, for a thousand random ids", () => {
    for (let attempt = 0; attempt < 1_000; attempt += 1) {
      const bytes = new Uint8Array(5);
      crypto.getRandomValues(bytes);
      expect(decodeShareId(encodeShareId(bytes))).toEqual(bytes);
    }
  });
});

describe("normaliseShareId", () => {
  it("accepts a canonical id unchanged", () => {
    expect(normaliseShareId("A1B2C3D4")).toBe("A1B2C3D4");
  });

  it("upper-cases a lower-case id, because links get typed by hand", () => {
    expect(normaliseShareId("a1b2c3d4")).toBe("A1B2C3D4");
  });

  it("folds the characters people mistype for digits", () => {
    expect(normaliseShareId("OIL23456")).toBe("01123456");
    expect(normaliseShareId("oil23456")).toBe("01123456");
  });

  it("ignores surrounding whitespace and hyphens", () => {
    expect(normaliseShareId("  A1B2-C3D4 ")).toBe("A1B2C3D4");
  });

  it("rejects the wrong length", () => {
    expect(normaliseShareId("A1B2C3D")).toBeNull();
    expect(normaliseShareId("A1B2C3D45")).toBeNull();
    expect(normaliseShareId("")).toBeNull();
  });

  it("rejects a character outside the alphabet", () => {
    expect(normaliseShareId("A1B2C3D$")).toBeNull();
    expect(normaliseShareId("A1B2C3DU")).toBeNull();
  });

  it("rejects an id with a separator inside a group of digits", () => {
    expect(normaliseShareId("A1B2 C3D4")).toBeNull();
  });
});

describe("isShareId", () => {
  it("is true only for an id already in canonical form", () => {
    expect(isShareId("A1B2C3D4")).toBe(true);
    expect(isShareId("a1b2c3d4")).toBe(false);
    expect(isShareId("A1B2C3D")).toBe(false);
  });

  it("is true for every id the generator produces", () => {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      expect(isShareId(newShareId())).toBe(true);
    }
  });
});

describe("decodeShareId", () => {
  it("returns null rather than guessing, so a bad link is a miss and not a query", () => {
    expect(decodeShareId("not-an-id")).toBeNull();
    expect(decodeShareId("'; drop table")).toBeNull();
  });

  it("decodes a normalised form to the same bytes as its canonical form", () => {
    const canonical = newShareId();
    const mistyped = canonical
      .replaceAll("0", "O")
      .replaceAll("1", "I")
      .toLowerCase();
    expect(decodeShareId(mistyped)).toEqual(decodeShareId(canonical));
  });
});

describe("newShareId", () => {
  it("produces ids of the documented length", () => {
    expect(newShareId()).toHaveLength(SHARE_ID_LENGTH);
  });

  it("does not repeat across ten thousand ids", () => {
    // 40 bits: a collision in 10,000 draws is about one in 90,000, so a
    // failure here means the generator is not random, not bad luck.
    const seen = new Set<string>();
    for (let attempt = 0; attempt < 10_000; attempt += 1) {
      seen.add(newShareId());
    }
    expect(seen.size).toBe(10_000);
  });
});

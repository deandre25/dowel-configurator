/**
 * Short ids for share links.
 *
 * Crockford base32: ten digits and twenty-two letters, with I, L, O and U left
 * out. The alphabet matters because these ids get read aloud, typed from a
 * phone screen and pasted out of chat messages — 0/O and 1/I/l are the
 * characters that break that, and U is excluded so the encoding cannot spell
 * anything unfortunate.
 *
 * Eight characters is 40 bits, which is 1.1 × 10^12 ids. These are random, not
 * sequential, so a share link does not expose how many units have been saved
 * or let a visitor walk the next one.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BITS_PER_CHARACTER = 5;
export const SHARE_ID_LENGTH = 8;

/** Crockford's documented confusions, applied before decoding. */
const CONFUSIONS: Readonly<Record<string, string>> = {
  O: "0",
  I: "1",
  L: "1",
};

/**
 * Normalises a candidate id to canonical form: upper case, with the characters
 * people mistype for digits folded onto the digits. Returns null when the
 * result is not a well-formed id, so a bad share link is a "not found" rather
 * than a database query with arbitrary input in it.
 */
export function normaliseShareId(candidate: string): string | null {
  const trimmed = candidate.trim().toUpperCase().replaceAll("-", "");
  if (trimmed.length !== SHARE_ID_LENGTH) {
    return null;
  }

  let normalised = "";
  for (const character of trimmed) {
    const folded = CONFUSIONS[character] ?? character;
    if (!ALPHABET.includes(folded)) {
      return null;
    }
    normalised += folded;
  }
  return normalised;
}

export function isShareId(candidate: string): boolean {
  return normaliseShareId(candidate) === candidate;
}

/** Encodes 40 bits, given as five bytes, into eight characters. */
export function encodeShareId(bytes: Uint8Array): string {
  const expectedBytes = (SHARE_ID_LENGTH * BITS_PER_CHARACTER) / 8;
  if (bytes.length !== expectedBytes) {
    throw new Error(
      `A share id encodes exactly ${expectedBytes} bytes, received ${bytes.length}`,
    );
  }

  let bitBuffer = 0;
  let bitCount = 0;
  let encoded = "";

  for (const byte of bytes) {
    bitBuffer = (bitBuffer << 8) | byte;
    bitCount += 8;
    while (bitCount >= BITS_PER_CHARACTER) {
      bitCount -= BITS_PER_CHARACTER;
      const index = (bitBuffer >> bitCount) & 0b11111;
      const character = ALPHABET[index];
      if (character === undefined) {
        throw new Error(`Alphabet has no character at index ${index}`);
      }
      encoded += character;
    }
  }

  return encoded;
}

/** Decodes an id back to its five bytes. Returns null for a malformed id. */
export function decodeShareId(id: string): Uint8Array | null {
  const normalised = normaliseShareId(id);
  if (normalised === null) {
    return null;
  }

  let bitBuffer = 0;
  let bitCount = 0;
  const bytes: number[] = [];

  for (const character of normalised) {
    bitBuffer = (bitBuffer << BITS_PER_CHARACTER) | ALPHABET.indexOf(character);
    bitCount += BITS_PER_CHARACTER;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bitBuffer >> bitCount) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

/** A fresh random id. */
export function newShareId(): string {
  const bytes = new Uint8Array((SHARE_ID_LENGTH * BITS_PER_CHARACTER) / 8);
  crypto.getRandomValues(bytes);
  return encodeShareId(bytes);
}

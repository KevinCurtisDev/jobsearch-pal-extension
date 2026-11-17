// ULIDs (X11, ADR-017): 48-bit millisecond time + 80 bits of randomness, Crockford base32, 26 chars.
// Lexical order is time order. The generator is monotonic: within one millisecond (or if the clock goes
// backwards) the random part of the previous id is incremented, so ids from one generator always sort
// in creation order. Clock and randomness are injected: src/core has no `crypto` (G3); callers pass
// `crypto.getRandomValues`.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_LEN = 10;
const RANDOM_LEN = 16;
const MAX_TIME = 2 ** 48 - 1;

export const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

export type RandomBytes = (bytes: Uint8Array) => Uint8Array;
export type UlidOptions = { random: RandomBytes; now?: () => number };
export type UlidGenerator = () => string;

export function isUlid(v: unknown): v is string {
  return typeof v === "string" && ULID_PATTERN.test(v);
}

function encodeTime(ms: number): string {
  if (!Number.isInteger(ms) || ms < 0 || ms > MAX_TIME) throw new RangeError("ULID time out of range");
  let out = "";
  let t = ms;
  for (let i = 0; i < TIME_LEN; i++) {
    out = ALPHABET.charAt(t % 32) + out;
    t = Math.floor(t / 32);
  }
  return out;
}

/** Milliseconds since the epoch encoded in a ULID. */
export function ulidTime(id: string): number {
  if (!isUlid(id)) throw new TypeError("not a ULID");
  let t = 0;
  for (const ch of id.slice(0, TIME_LEN)) t = t * 32 + ALPHABET.indexOf(ch);
  return t;
}

/** 16 base32 digits (5 bits each) from 10 random bytes. */
function randomDigits(random: RandomBytes): number[] {
  const bytes = random(new Uint8Array(10));
  if (!(bytes instanceof Uint8Array) || bytes.length !== 10) throw new TypeError("random must fill 10 bytes");
  const digits: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      digits.push((acc >> bits) & 31);
    }
    acc &= (1 << bits) - 1;
  }
  return digits;
}

/** Adds one to a base32 digit array in place; throws when all 80 bits are already set. */
function increment(digits: number[]): void {
  for (let i = digits.length - 1; i >= 0; i--) {
    const d = digits[i] ?? 0;
    if (d < 31) {
      digits[i] = d + 1;
      return;
    }
    digits[i] = 0;
  }
  throw new RangeError("ULID random part overflowed within one millisecond");
}

/** A monotonic ULID generator with an injected clock and random source. */
export function createUlid(opts: UlidOptions): UlidGenerator {
  const now = opts.now ?? (() => Date.now());
  let lastTime = -1;
  let lastDigits: number[] = [];
  return () => {
    const t = now();
    if (t > lastTime) {
      lastTime = t;
      lastDigits = randomDigits(opts.random);
    } else {
      increment(lastDigits);
    }
    return encodeTime(lastTime) + lastDigits.map((d) => ALPHABET.charAt(d)).join("");
  };
}

export const ULID_LENGTH = TIME_LEN + RANDOM_LEN;

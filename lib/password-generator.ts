/**
 * Cryptographically secure password generator (browser and Node 20+).
 *
 * - Randomness comes from crypto.getRandomValues; indices are drawn with
 *   rejection sampling so every character is equally likely (no modulo bias).
 * - Every enabled character set contributes at least one character; the
 *   result is then shuffled with Fisher-Yates using the same unbiased source.
 */

export const PASSWORD_LENGTHS = [12, 16, 24, 32, 48] as const;
export type PasswordLength = (typeof PASSWORD_LENGTHS)[number];

export const CHARSET_KEYS = ["upper", "lower", "digits", "symbols"] as const;
export type CharsetKey = (typeof CHARSET_KEYS)[number];

/** Characters that are easy to confuse in many fonts (I/l/1, O/0). */
export const AMBIGUOUS_CHARACTERS = "IlO01";

const CHARSETS: Record<CharsetKey, string> = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  // Shell- and URL-friendly symbols: no quotes, backslash, backtick or whitespace.
  symbols: "!@#$%^&*-_=+?~",
};

export interface PasswordOptions {
  length: number;
  sets: Record<CharsetKey, boolean>;
  excludeAmbiguous: boolean;
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 24,
  sets: { upper: true, lower: true, digits: true, symbols: true },
  excludeAmbiguous: true,
};

export type StrengthLevel = 1 | 2 | 3 | 4;

export interface PasswordStrength {
  /** Estimated entropy: length × log2(pool size), rounded down. */
  bits: number;
  level: StrengthLevel;
  label: "Weak" | "Fair" | "Strong" | "Very strong";
}

/** Characters of one set after the ambiguity filter. */
export function charsetFor(key: CharsetKey, excludeAmbiguous: boolean): string {
  const chars = CHARSETS[key];
  if (!excludeAmbiguous) return chars;
  return Array.from(chars)
    .filter((char) => !AMBIGUOUS_CHARACTERS.includes(char))
    .join("");
}

function enabledCharsets(options: PasswordOptions): string[] {
  return CHARSET_KEYS.filter((key) => options.sets[key]).map((key) => charsetFor(key, options.excludeAmbiguous));
}

/** Uniform random integer in [0, max) via rejection sampling over 32-bit values. */
function randomIndex(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) {
    throw new RangeError("max must be an integer in (0, 2^32]");
  }
  const range = 2 ** 32;
  // Largest multiple of `max` that fits in 32 bits; values at or above it are rejected.
  const limit = range - (range % max);
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return buffer[0] % max;
  }
}

function pick(chars: string): string {
  return chars[randomIndex(chars.length)];
}

/**
 * Generate a password. Throws when no character set is enabled or the length
 * is shorter than the number of enabled sets.
 */
export function generatePassword(options: PasswordOptions): string {
  const sets = enabledCharsets(options);
  if (sets.length === 0) throw new Error("Enable at least one character set");
  if (!Number.isInteger(options.length) || options.length < sets.length) {
    throw new Error(`Length must be at least ${sets.length}`);
  }

  const pool = sets.join("");
  const chars = sets.map(pick);
  while (chars.length < options.length) chars.push(pick(pool));

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** Entropy estimate and a four-level rating for the given options. */
export function estimateStrength(options: PasswordOptions): PasswordStrength {
  const poolSize = enabledCharsets(options).join("").length;
  const bits = poolSize > 1 ? Math.floor(options.length * Math.log2(poolSize)) : 0;
  if (bits >= 128) return { bits, level: 4, label: "Very strong" };
  if (bits >= 90) return { bits, level: 3, label: "Strong" };
  if (bits >= 60) return { bits, level: 2, label: "Fair" };
  return { bits, level: 1, label: "Weak" };
}

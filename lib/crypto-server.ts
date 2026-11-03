import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Server-only cryptography: encryption at rest (AES-256-GCM), TOTP (RFC 6238)
 * and token helpers. Never import this module from client components.
 */

const ENCRYPTION_PREFIX = "enc:v1:";
const KEY_FILE_NAME = "encryption.key";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export type EncryptionKeySource = "env" | "file";

export interface EncryptionKeyInfo {
  source: EncryptionKeySource;
  /** When the key file was created; null for keys supplied via the environment. */
  createdAt: string | null;
}

interface LoadedKey extends EncryptionKeyInfo {
  key: Buffer;
}

let loadedKey: LoadedKey | null = null;

// ===== Data directory =====

export function getDataDir(): string {
  return path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
}

export function ensureDataDir(): string {
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

// ===== Encryption key =====

function parseKey(raw: string, origin: string): Buffer {
  const value = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }
  if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === 32) return decoded;
  }
  throw new Error(
    `${origin} must be a 32-byte key encoded as base64 or hex (generate one with: openssl rand -base64 32)`
  );
}

function loadKeyFromFile(): LoadedKey {
  const file = path.join(ensureDataDir(), KEY_FILE_NAME);

  try {
    fs.writeFileSync(file, crypto.randomBytes(32).toString("base64") + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    console.warn(
      `[credzo] CREDZO_ENCRYPTION_KEY is not set. Generated a new encryption key at ${file}. ` +
        "Back this file up together with the database: without it stored credentials cannot be decrypted."
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }

  const key = parseKey(fs.readFileSync(file, "utf8"), file);
  const stats = fs.statSync(file);
  return { key, source: "file", createdAt: stats.mtime.toISOString() };
}

function getKey(): LoadedKey {
  if (!loadedKey) {
    const envKey = process.env.CREDZO_ENCRYPTION_KEY;
    loadedKey =
      envKey && envKey.trim()
        ? { key: parseKey(envKey, "CREDZO_ENCRYPTION_KEY"), source: "env", createdAt: null }
        : loadKeyFromFile();
  }
  return loadedKey;
}

/** Loads (or creates) the encryption key and reports where it came from. */
export function getEncryptionKeyInfo(): EncryptionKeyInfo {
  const { source, createdAt } = getKey();
  return { source, createdAt };
}

// ===== AES-256-GCM =====

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTION_PREFIX);
}

export function encryptString(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey().key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const payload = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
  return ENCRYPTION_PREFIX + payload.toString("base64");
}

/**
 * Decrypts a value produced by encryptString. Values without the version
 * prefix are legacy plaintext and are returned unchanged.
 */
export function decryptString(value: string): string {
  if (!isEncrypted(value)) return value;

  const payload = Buffer.from(value.slice(ENCRYPTION_PREFIX.length), "base64");
  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Encrypted value is malformed");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey().key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error(
      "Failed to decrypt stored data: the encryption key does not match the one used to encrypt it"
    );
  }
}

// ===== Tokens & hashing =====

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// ===== Base32 (RFC 4648) =====

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(data: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ===== TOTP (RFC 6238: SHA-1, 6 digits, 30 s step) =====

const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(key: Buffer, counter: number, digits: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

export function totpStep(timeMs: number = Date.now()): number {
  return Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);
}

export function generateTotp(
  secret: string | Buffer,
  timeMs: number = Date.now(),
  digits: number = TOTP_DIGITS
): string {
  const key = typeof secret === "string" ? base32Decode(secret) : secret;
  return hotp(key, totpStep(timeMs), digits);
}

/**
 * Verifies a TOTP code within ±window steps. Returns the matching time step,
 * or null. Steps at or below lastUsedStep are rejected to prevent replay.
 */
export function verifyTotp(
  secret: string,
  code: string,
  options: { window?: number; timeMs?: number; lastUsedStep?: number | null } = {}
): number | null {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;

  const key = base32Decode(secret);
  const window = options.window ?? 1;
  const current = totpStep(options.timeMs ?? Date.now());

  for (let offset = -window; offset <= window; offset++) {
    const step = current + offset;
    if (options.lastUsedStep != null && step <= options.lastUsedStep) continue;
    if (safeEqual(hotp(key, step, TOTP_DIGITS), normalized)) return step;
  }
  return null;
}

export function buildOtpAuthUrl(secret: string, accountName: string, issuer: string = "Credzo"): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ===== Backup codes =====

const BACKUP_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function normalizeBackupCode(code: string): string {
  return code.toLowerCase().replace(/[\s-]/g, "");
}

export function hashBackupCode(code: string): string {
  return sha256Hex(normalizeBackupCode(code));
}

/** Generates human-friendly one-time codes like "k7m2p-x9qrt". */
export function generateBackupCodes(count: number = 10): string[] {
  return Array.from({ length: count }, () => {
    let code = "";
    for (let i = 0; i < 10; i++) {
      code += BACKUP_CODE_ALPHABET[crypto.randomInt(BACKUP_CODE_ALPHABET.length)];
    }
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  });
}

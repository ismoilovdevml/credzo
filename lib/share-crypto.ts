/**
 * Client-side encryption for one-time secure links (browser WebCrypto only).
 *
 * Scheme "credzo-share-v1":
 *   linkKey  = 32 random bytes, base64url-encoded into the URL fragment
 *              (/s/<id>#<linkKey>). Fragments are never sent to the server.
 *   no passphrase:
 *     aesKey = HKDF-SHA256(ikm = linkKey, salt = empty, info = "credzo-share-v1")
 *   with passphrase:
 *     salt   = 16 random bytes (stored server-side, useless on its own)
 *     pwKey  = PBKDF2-SHA256(passphrase, salt, 210 000 iterations, 32 bytes)
 *     aesKey = HKDF-SHA256(ikm = linkKey || pwKey, salt = salt, info = "credzo-share-v1/passphrase")
 *   ciphertext = AES-256-GCM(aesKey, iv = 12 random bytes, aad = "credzo-share-v1", utf8(secret))
 *
 * The server only stores ciphertext, iv and salt, so it can neither read the
 * secret nor brute-force the passphrase without the fragment key. Binary
 * values travel as unpadded base64url.
 */

const VERSION = "credzo-share-v1";
const LINK_KEY_BYTES = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const PBKDF2_ITERATIONS = 210_000;
const GCM_TAG_BYTES = 16;

/** Largest secret (UTF-8 bytes) whose ciphertext fits the server's 64 KB limit. */
export const MAX_SECRET_BYTES = 64 * 1024 - GCM_TAG_BYTES;

const encoder = new TextEncoder();

export interface EncryptedShare {
  ciphertext: string;
  iv: string;
  /** Present only when a passphrase was used. */
  salt: string | null;
  /** base64url link key for the URL fragment. Never send it to the server. */
  linkKey: string;
}

export interface SharePayloadInput {
  ciphertext: string;
  iv: string;
  salt: string | null;
}

export class ShareDecryptError extends Error {
  constructor() {
    super("The secret could not be decrypted");
    this.name = "ShareDecryptError";
  }
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decodes base64 or base64url (padding optional). Throws on malformed input. */
export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Validates the fragment key; returns its bytes or null when it is missing or malformed. */
export function parseLinkKey(fragment: string): Uint8Array<ArrayBuffer> | null {
  const value = fragment.replace(/^#/, "").trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  try {
    const bytes = fromBase64(value);
    return bytes.length === LINK_KEY_BYTES ? bytes : null;
  } catch {
    return null;
  }
}

async function passphraseKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    material,
    256
  );
  return new Uint8Array(bits);
}

async function deriveAesKey(
  linkKey: Uint8Array<ArrayBuffer>,
  passphrase: string | null,
  salt: Uint8Array<ArrayBuffer> | null,
  usage: KeyUsage
): Promise<CryptoKey> {
  let ikm = linkKey;
  let hkdfSalt = new Uint8Array(0);
  let info = VERSION;

  if (passphrase !== null) {
    if (!salt) throw new Error("A salt is required with a passphrase");
    const pwKey = await passphraseKey(passphrase, salt);
    ikm = new Uint8Array(linkKey.length + pwKey.length);
    ikm.set(linkKey);
    ikm.set(pwKey, linkKey.length);
    hkdfSalt = salt;
    info = `${VERSION}/passphrase`;
  }

  const material = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: hkdfSalt, info: encoder.encode(info) },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

/** Encrypt a secret for a new link. Pass a non-empty passphrase to require it on open. */
export async function encryptShare(secret: string, passphrase?: string): Promise<EncryptedShare> {
  const plaintext = encoder.encode(secret);
  if (plaintext.length === 0) throw new Error("The secret is empty");
  if (plaintext.length > MAX_SECRET_BYTES) throw new Error("The secret is too large (max 64 KB)");

  const linkKey = randomBytes(LINK_KEY_BYTES);
  const usePassphrase = Boolean(passphrase);
  const salt = usePassphrase ? randomBytes(SALT_BYTES) : null;
  const iv = randomBytes(IV_BYTES);
  const key = await deriveAesKey(linkKey, usePassphrase ? (passphrase as string) : null, salt, "encrypt");
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(VERSION) },
    key,
    plaintext
  );

  return {
    ciphertext: toBase64Url(new Uint8Array(ciphertext)),
    iv: toBase64Url(iv),
    salt: salt ? toBase64Url(salt) : null,
    linkKey: toBase64Url(linkKey),
  };
}

/**
 * Decrypt a payload returned by POST /api/shares/[id]/open.
 * Throws ShareDecryptError for a wrong passphrase or an altered/incomplete key.
 */
export async function decryptShare(
  payload: SharePayloadInput,
  linkKey: Uint8Array<ArrayBuffer>,
  passphrase: string | null
): Promise<string> {
  try {
    const salt = payload.salt ? fromBase64(payload.salt) : null;
    const key = await deriveAesKey(linkKey, passphrase, salt, "decrypt");
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(payload.iv), additionalData: encoder.encode(VERSION) },
      key,
      fromBase64(payload.ciphertext)
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new ShareDecryptError();
  }
}

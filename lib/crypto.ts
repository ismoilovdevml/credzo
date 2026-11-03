/**
 * Encryption/Decryption utilities for secure data export/import
 * Uses Web Crypto API with AES-GCM encryption
 */

// Generate a random encryption key from password
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // Derive actual encryption key
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt data with password
 */
export async function encryptData(data: string, password: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive key from password
    const key = await deriveKey(password, salt);

    // Encrypt data
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      dataBuffer
    );

    // Combine salt, iv, and encrypted data
    const encryptedArray = new Uint8Array(encryptedBuffer);
    const resultArray = new Uint8Array(salt.length + iv.length + encryptedArray.length);
    resultArray.set(salt, 0);
    resultArray.set(iv, salt.length);
    resultArray.set(encryptedArray, salt.length + iv.length);

    return bytesToBase64(resultArray);
  } catch {
    throw new Error("Failed to encrypt data");
  }
}

// Spreading a large array into String.fromCharCode overflows the call stack,
// so convert in fixed-size chunks.
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Decrypt data with password
 */
export async function decryptData(encryptedData: string, password: string): Promise<string> {
  try {
    // Decode from base64
    const encryptedArray = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

    // Extract salt, iv, and encrypted data
    const salt = encryptedArray.slice(0, 16);
    const iv = encryptedArray.slice(16, 28);
    const data = encryptedArray.slice(28);

    // Derive key from password
    const key = await deriveKey(password, salt);

    // Decrypt data
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      data
    );

    // Convert to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch {
    throw new Error("Invalid password or corrupted data");
  }
}

/**
 * Generate a random secure key for display
 * Generates a strong password that meets validation requirements
 */
export function generateSecureKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  // Convert to base64-like string with mixed case and special chars
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";

  for (let i = 0; i < 32; i++) {
    password += chars[array[i] % chars.length];
  }

  return password;
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  return { valid: true, message: "Password is strong" };
}

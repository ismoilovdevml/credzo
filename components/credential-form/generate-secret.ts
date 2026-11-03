import { DEFAULT_PASSWORD_OPTIONS, generatePassword } from "@/lib/password-generator";

const SECRET_LENGTH = 32;

/** 32-character password from crypto.getRandomValues (all character sets, no ambiguous characters). */
export function generateSecret(): string {
  return generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: SECRET_LENGTH });
}

const PREFILL_PARAM = "prefill";
const PREFILL_SOURCE = "generator";
const PREFILL_STORAGE_KEY = "credzo:prefill-secret";
const PREFILL_MAX_LENGTH = 4096;

/**
 * One-shot hand-off from the Generator page: when the URL carries ?prefill=generator,
 * read the secret from sessionStorage and remove it immediately. Never throws.
 */
export function takeGeneratorPrefill(searchParams: URLSearchParams): string | null {
  if (searchParams.get(PREFILL_PARAM) !== PREFILL_SOURCE) return null;
  try {
    const value = window.sessionStorage.getItem(PREFILL_STORAGE_KEY);
    window.sessionStorage.removeItem(PREFILL_STORAGE_KEY);
    return typeof value === "string" && value.length > 0 && value.length <= PREFILL_MAX_LENGTH ? value : null;
  } catch {
    return null;
  }
}

/** The current query string without the prefill marker ("" when nothing is left). */
export function withoutPrefillParam(searchParams: URLSearchParams): string {
  const next = new URLSearchParams(searchParams);
  next.delete(PREFILL_PARAM);
  const query = next.toString();
  return query ? `?${query}` : "";
}

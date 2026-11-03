/**
 * Request input parsing helpers.
 * Every reader throws a ValidationError (HTTP 400) with a field-specific message,
 * so route handlers can parse a body top-to-bottom and let handleRouteError respond.
 */

import { REGEX_PATTERNS } from '@/lib/config/constants';
import { ValidationError } from './errors';

export type JsonObject = Record<string, unknown>;

export function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requireObject(value: unknown, label: string = 'Request body'): JsonObject {
  if (!isPlainObject(value)) {
    throw new ValidationError(`${label} must be a JSON object`);
  }
  return value;
}

interface StringOptions {
  min?: number;
  max: number;
  /** Keep surrounding whitespace (secrets, multi-line values). Defaults to trimming. */
  raw?: boolean;
}

/** Required non-empty string. */
export function readRequiredString(
  body: JsonObject,
  key: string,
  label: string,
  options: StringOptions
): string {
  const value = readOptionalString(body, key, label, options);
  if (value === undefined || value === '') {
    throw new ValidationError(`${label} is required`);
  }
  return value;
}

/** Optional string; returns undefined when the key is absent or null. Empty strings are allowed. */
export function readOptionalString(
  body: JsonObject,
  key: string,
  label: string,
  options: StringOptions
): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new ValidationError(`${label} must be a string`);
  }
  const result = options.raw ? value : value.trim();
  if (result !== '' && options.min !== undefined && result.length < options.min) {
    throw new ValidationError(`${label} must be at least ${options.min} characters`);
  }
  if (result.length > options.max) {
    throw new ValidationError(`${label} must not exceed ${options.max} characters`);
  }
  return result;
}

/** Optional enum value; returns undefined when absent. */
export function readOptionalEnum<T extends string>(
  body: JsonObject,
  key: string,
  label: string,
  allowed: readonly T[]
): T | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new ValidationError(`${label} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

export function readRequiredEnum<T extends string>(
  body: JsonObject,
  key: string,
  label: string,
  allowed: readonly T[]
): T {
  const value = readOptionalEnum(body, key, label, allowed);
  if (value === undefined) {
    throw new ValidationError(`${label} is required`);
  }
  return value;
}

/**
 * Enum that may be explicitly cleared.
 * Returns undefined when absent, null when sent as null or "".
 */
export function readNullableEnum<T extends string>(
  body: JsonObject,
  key: string,
  label: string,
  allowed: readonly T[]
): T | null | undefined {
  if (!(key in body)) return undefined;
  const value = body[key];
  if (value === null || value === '') return null;
  return readOptionalEnum(body, key, label, allowed) ?? null;
}

/**
 * Integer that may be explicitly cleared.
 * Returns undefined when absent, null when sent as null.
 */
export function readNullableInteger(
  body: JsonObject,
  key: string,
  label: string,
  bounds: { min: number; max: number }
): number | null | undefined {
  if (!(key in body)) return undefined;
  const value = body[key];
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ValidationError(`${label} must be a whole number`);
  }
  if (value < bounds.min || value > bounds.max) {
    throw new ValidationError(`${label} must be between ${bounds.min} and ${bounds.max}`);
  }
  return value;
}

export function readOptionalBoolean(body: JsonObject, key: string, label: string): boolean | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${label} must be true or false`);
  }
  return value;
}

/** Optional array of trimmed, non-empty, de-duplicated strings. */
export function readOptionalStringArray(
  body: JsonObject,
  key: string,
  label: string,
  limits: { maxItems: number; maxLength: number }
): string[] | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new ValidationError(`${label} must be a list`);
  }
  if (value.length > limits.maxItems) {
    throw new ValidationError(`${label} must not contain more than ${limits.maxItems} items`);
  }
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new ValidationError(`${label} must only contain text`);
    }
    const trimmed = item.trim();
    if (trimmed.length > limits.maxLength) {
      throw new ValidationError(`${label} entries must not exceed ${limits.maxLength} characters`);
    }
    if (trimmed && !items.includes(trimmed)) items.push(trimmed);
  }
  return items;
}

export function readRequiredEmail(body: JsonObject, key: string, label: string, max: number): string {
  const email = readRequiredString(body, key, label, { max }).toLowerCase();
  if (!REGEX_PATTERNS.EMAIL.test(email)) {
    throw new ValidationError(`${label} is not a valid email address`);
  }
  return email;
}

/** Validates an optional http(s) URL; returns undefined when absent. */
export function readOptionalUrl(
  body: JsonObject,
  key: string,
  label: string,
  max: number
): string | undefined {
  const value = readOptionalString(body, key, label, { max });
  if (!value) return value;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ValidationError(`${label} must be a valid URL`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError(`${label} must start with http:// or https://`);
  }
  return value;
}

/** Parses a positive integer query parameter, clamped to [min, max]. */
export function parseIntegerParam(
  raw: string | null,
  fallback: number,
  bounds: { min: number; max: number }
): number {
  if (raw === null || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new ValidationError('Pagination parameters must be whole numbers');
  }
  return Math.min(Math.max(value, bounds.min), bounds.max);
}

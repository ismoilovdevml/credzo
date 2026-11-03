/** Small formatting helpers for the settings screen. */

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "just now", "5 minutes ago", "2 months ago". Returns "" for a missing or invalid date. */
export function formatRelative(value: string | null | undefined, now: number = Date.now()): string {
  if (!value) return "";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";
  const seconds = Math.round((time - now) / 1000);
  if (Math.abs(seconds) < 60) return "just now";
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.trunc(seconds / size), unit);
  }
  return "just now";
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export type DeviceKind = "desktop" | "mobile" | "tablet" | "unknown";

export interface ParsedUserAgent {
  /** "Chrome on macOS", "Safari on iPhone", "Unknown device". */
  label: string;
  kind: DeviceKind;
}

const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
  [/curl\//, "curl"],
  [/node|undici/i, "Node.js"],
];

/** Tiny user-agent parser: enough to tell sessions apart, not a full UA database. */
export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  if (!userAgent) return { label: "Unknown device", kind: "unknown" };

  let os: string | null = null;
  let kind: DeviceKind = "desktop";
  if (/iPad/.test(userAgent)) {
    os = "iPad";
    kind = "tablet";
  } else if (/iPhone|iPod/.test(userAgent)) {
    os = "iPhone";
    kind = "mobile";
  } else if (/Android/.test(userAgent)) {
    os = "Android";
    kind = /Mobile/.test(userAgent) ? "mobile" : "tablet";
  } else if (/CrOS/.test(userAgent)) {
    os = "ChromeOS";
  } else if (/Mac OS X|Macintosh/.test(userAgent)) {
    os = "macOS";
  } else if (/Windows/.test(userAgent)) {
    os = "Windows";
  } else if (/Linux/.test(userAgent)) {
    os = "Linux";
  } else {
    kind = "unknown";
  }

  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
  if (browser && os) return { label: `${browser} on ${os}`, kind };
  return { label: browser ?? os ?? "Unknown device", kind };
}

/** Local calendar date as YYYY-MM-DD. */
export function isoDay(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Triggers a browser download of `content` as a file. */
export function downloadFile(content: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FALLBACK_TIME_ZONES = [
  "UTC",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "America/Anchorage",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Sao_Paulo",
  "America/Toronto",
  "Asia/Almaty",
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Kolkata",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tashkent",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/Berlin",
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Paris",
  "Pacific/Auckland",
];

/** IANA time zones supported by this browser, falling back to a short list of common zones. */
export function listTimeZones(): string[] {
  try {
    const zones = Intl.supportedValuesOf("timeZone");
    if (zones.length > 0) return zones.includes("UTC") ? zones : ["UTC", ...zones];
  } catch {
    // Older browsers lack Intl.supportedValuesOf.
  }
  return FALLBACK_TIME_ZONES;
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** "UTC+05:00" for a zone at the current moment; "" if the browser can't tell. */
export function timeZoneOffset(timeZone: string): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(new Date())
      .find((item) => item.type === "timeZoneName")?.value;
    if (!part) return "";
    return part === "GMT" ? "UTC+00:00" : part.replace("GMT", "UTC");
  } catch {
    return "";
  }
}

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

export interface PasswordScore {
  score: StrengthScore;
  label: "Too short" | "Weak" | "Fair" | "Strong" | "Very strong";
}

/**
 * Rough strength estimate for a chosen password: length plus character variety,
 * with penalties for repeats and common sequences. Score 0 = below the 10-character minimum.
 */
export function scorePassword(password: string, minLength = 10): PasswordScore {
  if (password.length < minLength) return { score: 0, label: "Too short" };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  let points = classes;
  if (password.length >= 14) points += 1;
  if (password.length >= 20) points += 1;
  if (/(.)\1{2,}/.test(password)) points -= 1;
  if (/(?:0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf|password|letmein)/i.test(password)) points -= 2;
  const unique = new Set(password).size;
  if (unique < password.length / 3) points -= 1;

  if (points >= 5) return { score: 4, label: "Very strong" };
  if (points >= 4) return { score: 3, label: "Strong" };
  if (points >= 2) return { score: 2, label: "Fair" };
  return { score: 1, label: "Weak" };
}

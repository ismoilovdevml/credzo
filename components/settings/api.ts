import { ApiError, errorMessage as baseErrorMessage } from "@/lib/api-client";

function formatWait(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)} s`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} min`;
}

/** Error text for the settings screens; rate-limited requests (429) say when to retry. */
export function errorMessage(error: unknown, fallback?: string): string {
  if (error instanceof ApiError && error.status === 429) {
    return `Too many attempts. ${error.retryAfter ? `Try again in ${formatWait(error.retryAfter)}.` : "Try again later."}`;
  }
  return baseErrorMessage(error, fallback);
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/components/generator/api";

/** Revealed secrets re-mask after this delay. */
export const SECRET_AUTO_HIDE_MS = 30_000;

/**
 * Secret values of one credential. The audited reveal endpoint is called at most
 * once per page lifetime (retried only if it failed); every secret field shares
 * that result. Each revealed field re-masks itself after 30 s.
 */
export function useCredentialSecrets(credentialId: string) {
  const request = useRef<Promise<Record<string, string>> | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const active = timers.current;
    return () => {
      active.forEach(clearTimeout);
      active.clear();
    };
  }, []);

  const load = useCallback((): Promise<Record<string, string>> => {
    if (!request.current) {
      const promise = apiRequest<{ fields: Record<string, string> }>(`/api/credentials/${credentialId}/reveal`, {
        method: "POST",
      }).then((data) => data.fields ?? {});
      request.current = promise;
      promise.then(setValues, () => {
        request.current = null;
      });
    }
    return request.current;
  }, [credentialId]);

  /** Plain value of one secret field (for copy); does not reveal it on screen. */
  const getSecret = useCallback(
    async (name: string): Promise<string> => {
      const fields = await load();
      const value = fields[name];
      if (!value) throw new Error("This secret has no value");
      return value;
    },
    [load]
  );

  const hide = useCallback((name: string) => {
    const timer = timers.current.get(name);
    if (timer) clearTimeout(timer);
    timers.current.delete(name);
    setRevealed((current) => {
      const next = new Set(current);
      next.delete(name);
      return next;
    });
  }, []);

  const reveal = useCallback(
    async (name: string) => {
      setPending(name);
      try {
        await load();
      } finally {
        setPending(null);
      }
      const existing = timers.current.get(name);
      if (existing) clearTimeout(existing);
      timers.current.set(
        name,
        setTimeout(() => hide(name), SECRET_AUTO_HIDE_MS)
      );
      setRevealed((current) => new Set(current).add(name));
    },
    [load, hide]
  );

  return { values, revealed, pending, reveal, hide, getSecret, load };
}

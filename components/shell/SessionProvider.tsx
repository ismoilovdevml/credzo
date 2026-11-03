"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  /** "First Last", falling back to the username. */
  name: string;
  /** Platform role: "platform_admin" | "user". */
  role: string;
  avatarUrl?: string;
  totpEnabled: boolean;
}

export interface SessionOrganization {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface SessionContextValue {
  user: SessionUser | null;
  organization: SessionOrganization | null;
  /** Role in the current organisation: "owner" | "admin" | "member" | "viewer", or null. */
  role: string | null;
  /** Platform admin, or owner/admin of the current organisation. Gates the Admin nav group. */
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  /** True until the first session request settles. */
  loading: boolean;
  /** Message when the session could not be loaded for a reason other than 401. */
  error: string | null;
  /** Re-fetch the session (e.g. after editing the profile or enabling 2FA). */
  refresh: () => Promise<void>;
  /** Number of projects visible to the user (sidebar badge); null until loaded. */
  projectCount: number | null;
  /** Re-fetch the project count after creating or deleting a project. */
  refreshProjectCount: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null;
const str = (value: unknown): string => (typeof value === "string" ? value : "");

interface ParsedSession {
  user: SessionUser;
  organization: SessionOrganization | null;
  role: string | null;
  isPlatformAdmin: boolean;
}

/** Accepts both `{ success, user, ... }` and `{ success, data: { user, ... } }` payloads. */
function parseSession(payload: unknown): ParsedSession | null {
  if (!isObject(payload)) return null;
  const body = isObject(payload.data) && isObject(payload.data.user) ? payload.data : payload;
  const rawUser = body.user;
  if (!isObject(rawUser) || !str(rawUser.id)) return null;

  const firstName = str(rawUser.firstName);
  const lastName = str(rawUser.lastName);
  const username = str(rawUser.username);
  const user: SessionUser = {
    id: str(rawUser.id),
    username,
    email: str(rawUser.email),
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim() || username || str(rawUser.email),
    role: str(rawUser.role) || "user",
    avatarUrl: str(rawUser.avatarUrl) || undefined,
    totpEnabled: rawUser.totpEnabled === true,
  };

  const rawOrg = body.organization;
  const organization: SessionOrganization | null =
    isObject(rawOrg) && str(rawOrg.id)
      ? { id: str(rawOrg.id), name: str(rawOrg.name), slug: str(rawOrg.slug), description: str(rawOrg.description) || undefined }
      : null;

  const isPlatformAdmin = typeof body.isPlatformAdmin === "boolean" ? body.isPlatformAdmin : user.role === "platform_admin";

  return { user, organization, role: str(body.organizationRole) || null, isPlatformAdmin };
}

function redirectToLogin(router: ReturnType<typeof useRouter>) {
  const next = window.location.pathname + window.location.search;
  router.replace(`/login?next=${encodeURIComponent(next)}`);
}

/** Loads GET /api/auth/session once and shares it. Redirects to /login on 401. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<ParsedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectCount, setProjectCount] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) {
        setSession(null);
        redirectToLogin(router);
        return;
      }
      if (!response.ok) throw new Error(`Session request failed (${response.status})`);
      const parsed = parseSession(await response.json());
      if (!parsed) {
        setSession(null);
        redirectToLogin(router);
        return;
      }
      setSession(parsed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const refreshProjectCount = useCallback(async () => {
    try {
      const response = await fetch("/api/projects", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) return;
      const payload: unknown = await response.json();
      if (isObject(payload) && Array.isArray(payload.data)) setProjectCount(payload.data.length);
    } catch {
      // The count is decorative; keep the previous value when the request fails.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const userId = session?.user.id;
  useEffect(() => {
    if (userId) void refreshProjectCount();
  }, [userId, refreshProjectCount]);

  const value = useMemo<SessionContextValue>(() => {
    const role = session?.role ?? null;
    const isPlatformAdmin = session?.isPlatformAdmin ?? false;
    return {
      user: session?.user ?? null,
      organization: session?.organization ?? null,
      role,
      isPlatformAdmin,
      isAdmin: isPlatformAdmin || role === "owner" || role === "admin",
      loading,
      error,
      refresh,
      projectCount,
      refreshProjectCount,
    };
  }, [session, loading, error, refresh, projectCount, refreshProjectCount]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Current session. Must be used under the dashboard layout. */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

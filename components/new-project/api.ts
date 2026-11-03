/** POST /api/projects client for the new-project screen. */

export interface CreateProjectInput {
  name: string;
  description: string;
  /** null creates a personal project. */
  organizationId: string | null;
}

export interface CreatedProject {
  id: string;
  name: string;
}

export class CreateProjectError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "CreateProjectError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Creates the project. On 401 it redirects to /login?next=<current path> and throws. */
export async function createProject(input: CreateProjectInput): Promise<CreatedProject> {
  let response: Response;
  try {
    response = await fetch("/api/projects", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new CreateProjectError("Network error. Check your connection and try again.", 0);
  }

  if (response.status === 401) {
    const next = window.location.pathname + window.location.search;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    throw new CreateProjectError("Your session has expired. Please sign in again.", 401);
  }

  const payload: unknown = await response.json().catch(() => null);
  const data = isObject(payload) && payload.success === true && isObject(payload.data) ? payload.data : null;

  if (!response.ok || !data || typeof data.id !== "string") {
    const message =
      isObject(payload) && typeof payload.error === "string" && payload.error
        ? payload.error
        : `Couldn't create the project (error ${response.status}).`;
    throw new CreateProjectError(message, response.status);
  }

  return { id: data.id, name: typeof data.name === "string" ? data.name : input.name };
}

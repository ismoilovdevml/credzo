/** POST /api/projects client for the new-project screen. */

import { api } from "@/lib/api-client";

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

/** Creates the project; throws ApiError on failure (a 401 redirects to /login first). */
export function createProject(input: CreateProjectInput): Promise<CreatedProject> {
  return api.post<CreatedProject>("/api/projects", input, { fallbackError: "Couldn't create the project." });
}

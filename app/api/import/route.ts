import { NextRequest, NextResponse } from "next/server";
import { createCredential, createProject, getDb } from "@/lib/db";
import {
  handleRouteError,
  readJsonBody,
  requireAuth,
  successResponse,
} from "@/lib/middleware";
import { getDefaultProjectOrganizationId } from "@/lib/authorization";
import { logProjectCreated } from "@/lib/audit";
import { PROJECT_CONFIG, REQUEST_LIMITS } from "@/lib/config/constants";
import { type CredentialInput, parseCredentialInput } from "@/lib/utils/credentials";
import { ValidationError } from "@/lib/utils/errors";
import {
  isPlainObject,
  readOptionalString,
  readRequiredString,
  requireObject,
} from "@/lib/utils/input";

interface ImportedProject {
  name: string;
  description: string;
  credentials: CredentialInput[];
}

/** Re-throw validation errors with the position of the offending item. */
function withLocation<T>(location: string, parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ValidationError(`${location}: ${error.message}`);
    }
    throw error;
  }
}

function parseImportedProject(value: unknown, index: number): ImportedProject {
  const location = `Project #${index + 1}`;
  return withLocation(location, () => {
    const body = requireObject(value, "Project");
    const credentials = body.credentials ?? [];
    if (!Array.isArray(credentials)) {
      throw new ValidationError("Credentials must be a list");
    }
    if (credentials.length > REQUEST_LIMITS.IMPORT_MAX_CREDENTIALS_PER_PROJECT) {
      throw new ValidationError(
        `A project can contain at most ${REQUEST_LIMITS.IMPORT_MAX_CREDENTIALS_PER_PROJECT} credentials`
      );
    }

    return {
      name: readRequiredString(body, "name", "Project name", {
        min: PROJECT_CONFIG.NAME_MIN_LENGTH,
        max: PROJECT_CONFIG.NAME_MAX_LENGTH,
      }),
      description:
        readOptionalString(body, "description", "Description", {
          max: PROJECT_CONFIG.DESCRIPTION_MAX_LENGTH,
        }) ?? "",
      credentials: credentials.map((credential, credentialIndex) =>
        withLocation(`Credential #${credentialIndex + 1}`, () =>
          parseCredentialInput(requireObject(credential, "Credential"))
        )
      ),
    };
  });
}

/** Accepts the export envelope `{ projects: [...] }` or a bare array of projects. */
function parseImportPayload(payload: unknown): ImportedProject[] {
  const projects = isPlainObject(payload) ? payload.projects : payload;
  if (!Array.isArray(projects)) {
    throw new ValidationError("Import must be a list of projects or an object with a projects list");
  }
  if (projects.length === 0) {
    throw new ValidationError("Import contains no projects");
  }
  if (projects.length > REQUEST_LIMITS.IMPORT_MAX_PROJECTS) {
    throw new ValidationError(
      `An import can contain at most ${REQUEST_LIMITS.IMPORT_MAX_PROJECTS} projects`
    );
  }
  return projects.map(parseImportedProject);
}

/**
 * POST /api/import
 * Imports projects with their credentials (max 5 MB). The whole payload is
 * validated first and written in one transaction, so an import is all-or-nothing.
 * Imported projects are owned by the caller, in their default organization.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { authContext } = auth;
    const userId = authContext.user.id;
    const projects = parseImportPayload(
      await readJsonBody(request, REQUEST_LIMITS.IMPORT_JSON_BYTES)
    );
    const organizationId = getDefaultProjectOrganizationId(authContext);

    const created = getDb().transaction(() =>
      projects.map((input) => {
        const project = createProject(input.name, input.description, userId, organizationId);
        for (const credential of input.credentials) {
          createCredential(project.id, { ...credential, createdBy: userId }, userId);
        }
        return { id: project.id, name: project.name, credentials: input.credentials.length };
      })
    )();

    for (const project of created) {
      logProjectCreated(userId, project.id, project.name, organizationId, {
        source: "import",
        credentials: project.credentials,
      });
    }

    return successResponse({
      projects: created.length,
      credentials: created.reduce((total, project) => total + project.credentials, 0),
      projectIds: created.map((project) => project.id),
    });
  } catch (error) {
    return handleRouteError(error, "POST /api/import");
  }
}

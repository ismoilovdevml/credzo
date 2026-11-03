import type { Project, Credential } from "./types";

// API helper function
async function apiCall(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "API request failed");
  }

  return data.data;
}

// ===== Projects API =====

export async function getProjects(): Promise<Project[]> {
  try {
    return await apiCall("/api/projects");
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return [];
  }
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    return await apiCall(`/api/projects/${id}`);
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return null;
  }
}

export async function createProject(name: string, description: string = ""): Promise<Project | null> {
  try {
    return await apiCall("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
  } catch (error) {
    console.error("Failed to create project:", error);
    return null;
  }
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
  try {
    return await apiCall(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  } catch (error) {
    console.error("Failed to update project:", error);
    return null;
  }
}

export async function deleteProject(id: string): Promise<boolean> {
  try {
    await apiCall(`/api/projects/${id}`, {
      method: "DELETE",
    });
    return true;
  } catch (error) {
    console.error("Failed to delete project:", error);
    return false;
  }
}

// ===== Credentials API =====

export async function addCredential(
  projectId: string,
  data: Omit<Credential, "id" | "createdAt" | "updatedAt">
): Promise<Credential | null> {
  try {
    return await apiCall("/api/credentials", {
      method: "POST",
      body: JSON.stringify({ projectId, ...data }),
    });
  } catch (error) {
    console.error("Failed to create credential:", error);
    return null;
  }
}

export async function updateCredential(
  projectId: string,
  credentialId: string,
  updates: Partial<Credential>
): Promise<Credential | null> {
  try {
    return await apiCall(`/api/credentials/${credentialId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  } catch (error) {
    console.error("Failed to update credential:", error);
    return null;
  }
}

export async function deleteCredential(projectId: string, credentialId: string): Promise<boolean> {
  try {
    await apiCall(`/api/credentials/${credentialId}`, {
      method: "DELETE",
    });
    return true;
  } catch (error) {
    console.error("Failed to delete credential:", error);
    return false;
  }
}

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Plus,
  FolderOpen,
  Key,
  Search,
  Trash2,
  Loader2,
  Users,
  Grid3x3,
  List,
  Calendar,
  TrendingUp,
  Activity,
  Clock,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/useToast";
import type { Project } from "@/lib/types";

interface ExtendedProject extends Project {
  memberCount?: number;
  recentActivity?: number;
  currentUserRole?: 'owner' | 'editor' | 'viewer' | null;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ExtendedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'credentials'>('updated');
  const { toast, showToast, hideToast } = useToast();

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string; credCount: number } | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/projects");
      if (!response.ok) throw new Error("Failed to fetch projects");

      const data = await response.json();
      setProjects(data.data || []);
    } catch (error) {
      console.error("Failed to load projects:", error);
      showToast("Failed to load projects", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleDeleteProject = (id: string) => {
    const project = projects.find(p => p.id === id);
    const credCount = project?.credentials.length || 0;

    setProjectToDelete({
      id,
      name: project?.name || "Unknown Project",
      credCount
    });
    setDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;

    try {
      const response = await fetch(`/api/projects/${projectToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showToast(`Project "${projectToDelete.name}" deleted successfully`, "success");
        loadProjects();
      } else {
        showToast("Failed to delete project. Please try again.", "error");
      }
    } catch (error) {
      console.error("Delete project error:", error);
      showToast("Failed to delete project. Please try again.", "error");
    }

    setProjectToDelete(null);
    setDeleteDialog(false);
  };


  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projects.filter((project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.description?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    );

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'credentials':
          return b.credentials.length - a.credentials.length;
        case 'updated':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return filtered;
  }, [projects, searchQuery, sortBy]);

  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const totalCredentials = projects.reduce((sum, p) => sum + p.credentials.length, 0);
    const avgCredentials = totalProjects > 0 ? Math.round(totalCredentials / totalProjects) : 0;
    const recentlyUpdated = projects.filter(p => {
      const daysSinceUpdate = (Date.now() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate <= 7;
    }).length;

    return { totalProjects, totalCredentials, avgCredentials, recentlyUpdated };
  }, [projects]);


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-blue-600" />
            Projects
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            Manage credential projects and team access
          </p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-1.5" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase">Total</p>
              <p className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-0.5">{stats.totalProjects}</p>
            </div>
            <FolderOpen className="w-8 h-8 text-blue-600/30" />
          </div>
        </Card>

        <Card className="p-3 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 dark:text-green-400 font-medium uppercase">Credentials</p>
              <p className="text-xl font-bold text-green-900 dark:text-green-100 mt-0.5">{stats.totalCredentials}</p>
            </div>
            <Key className="w-8 h-8 text-green-600/30" />
          </div>
        </Card>

        <Card className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium uppercase">Avg / Project</p>
              <p className="text-xl font-bold text-purple-900 dark:text-purple-100 mt-0.5">{stats.avgCredentials}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-600/30" />
          </div>
        </Card>

        <Card className="p-3 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium uppercase">Active (7d)</p>
              <p className="text-xl font-bold text-orange-900 dark:text-orange-100 mt-0.5">{stats.recentlyUpdated}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-600/30" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="updated">Recently Updated</option>
            <option value="name">Name (A-Z)</option>
            <option value="credentials">Most Credentials</option>
          </select>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              onClick={() => setViewMode('grid')}
              className="h-9 w-9 p-0"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => setViewMode('list')}
              className="h-9 w-9 p-0"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Projects */}
      {filteredAndSortedProjects.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl">
              <FolderOpen className="w-12 h-12 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            {searchQuery ? "No projects found" : "No projects yet"}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            {searchQuery
              ? "Try adjusting your search query"
              : "Get started by creating your first project"}
          </p>
          {!searchQuery && (
            <Link href="/dashboard/projects/new">
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                Create First Project
              </Button>
            </Link>
          )}
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedProjects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card className="group hover:shadow-lg transition-all h-full flex flex-col">
                <CardHeader className="p-4">
                  <Link href={`/dashboard/projects/${project.id}`}>
                    <CardTitle className="text-base group-hover:text-blue-600 transition-colors cursor-pointer line-clamp-1 mb-2">
                      {project.name}
                    </CardTitle>
                  </Link>
                  {project.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="flex-1 flex flex-col justify-between p-4 pt-0">
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <Key className="w-3.5 h-3.5" />
                      <span className="font-semibold text-gray-900 dark:text-white">{project.credentials.length}</span>
                      <span>credentials</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/dashboard/projects/${project.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs">
                        Open
                      </Button>
                    </Link>
                    {project.currentUserRole === 'owner' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteProject(project.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAndSortedProjects.map((project) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Card className="hover:shadow-md transition-all">
                <div className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex-shrink-0">
                      <FolderOpen className="w-5 h-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <Link href={`/dashboard/projects/${project.id}`}>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white hover:text-blue-600 transition-colors cursor-pointer truncate">
                          {project.name}
                        </h3>
                      </Link>
                      {project.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {project.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <Key className="w-3.5 h-3.5" />
                        <span className="font-semibold text-gray-900 dark:text-white">{project.credentials.length}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Link href={`/dashboard/projects/${project.id}`}>
                        <Button size="sm" variant="outline" className="h-8 px-3 text-xs">
                          Open
                        </Button>
                      </Link>
                      {project.currentUserRole === 'owner' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteProject(project.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isOpen={toast.isOpen}
        onClose={hideToast}
      />

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog}
        onClose={() => {
          setDeleteDialog(false);
          setProjectToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Project"
        message={`Delete "${projectToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete Project"
        cancelText="Cancel"
        variant="danger"
        details={[
          `${projectToDelete?.credCount || 0} credential(s) will be deleted`,
          "All project data will be permanently removed",
        ]}
      />
    </div>
  );
}

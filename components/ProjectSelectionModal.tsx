"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Folder, Check } from "lucide-react";
import { Button } from "./ui/button";
import type { Project } from "@/lib/types";

interface ProjectSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (projectIds: string[]) => void;
  projects: Project[];
}

export function ProjectSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  projects,
}: ProjectSelectionModalProps) {
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const handleToggleProject = (projectId: string) => {
    setSelectedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedProjects(new Set());
      setSelectAll(false);
    } else {
      setSelectedProjects(new Set(projects.map((p) => p.id)));
      setSelectAll(true);
    }
  };

  const handleConfirm = () => {
    if (selectedProjects.size === 0) return;
    onConfirm(Array.from(selectedProjects));
    handleClose();
  };

  const handleClose = () => {
    setSelectedProjects(new Set());
    setSelectAll(false);
    onClose();
  };

  const selectedCount = selectedProjects.size;
  const totalCredentials = projects
    .filter((p) => selectedProjects.has(p.id))
    .reduce((sum, p) => sum + p.credentials.length, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                <button
                  onClick={handleClose}
                  className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Folder className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black">Select Projects to Export</h2>
                    <p className="text-blue-100 text-sm">
                      Choose which projects you want to include in the export
                    </p>
                  </div>
                </div>
              </div>

              {/* Selection Stats */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-700">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {selectedCount}
                    </span>{" "}
                    project(s) selected
                    {selectedCount > 0 && (
                      <>
                        {" • "}
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {totalCredentials}
                        </span>{" "}
                        credential(s)
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleSelectAll}
                    className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    {selectAll ? "Deselect All" : "Select All"}
                  </button>
                </div>
              </div>

              {/* Project List */}
              <div className="flex-1 overflow-y-auto p-4">
                {projects.length === 0 ? (
                  <div className="text-center py-12">
                    <Folder className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">No projects available</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projects.map((project) => {
                      const isSelected = selectedProjects.has(project.id);
                      return (
                        <motion.div
                          key={project.id}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <button
                            onClick={() => handleToggleProject(project.id)}
                            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                              isSelected
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Checkbox */}
                              <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                                  isSelected
                                    ? "bg-blue-500 border-blue-500"
                                    : "border-gray-300 dark:border-gray-600"
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>

                              {/* Project Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Folder
                                    className={`w-4 h-4 ${
                                      isSelected
                                        ? "text-blue-600 dark:text-blue-400"
                                        : "text-gray-600 dark:text-gray-400"
                                    }`}
                                  />
                                  <h3
                                    className={`font-semibold truncate ${
                                      isSelected
                                        ? "text-blue-900 dark:text-blue-300"
                                        : "text-gray-900 dark:text-white"
                                    }`}
                                  >
                                    {project.name}
                                  </h3>
                                </div>
                                {project.description && (
                                  <p
                                    className={`text-sm mb-2 ${
                                      isSelected
                                        ? "text-blue-700 dark:text-blue-400"
                                        : "text-gray-600 dark:text-gray-400"
                                    }`}
                                  >
                                    {project.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 text-xs">
                                  <span
                                    className={
                                      isSelected
                                        ? "text-blue-600 dark:text-blue-400"
                                        : "text-gray-500 dark:text-gray-500"
                                    }
                                  >
                                    {project.credentials.length} credential(s)
                                  </span>
                                  <span
                                    className={
                                      isSelected
                                        ? "text-blue-600 dark:text-blue-400"
                                        : "text-gray-500 dark:text-gray-500"
                                    }
                                  >
                                    Updated: {new Date(project.updatedAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex gap-3">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleConfirm} disabled={selectedCount === 0} className="flex-1">
                  Continue ({selectedCount})
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Eye, EyeOff, Edit, Trash2, Server } from "lucide-react";
import { ServiceIcon } from "./ServiceIcon";
import { getServiceMetadata } from "@/lib/services";
import type { Credential } from "@/lib/types";
import { Button } from "./ui/button";

interface CredentialDetailModalProps {
  credential: Credential | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (credentialId: string) => void;
  onEdit?: (credentialId: string) => void;
  allCredentials?: Credential[];
  onCredentialClick?: (credential: Credential) => void;
}

// Helper function to get color classes based on category
function getColorClass(category: string): string {
  switch (category) {
    case "Servers":
      return "bg-blue-500";
    case "Database":
      return "bg-purple-500";
    case "Message Queue":
      return "bg-pink-500";
    case "Storage":
      return "bg-cyan-500";
    case "CI/CD":
      return "bg-indigo-500";
    case "Container":
      return "bg-blue-600";
    case "Monitoring":
      return "bg-green-500";
    case "Caching":
      return "bg-red-500";
    case "Proxy":
      return "bg-orange-500";
    case "Version Control":
      return "bg-gray-700";
    case "Cloud":
      return "bg-sky-500";
    case "Config Management":
      return "bg-violet-500";
    case "Communication":
      return "bg-teal-500";
    case "Authentication":
      return "bg-amber-500";
    case "Other":
      return "bg-gray-500";
    default:
      return "bg-gray-500";
  }
}

export function CredentialDetailModal({
  credential,
  isOpen,
  onClose,
  onDelete,
  onEdit,
  allCredentials = [],
  onCredentialClick,
}: CredentialDetailModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());

  if (!credential) return null;

  const serviceMetadata = getServiceMetadata(credential.type);
  const colorClass = getColorClass(serviceMetadata?.category || "Other");
  const sensitiveKeys = ["password", "secret", "key", "token", "apikey", "privatekey"];

  // Get linked server credentials
  const linkedServers = (credential.linkedServers || [])
    .map((serverId) => allCredentials.find((c) => c.id === serverId))
    .filter((server): server is Credential => server !== undefined);

  // Get linked services (credentials that have this credential in their linkedServers)
  const linkedServices = allCredentials.filter((cred) =>
    (cred.linkedServers || []).includes(credential.id)
  );

  // Check if this is a server credential
  const isServerCredential = ["vm-server", "ssh-server", "ftp", "sftp"].includes(credential.type);

  const copyToClipboard = async (text: string, fieldName: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const toggleFieldVisibility = (fieldName: string) => {
    setVisibleFields((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fieldName)) {
        newSet.delete(fieldName);
      } else {
        newSet.add(fieldName);
      }
      return newSet;
    });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this credential?")) {
      onDelete?.(credential.id);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-start gap-4">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center ${colorClass} shadow-lg`}
                  >
                    <ServiceIcon type={credential.type} className="w-8 h-8 text-white" />
                  </div>

                  <div className="flex-1">
                    <h2 className="text-2xl font-black mb-1">{credential.name}</h2>
                    <p className="text-blue-100 text-sm">{serviceMetadata?.label || credential.type}</p>
                    {credential.description && (
                      <p className="text-white/80 text-sm mt-2">{credential.description}</p>
                    )}
                  </div>
                </div>

                {/* Category Badge */}
                <div className="mt-4">
                  <span className="inline-flex items-center px-3 py-1 text-xs font-semibold bg-white/20 text-white rounded-full backdrop-blur-sm">
                    {serviceMetadata?.category || "Other"}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
                <div className="space-y-4">
                  {Object.entries(credential.fields || {}).map(([key, value]) => {
                    if (value === null || value === undefined || value === "") return null;

                    const isSensitive = sensitiveKeys.some((sk) => key.toLowerCase().includes(sk));
                    const isVisible = visibleFields.has(key);
                    const label = key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (str) => str.toUpperCase())
                      .trim();

                    const displayValue = String(value);

                    return (
                      <div
                        key={key}
                        className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                            {label}
                          </div>
                          <div className="text-sm text-gray-900 dark:text-white font-mono break-all">
                            {isSensitive && !isVisible ? "••••••••••••••••" : displayValue}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isSensitive && (
                            <button
                              onClick={() => toggleFieldVisibility(key)}
                              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
                              title={isVisible ? "Hide" : "Show"}
                            >
                              {isVisible ? (
                                <EyeOff className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                              ) : (
                                <Eye className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => copyToClipboard(displayValue, key)}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
                            title="Copy to clipboard"
                          >
                            {copiedField === key ? (
                              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Linked Servers */}
                {linkedServers.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      <Server className="w-4 h-4" />
                      Linked Servers ({linkedServers.length})
                    </div>
                    <div className="space-y-2">
                      {linkedServers.map((server) => (
                        <div
                          key={server.id}
                          onClick={() => onCredentialClick?.(server)}
                          className={`flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl ${
                            onCredentialClick ? "cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-300 dark:hover:border-blue-600 transition-all" : ""
                          }`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <ServiceIcon type={server.type} className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">{server.name}</div>
                            {server.description && (
                              <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{server.description}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Linked Services (shown only for server credentials) */}
                {isServerCredential && linkedServices.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      <Server className="w-4 h-4" />
                      Services Using This Server ({linkedServices.length})
                    </div>
                    <div className="space-y-2">
                      {linkedServices.map((service) => {
                        const serviceMeta = getServiceMetadata(service.type);
                        const serviceColor = getColorClass(serviceMeta?.category || "Other");
                        return (
                          <div
                            key={service.id}
                            onClick={() => onCredentialClick?.(service)}
                            className={`flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl ${
                              onCredentialClick ? "cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/50 hover:border-green-300 dark:hover:border-green-600 transition-all" : ""
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-lg ${serviceColor} flex items-center justify-center flex-shrink-0`}>
                              <ServiceIcon type={service.type} className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">{service.name}</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                {serviceMeta?.label || service.type}
                                {service.description && ` • ${service.description}`}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Created:</span>
                      <div className="text-gray-900 dark:text-white font-mono mt-1">
                        {new Date(credential.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Updated:</span>
                      <div className="text-gray-900 dark:text-white font-mono mt-1">
                        {new Date(credential.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
                <div className="flex gap-2">
                  {onEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onEdit(credential.id);
                        onClose();
                      }}
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </Button>
                  )}
                  {onDelete && (
                    <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

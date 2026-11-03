"use client";

import { ServiceIcon } from "./ServiceIcon";
import { getServiceMetadata } from "@/lib/services";
import type { Credential } from "@/lib/types";
import { motion } from "framer-motion";

interface CredentialCardProps {
  credential: Credential;
  onClick: () => void;
  index: number;
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

export function CredentialCard({ credential, onClick, index }: CredentialCardProps) {
  const serviceMetadata = getServiceMetadata(credential.type);
  const colorClass = getColorClass(serviceMetadata?.category || "Other");

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={onClick}
      className="group relative bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg transition-all p-4 text-left w-full"
    >
      {/* Service Icon */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass} group-hover:scale-110 transition-transform shadow-md`}
        >
          <ServiceIcon type={credential.type} className="w-6 h-6 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {credential.name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{serviceMetadata?.label || credential.type}</p>
        </div>
      </div>

      {/* Description */}
      {credential.description && (
        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{credential.description}</p>
      )}

      {/* Quick Info */}
      <div className="space-y-1">
        {credential.fields?.host && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 dark:text-gray-400 w-12 flex-shrink-0">Host:</span>
            <span className="text-gray-900 dark:text-white font-mono truncate">{String(credential.fields.host)}</span>
          </div>
        )}
        {credential.fields?.endpoint && !credential.fields?.host && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 dark:text-gray-400 w-12 flex-shrink-0">URL:</span>
            <span className="text-gray-900 dark:text-white font-mono truncate">{String(credential.fields.endpoint)}</span>
          </div>
        )}
        {credential.fields?.username && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 dark:text-gray-400 w-12 flex-shrink-0">User:</span>
            <span className="text-gray-900 dark:text-white font-mono truncate">{String(credential.fields.username)}</span>
          </div>
        )}
      </div>

      {/* Category Badge */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <span className="inline-flex items-center px-2 py-1 text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
          {serviceMetadata?.category || "Other"}
        </span>
      </div>

      {/* Hover indicator */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-3 h-3 text-blue-600 dark:text-blue-300"
          >
            <path
              fillRule="evenodd"
              d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    </motion.button>
  );
}

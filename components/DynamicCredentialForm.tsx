"use client";

import { useState } from "react";
import { getServiceMetadata } from "@/lib/services";
import type { ServiceType, Credential } from "@/lib/types";
import { Eye, EyeOff, Server } from "lucide-react";

interface DynamicCredentialFormProps {
  serviceType: ServiceType;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
  serverCredentials?: Credential[];
  initialData?: Record<string, any>;
  initialLinkedServers?: string[];
  isEditMode?: boolean;
}

export function DynamicCredentialForm({
  serviceType,
  onSubmit,
  isSubmitting,
  serverCredentials = [],
  initialData = {},
  initialLinkedServers = [],
  isEditMode = false,
}: DynamicCredentialFormProps) {
  const serviceMetadata = getServiceMetadata(serviceType);
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [selectedServers, setSelectedServers] = useState<string[]>(initialLinkedServers);

  if (!serviceMetadata) {
    return <div className="text-red-600">Service type not found</div>;
  }

  const handleChange = (fieldName: string, value: string) => {
    setFormData({ ...formData, [fieldName]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...formData, linkedServers: selectedServers });
  };

  const toggleServerSelection = (serverId: string) => {
    setSelectedServers((prev) =>
      prev.includes(serverId)
        ? prev.filter((id) => id !== serverId)
        : [...prev, serverId]
    );
  };

  const togglePasswordVisibility = (fieldName: string) => {
    setShowPassword({ ...showPassword, [fieldName]: !showPassword[fieldName] });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Credential Name (always required) */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Credential Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name || ""}
          onChange={(e) => handleChange("name", e.target.value)}
          placeholder={`e.g., Production ${serviceMetadata.label}`}
          required
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
        />
      </div>

      {/* Description (always optional) */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
        <textarea
          name="description"
          value={formData.description || ""}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder={`e.g., ${serviceMetadata.label} credentials for production environment`}
          rows={2}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
        />
      </div>

      {/* Dynamic fields based on service type */}
      {serviceMetadata.fields.map((field) => {
        const isPassword = field.type === "password";
        const isTextarea = field.type === "textarea";
        const fieldValue = formData[field.name] || "";

        return (
          <div key={field.name}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {isTextarea ? (
              <textarea
                name={field.name}
                value={fieldValue}
                onChange={(e) => handleChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none font-mono text-sm"
              />
            ) : (
              <div className="relative">
                <input
                  type={isPassword && !showPassword[field.name] ? "password" : field.type}
                  name={field.name}
                  value={fieldValue}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  className={`w-full px-4 ${isPassword ? "pr-12" : ""} py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all ${isPassword ? "font-mono" : ""}`}
                />
                {isPassword && (
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility(field.name)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword[field.name] ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                )}
              </div>
            )}

            {field.description && (
              <p className="mt-1 text-xs text-gray-500">{field.description}</p>
            )}
          </div>
        );
      })}

      {/* Link to Servers (Optional) */}
      {serverCredentials.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <Server className="w-4 h-4 inline mr-2" />
            Link to Servers (Optional)
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Select servers where this credential will be used
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto p-3 border border-gray-200 rounded-xl bg-gray-50">
            {serverCredentials.map((server) => (
              <label
                key={server.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedServers.includes(server.id)}
                  onChange={() => toggleServerSelection(server.id)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{server.name}</div>
                  {server.description && (
                    <div className="text-xs text-gray-500">{server.description}</div>
                  )}
                </div>
              </label>
            ))}
          </div>
          {selectedServers.length > 0 && (
            <p className="text-xs text-blue-600 mt-2">
              {selectedServers.length} server(s) selected
            </p>
          )}
        </div>
      )}

      {/* Submit button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Saving..." : (isEditMode ? "Update Credential" : "Save Credential")}
        </button>
      </div>
    </form>
  );
}

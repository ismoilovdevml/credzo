"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, Upload, Sun, Moon, Monitor, FolderCheck, User, Lock, Mail, Building, Briefcase, Check, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toast } from "@/components/Toast";
import { PasswordModal } from "@/components/PasswordModal";
import { ProjectSelectionModal } from "@/components/ProjectSelectionModal";
import { useToast } from "@/hooks/useToast";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { encryptData, decryptData } from "@/lib/crypto";
import type { Project, UserProfile } from "@/lib/types";

export default function SettingsPage() {
  const [importing, setImporting] = useState(false);
  const [projectCount, setProjectCount] = useState(0);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const { toast, showToast, hideToast } = useToast();
  const { theme, setTheme } = useTheme();
  const [projectSelectionModal, setProjectSelectionModal] = useState(false);
  const [exportPasswordModal, setExportPasswordModal] = useState(false);
  const [importPasswordModal, setImportPasswordModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingExportData, setPendingExportData] = useState<string | null>(null);

  // User Profile states
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    company: "",
    role: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetch("/api/projects");
        if (response.ok) {
          const data = await response.json();
          const projects = data.data || [];
          setProjectCount(projects.length);
          setAllProjects(projects);
        }
      } catch (error) {
        console.error("Failed to load projects:", error);
      }
    }
    loadStats();
  }, []);

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const response = await fetch("/api/user-profile");
        const result = await response.json();
        if (result.success) {
          setUserProfile(result.data);
          setProfileForm({
            username: result.data.username,
            email: result.data.email,
            firstName: result.data.firstName,
            lastName: result.data.lastName,
            company: result.data.company || "",
            role: result.data.role || "",
          });
        }
      } catch (error) {
        console.error("Failed to load user profile:", error);
      }
    }
    loadUserProfile();
  }, []);

  const handleExportAll = async () => {
    try {
      const response = await fetch("/api/projects");
      if (!response.ok) throw new Error("Failed to fetch projects");

      const data = await response.json();
      const projects = data.data || [];

      if (projects.length === 0) {
        showToast("No projects to export", "warning");
        return;
      }

      // Create export data with metadata
      const exportData = {
        type: "full",
        version: "1.0",
        exportedAt: new Date().toISOString(),
        projects,
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      setPendingExportData(dataStr);
      setExportPasswordModal(true);
    } catch (error) {
      showToast("Failed to export data", "error");
    }
  };

  const handleExportSelected = () => {
    if (allProjects.length === 0) {
      showToast("No projects available", "warning");
      return;
    }
    setProjectSelectionModal(true);
  };

  const handleProjectsSelected = async (projectIds: string[]) => {
    try {
      const selectedProjects = allProjects.filter((p) => projectIds.includes(p.id));

      if (selectedProjects.length === 0) {
        showToast("No projects selected", "warning");
        return;
      }

      // Create export data with metadata
      const exportData = {
        type: "partial",
        version: "1.0",
        exportedAt: new Date().toISOString(),
        projects: selectedProjects,
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      setPendingExportData(dataStr);
      setExportPasswordModal(true);
    } catch (error) {
      showToast("Failed to prepare export", "error");
    }
  };

  const handleExportWithPassword = async (password: string) => {
    try {
      if (!pendingExportData) return;

      // Encrypt the data
      const encryptedData = await encryptData(pendingExportData, password);

      // Create and download the encrypted file
      const dataBlob = new Blob([encryptedData], { type: "text/plain" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `credzo-export-${new Date().toISOString().split("T")[0]}.credzo`;
      link.click();
      URL.revokeObjectURL(url);

      setPendingExportData(null);
      showToast(`Exported and encrypted successfully`, "success");
    } catch (error) {
      showToast("Failed to encrypt and export data", "error");
    }
  };

  const handleImportClick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingFile(file);
    setImportPasswordModal(true);

    // Reset file input
    e.target.value = "";
  };

  const handleImportWithPassword = async (password: string) => {
    if (!pendingFile) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const encryptedData = event.target?.result as string;

        // Decrypt the data
        const decryptedData = await decryptData(encryptedData, password);
        const parsedData = JSON.parse(decryptedData);

        // Auto-detect data format
        let projectsToImport;
        let importType = "unknown";

        if (Array.isArray(parsedData)) {
          // Old format: direct array of projects
          projectsToImport = parsedData;
          importType = "legacy";
        } else if (parsedData.projects && Array.isArray(parsedData.projects)) {
          // New format: object with metadata
          projectsToImport = parsedData.projects;
          importType = parsedData.type || "unknown";
        } else {
          throw new Error("Invalid data format");
        }

        // Send to import API
        const response = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(projectsToImport),
        });

        const result = await response.json();

        if (result.success) {
          const typeLabel = importType === "partial" ? "Selected" : "All";
          showToast(
            `Import successful! ${typeLabel}: ${result.data.projects} project(s), ${result.data.credentials} credential(s)`,
            "success"
          );
          setTimeout(() => window.location.reload(), 2000);
        } else {
          showToast(`Import failed: ${result.error}`, "error");
        }
      } catch (error) {
        showToast("Invalid password or corrupted file", "error");
      } finally {
        setImporting(false);
        setPendingFile(null);
      }
    };
    reader.readAsText(pendingFile);
  };

  const handleSaveProfile = async () => {
    if (!profileForm.username || !profileForm.email || !profileForm.firstName || !profileForm.lastName) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    setSavingProfile(true);
    try {
      const response = await fetch("/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });

      const result = await response.json();

      if (result.success) {
        setUserProfile(result.data);
        setIsEditingProfile(false);
        showToast("Profile updated successfully", "success");
      } else {
        showToast(`Failed to update profile: ${result.error}`, "error");
      }
    } catch (error) {
      showToast("Failed to update profile", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelEdit = () => {
    if (userProfile) {
      setProfileForm({
        username: userProfile.username,
        email: userProfile.email,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        company: userProfile.company || "",
        role: userProfile.role || "",
      });
    }
    setIsEditingProfile(false);
  };

  // Password validation
  const getPasswordRequirements = (password: string) => {
    return {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
    };
  };

  const passwordRequirements = getPasswordRequirements(passwordForm.newPassword);
  const requirementsMet = Object.values(passwordRequirements).filter(Boolean).length;
  const totalRequirements = Object.keys(passwordRequirements).length;
  const passwordStrength = (requirementsMet / totalRequirements) * 100;

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      showToast("Please fill in all password fields", "error");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast("New passwords do not match", "error");
      return;
    }

    if (!passwordRequirements.minLength || !passwordRequirements.hasUppercase ||
        !passwordRequirements.hasLowercase || !passwordRequirements.hasNumber) {
      showToast("Password does not meet all requirements", "error");
      return;
    }

    setChangingPassword(true);
    try {
      const response = await fetch("/api/user-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const result = await response.json();

      if (result.success) {
        showToast(result.message, "success");
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        showToast(result.error, "error");
      }
    } catch (error) {
      showToast("Failed to change password", "error");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-1">Settings</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Manage your data and application preferences</p>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* User Profile */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">User Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
            {/* Profile Information */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Username */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    <User className="w-4 h-4 inline mr-1" />
                    Username *
                  </label>
                  <input
                    type="text"
                    value={profileForm.username}
                    onChange={(e) => setProfileForm({...profileForm, username: e.target.value})}
                    disabled={!isEditingProfile}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    <Mail className="w-4 h-4 inline mr-1" />
                    Email *
                  </label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                    disabled={!isEditingProfile}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* First Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm({...profileForm, firstName: e.target.value})}
                    disabled={!isEditingProfile}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm({...profileForm, lastName: e.target.value})}
                    disabled={!isEditingProfile}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* Company */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    <Building className="w-4 h-4 inline mr-1" />
                    Company
                  </label>
                  <input
                    type="text"
                    value={profileForm.company}
                    onChange={(e) => setProfileForm({...profileForm, company: e.target.value})}
                    disabled={!isEditingProfile}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    <Briefcase className="w-4 h-4 inline mr-1" />
                    Role
                  </label>
                  <input
                    type="text"
                    value={profileForm.role}
                    onChange={(e) => setProfileForm({...profileForm, role: e.target.value})}
                    disabled={!isEditingProfile}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Profile Actions */}
              <div className="flex gap-3 pt-4">
                {!isEditingProfile ? (
                  <Button onClick={() => setIsEditingProfile(true)}>
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleSaveProfile} disabled={savingProfile}>
                      {savingProfile ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button variant="outline" onClick={handleCancelEdit} disabled={savingProfile}>
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Change Password */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Change Password
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? "text" : "password"}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                      className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      {showPasswords.current ? (
                        <EyeOff className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                      className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      {showPasswords.new ? (
                        <EyeOff className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      )}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {passwordForm.newPassword && (
                    <div className="mt-2 space-y-2">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            Strength
                          </span>
                          <span className="text-xs font-semibold text-gray-900 dark:text-white">
                            {requirementsMet}/{totalRequirements}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              passwordStrength === 100
                                ? "bg-green-500"
                                : passwordStrength >= 75
                                ? "bg-blue-500"
                                : passwordStrength >= 50
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${passwordStrength}%` }}
                          />
                        </div>
                      </div>

                      {/* Requirements List */}
                      <div className="space-y-1 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Requirements:
                        </p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {passwordRequirements.minLength ? (
                              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                            )}
                            <span
                              className={`text-xs ${
                                passwordRequirements.minLength
                                  ? "text-green-700 dark:text-green-400"
                                  : "text-gray-600 dark:text-gray-400"
                              }`}
                            >
                              At least 8 characters
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {passwordRequirements.hasUppercase ? (
                              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                            )}
                            <span
                              className={`text-xs ${
                                passwordRequirements.hasUppercase
                                  ? "text-green-700 dark:text-green-400"
                                  : "text-gray-600 dark:text-gray-400"
                              }`}
                            >
                              One uppercase letter (A-Z)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {passwordRequirements.hasLowercase ? (
                              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                            )}
                            <span
                              className={`text-xs ${
                                passwordRequirements.hasLowercase
                                  ? "text-green-700 dark:text-green-400"
                                  : "text-gray-600 dark:text-gray-400"
                              }`}
                            >
                              One lowercase letter (a-z)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {passwordRequirements.hasNumber ? (
                              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                            )}
                            <span
                              className={`text-xs ${
                                passwordRequirements.hasNumber
                                  ? "text-green-700 dark:text-green-400"
                                  : "text-gray-600 dark:text-gray-400"
                              }`}
                            >
                              One number (0-9)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                      className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      {showPasswords.confirm ? (
                        <EyeOff className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      )}
                    </button>
                  </div>
                </div>
                <Button onClick={handleChangePassword} disabled={changingPassword}>
                  {changingPassword ? "Changing..." : "Change Password"}
                </Button>
              </div>
            </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Data Management */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Data Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Export Data</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    Download encrypted backup of your projects and credentials.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleExportAll} size="sm">
                      <Download className="w-4 h-4" />
                      Export All
                    </Button>
                    <Button onClick={handleExportSelected} variant="outline" size="sm">
                      <FolderCheck className="w-4 h-4" />
                      Export Selected
                    </Button>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Import Data</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    Restore from previously exported encrypted file.
                  </p>
                  <label htmlFor="import-file">
                    <Button asChild disabled={importing} size="sm">
                      <span>
                        <Upload className="w-4 h-4" />
                        {importing ? "Importing..." : "Import Data"}
                      </span>
                    </Button>
                    <input
                      id="import-file"
                      type="file"
                      accept=".credzo"
                      onChange={handleImportClick}
                      className="hidden"
                    />
                  </label>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Appearance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Appearance</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Choose your preferred color theme
                  </p>
              <div className="flex gap-2">
                {/* Light Theme */}
                <button
                  onClick={() => setTheme("light")}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                    theme === "light"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <Sun className={`w-5 h-5 ${theme === "light" ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`} />
                    <span className={`text-xs font-medium ${theme === "light" ? "text-blue-900 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>
                      Light
                    </span>
                  </div>
                </button>

                {/* Dark Theme */}
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                    theme === "dark"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <Moon className={`w-5 h-5 ${theme === "dark" ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`} />
                    <span className={`text-xs font-medium ${theme === "dark" ? "text-blue-900 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>
                      Dark
                    </span>
                  </div>
                </button>

                {/* System Theme */}
                <button
                  onClick={() => setTheme("system")}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                    theme === "system"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <Monitor className={`w-5 h-5 ${theme === "system" ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`} />
                    <span className={`text-xs font-medium ${theme === "system" ? "text-blue-900 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>
                      System
                    </span>
                  </div>
                </button>
              </div>
            </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Storage Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Storage Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Storage Type</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">SQLite</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Projects</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{projectCount}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Location</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">./data/credzo.db</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* About */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">About Credzo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <p>
                    <span className="font-semibold text-gray-900 dark:text-white">Credzo</span> is a modern credential
                    management dashboard for DevOps teams.
                  </p>
                  <p>
                    Built with Next.js 15, TypeScript, Tailwind CSS, and Framer Motion.
                  </p>
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Version 1.0.0</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isOpen={toast.isOpen}
        onClose={hideToast}
      />

      {/* Project Selection Modal */}
      <ProjectSelectionModal
        isOpen={projectSelectionModal}
        onClose={() => setProjectSelectionModal(false)}
        onConfirm={handleProjectsSelected}
        projects={allProjects}
      />

      {/* Export Password Modal */}
      <PasswordModal
        isOpen={exportPasswordModal}
        onClose={() => {
          setExportPasswordModal(false);
          setPendingExportData(null);
        }}
        onConfirm={handleExportWithPassword}
        mode="export"
      />

      {/* Import Password Modal */}
      <PasswordModal
        isOpen={importPasswordModal}
        onClose={() => {
          setImportPasswordModal(false);
          setPendingFile(null);
        }}
        onConfirm={handleImportWithPassword}
        mode="import"
      />
    </div>
  );
}

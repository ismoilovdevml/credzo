"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Key, Loader2, Search, X,
  Server, Database, Radio, HardDrive, Workflow,
  Box, Activity, Zap, Globe, GitBranch, Cloud,
  FileCode, Mail, Shield, FileText, Users, UserPlus,
  Trash2, Eye, Edit2, ChevronDown, ChevronUp, Boxes
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CredentialCard } from "@/components/CredentialCard";
import { CredentialDetailModal } from "@/components/CredentialDetailModal";
import { getServiceMetadata, getCategories } from "@/lib/services";
import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import type { Project, Credential, Service } from "@/lib/types";

// Helper function to get category icon
function getCategoryIcon(category: string) {
  const iconMap: Record<string, any> = {
    "All": Key,
    "Servers": Server,
    "Database": Database,
    "Message Queue": Radio,
    "Storage": HardDrive,
    "CI/CD": Workflow,
    "Container": Box,
    "Monitoring": Activity,
    "Caching": Zap,
    "Proxy": Globe,
    "Version Control": GitBranch,
    "Cloud": Cloud,
    "Config Management": FileCode,
    "Communication": Mail,
    "Authentication": Shield,
    "Other": FileText,
  };
  return iconMap[category] || FileText;
}

interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface ExtendedProject extends Project {
  members?: ProjectMember[];
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<ExtendedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"credentials" | "services">("credentials");

  // Services management
  const [services, setServices] = useState<Service[]>([]);
  const [addServiceModal, setAddServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    description: "",
    url: "",
    tags: [] as string[],
  });
  const [newTag, setNewTag] = useState("");
  const [selectedServiceTag, setSelectedServiceTag] = useState<string>("All");
  const [serviceSearchQuery, setServiceSearchQuery] = useState("");
  const [savingService, setSavingService] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteServiceModal, setDeleteServiceModal] = useState<{
    isOpen: boolean;
    service: Service | null;
  }>({ isOpen: false, service: null });

  // Member management
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [addMemberModal, setAddMemberModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedRole, setSelectedRole] = useState<'editor' | 'viewer'>('viewer');
  const [addingMember, setAddingMember] = useState(false);
  const [membersExpanded, setMembersExpanded] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    memberId: string | null;
    memberName: string | null;
  }>({ isOpen: false, memberId: null, memberName: null });

  // Current user permissions
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<'owner' | 'editor' | 'viewer' | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const { toast, showToast, hideToast } = useToast();

  // Permission helpers
  const canEdit = currentUserRole === 'owner' || currentUserRole === 'editor' || isPlatformAdmin;
  const canManageMembers = currentUserRole === 'owner' || isPlatformAdmin; // Only owner can manage members
  const isViewer = currentUserRole === 'viewer';

  const loadServices = async () => {
    try {
      const response = await fetch(`/api/projects/${params.id}/services`);
      const data = await response.json();

      if (data.success) {
        setServices(data.data);
      }
    } catch (error) {
      console.error("Failed to load services:", error);
    }
  };

  const loadProject = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${params.id}`);

      if (!response.ok) {
        router.push("/dashboard/projects");
        return;
      }

      const data = await response.json();
      let projectData: ExtendedProject | null = null;

      if (data.success && data.data) {
        // Load project members
        const membersRes = await fetch(`/api/projects/${params.id}/members`);
        const membersData = await membersRes.json();

        projectData = {
          ...data.data,
          members: membersData.success ? membersData.data : []
        };

        setProject(projectData);

        // Set current user's role from API response
        if (data.data.currentUserRole) {
          setCurrentUserRole(data.data.currentUserRole);
        }
      } else {
        router.push("/dashboard/projects");
        return;
      }

      // Load organization members for adding to project
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();

      if (sessionData.success && projectData) {
        const userId = sessionData.user?.id;
        const isAdmin = sessionData.user?.role === "platform_admin";

        setCurrentUserId(userId);
        setIsPlatformAdmin(isAdmin);

        // Platform admin can see all users, regular users see only their org members
        if (isAdmin) {
          // Load all users for platform admin
          const usersRes = await fetch("/api/users");
          const usersData = await usersRes.json();
          if (usersData.success) {
            setOrgMembers(usersData.data);
          }
        } else if (sessionData.organization) {
          // Load org members for regular users
          const membersRes = await fetch(`/api/organizations/${sessionData.organization.id}/members`);
          const membersData = await membersRes.json();
          if (membersData.success) {
            setOrgMembers(membersData.data);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load project:", error);
      router.push("/dashboard/projects");
      return;
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedMember) return;

    setAddingMember(true);
    try {
      const response = await fetch(`/api/projects/${params.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedMember,
          role: selectedRole,
        }),
      });

      const data = await response.json();

      if (data.success) {
        showToast("Member added to project successfully", "success");
        setAddMemberModal(false);
        setSelectedMember("");
        setSelectedRole('viewer');
        await loadProject();
      } else {
        showToast(data.error || "Failed to add member", "error");
      }
    } catch (error) {
      console.error("Add member error:", error);
      showToast("Failed to add member", "error");
    } finally {
      setAddingMember(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: 'editor' | 'viewer') => {
    try {
      const response = await fetch(`/api/projects/${params.id}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (data.success) {
        showToast("Member role updated successfully", "success");
        await loadProject();
      } else {
        showToast(data.error || "Failed to update member role", "error");
      }
    } catch (error) {
      console.error("Update member role error:", error);
      showToast("Failed to update member role", "error");
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    setConfirmModal({ isOpen: true, memberId, memberName });
  };

  const confirmRemoveMember = async () => {
    if (!confirmModal.memberId) return;

    try {
      const response = await fetch(`/api/projects/${params.id}/members/${confirmModal.memberId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        showToast("Member removed from project successfully", "success");
        await loadProject();
      } else {
        showToast(data.error || "Failed to remove member", "error");
      }
    } catch (error) {
      console.error("Remove member error:", error);
      showToast("Failed to remove member", "error");
    } finally {
      setConfirmModal({ isOpen: false, memberId: null, memberName: null });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'editor':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  useEffect(() => {
    loadProject();
    loadServices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handleDeleteCredential = async (credId: string) => {
    try {
      const response = await fetch(`/api/projects/${params.id}/credentials/${credId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        loadProject();
      } else {
        console.error("Failed to delete credential");
      }
    } catch (error) {
      console.error("Failed to delete credential:", error);
    }
  };

  const handleEditCredential = (credId: string) => {
    router.push(`/dashboard/projects/${params.id}/credentials/${credId}/edit`);
  };

  const handleCredentialClick = (credential: Credential) => {
    setSelectedCredential(credential);
    setIsModalOpen(true);
  };

  // Service handlers
  const handleOpenAddService = () => {
    setEditingService(null);
    setServiceForm({
      name: "",
      description: "",
      url: "",
      tags: [],
    });
    setAddServiceModal(true);
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      description: service.description || "",
      url: service.url || "",
      tags: service.tags || [],
    });
    setAddServiceModal(true);
  };

  const handleSaveService = async () => {
    if (!serviceForm.name.trim()) {
      showToast("Service name is required", "error");
      return;
    }

    setSavingService(true);
    try {
      const url = editingService
        ? `/api/projects/${params.id}/services/${editingService.id}`
        : `/api/projects/${params.id}/services`;

      const response = await fetch(url, {
        method: editingService ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serviceForm),
      });

      const data = await response.json();

      if (data.success) {
        showToast(
          editingService ? "Service updated successfully" : "Service created successfully",
          "success"
        );
        setAddServiceModal(false);
        setServiceForm({ name: "", description: "", url: "", tags: [] });
        setEditingService(null);
        await loadServices();
      } else {
        showToast(data.error || "Failed to save service", "error");
      }
    } catch (error) {
      console.error("Save service error:", error);
      showToast("Failed to save service", "error");
    } finally {
      setSavingService(false);
    }
  };

  const handleDeleteService = async (service: Service) => {
    setDeleteServiceModal({ isOpen: true, service });
  };

  const confirmDeleteService = async () => {
    if (!deleteServiceModal.service) return;

    try {
      const response = await fetch(
        `/api/projects/${params.id}/services/${deleteServiceModal.service.id}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (data.success) {
        showToast("Service deleted successfully", "success");
        await loadServices();
      } else {
        showToast(data.error || "Failed to delete service", "error");
      }
    } catch (error) {
      console.error("Delete service error:", error);
      showToast("Failed to delete service", "error");
    } finally {
      setDeleteServiceModal({ isOpen: false, service: null });
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !serviceForm.tags.includes(newTag.trim())) {
      setServiceForm({
        ...serviceForm,
        tags: [...serviceForm.tags, newTag.trim()],
      });
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setServiceForm({
      ...serviceForm,
      tags: serviceForm.tags.filter((t) => t !== tag),
    });
  };

  // Get category counts
  const categoryCounts = useMemo(() => {
    if (!project) return {};

    const counts: Record<string, number> = { All: project.credentials.length };

    project.credentials.forEach((cred) => {
      const metadata = getServiceMetadata(cred.type);
      const category = metadata?.category || "Other";
      counts[category] = (counts[category] || 0) + 1;
    });

    return counts;
  }, [project]);

  // Filter credentials based on selected category and search query
  const filteredCredentials = useMemo(() => {
    if (!project) return [];

    let filtered = project.credentials;

    // Filter by category
    if (selectedCategory !== "All") {
      filtered = filtered.filter((cred) => {
        const metadata = getServiceMetadata(cred.type);
        return metadata?.category === selectedCategory;
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((cred) => {
        const metadata = getServiceMetadata(cred.type);
        return (
          cred.name.toLowerCase().includes(query) ||
          cred.description?.toLowerCase().includes(query) ||
          cred.type.toLowerCase().includes(query) ||
          metadata?.label.toLowerCase().includes(query) ||
          metadata?.category.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [project, selectedCategory, searchQuery]);

  // Get only categories that have credentials
  const categories = useMemo(() => {
    const allCategories = getCategories();
    const availableCategories = allCategories.filter(
      (category) => (categoryCounts[category] || 0) > 0
    );
    return ["All", ...availableCategories];
  }, [categoryCounts]);

  // Get all unique tags from services
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    services.forEach((service) => {
      service.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [services]);

  // Filter services based on tag and search query
  const filteredServices = useMemo(() => {
    let filtered = services;

    // Filter by tag
    if (selectedServiceTag !== "All") {
      filtered = filtered.filter((service) =>
        service.tags?.includes(selectedServiceTag)
      );
    }

    // Filter by search query
    if (serviceSearchQuery) {
      const query = serviceSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (service) =>
          service.name.toLowerCase().includes(query) ||
          service.description?.toLowerCase().includes(query) ||
          service.url?.toLowerCase().includes(query) ||
          service.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [services, selectedServiceTag, serviceSearchQuery]);

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <Link href="/dashboard/projects">
          <Button variant="ghost" size="sm" className="mb-2 h-7 text-xs">
            <ArrowLeft className="w-3 h-3" />
            Back to Projects
          </Button>
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-0.5">{project.name}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{project.description}</p>
          </div>
          {canEdit && activeTab === "credentials" && (
            <Link href={`/dashboard/projects/${project.id}/credentials/new`}>
              <Button size="sm" className="group">
                <Plus className="w-4 h-4" />
                Add Credential
              </Button>
            </Link>
          )}
          {canEdit && activeTab === "services" && (
            <Button size="sm" className="group" onClick={handleOpenAddService}>
              <Plus className="w-4 h-4" />
              Add Service
            </Button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("credentials")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 ${
            activeTab === "credentials"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          <Key className="w-4 h-4" />
          Credentials
        </button>
        <button
          onClick={() => setActiveTab("services")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 ${
            activeTab === "services"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          <Boxes className="w-4 h-4" />
          Services
        </button>
      </div>

      {/* Team Members Section - Compact & Collapsible (Only for owners) */}
      {canManageMembers && (
      <Card className="overflow-hidden border-purple-200 dark:border-purple-700">
        <button
          onClick={() => setMembersExpanded(!membersExpanded)}
          className="w-full p-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 hover:from-purple-100 hover:to-purple-150 dark:hover:from-purple-900/30 dark:hover:to-purple-800/30 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Team Members</h2>
              <span className="px-1.5 py-0.5 bg-purple-600 text-white text-xs font-semibold rounded-full">
                {project.members?.length || 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {canManageMembers && (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddMemberModal(true);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 h-7 px-2.5 text-xs"
                >
                  <UserPlus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              )}
              {membersExpanded ? (
                <ChevronUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              )}
            </div>
          </div>
        </button>

        <AnimatePresence>
          {membersExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-3 bg-white dark:bg-gray-800 border-t border-purple-200 dark:border-purple-700">
                {project.members && project.members.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {project.members.map((member) => (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-purple-200 dark:border-purple-700"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                            {member.user?.firstName} {member.user?.lastName}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                            {member.user?.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 ml-2">
                          {member.role === 'owner' ? (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getRoleBadgeColor(member.role)}`}>
                              {member.role}
                            </span>
                          ) : canManageMembers ? (
                            <select
                              value={member.role}
                              onChange={(e) => handleUpdateMemberRole(member.id, e.target.value as 'editor' | 'viewer')}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border-0 cursor-pointer ${getRoleBadgeColor(member.role)}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="editor">editor</option>
                              <option value="viewer">viewer</option>
                            </select>
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getRoleBadgeColor(member.role)}`}>
                              {member.role}
                            </span>
                          )}
                          {member.role !== 'owner' && canManageMembers && (
                            <button
                              onClick={() => handleRemoveMember(member.id, `${member.user?.firstName} ${member.user?.lastName}`)}
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Users className="w-8 h-8 text-purple-300 dark:text-purple-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-600 dark:text-gray-400">No team members yet</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">Click &ldquo;Add&rdquo; to invite members</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
      )}

      {/* Credentials Tab Content */}
      {activeTab === "credentials" && (
        <>
      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          type="text"
          placeholder="Search credentials..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Filter Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
        {categories.map((category) => {
          const count = categoryCounts[category] || 0;
          const isActive = selectedCategory === category;
          const Icon = getCategoryIcon(category);

          return (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`p-2.5 rounded-lg border-2 transition-all ${
                isActive
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`} />
                <div className={`text-lg font-black ${isActive ? "text-blue-900 dark:text-blue-300" : "text-gray-900 dark:text-white"}`}>
                  {count}
                </div>
              </div>
              <div className={`text-[10px] font-semibold truncate ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`}>
                {category}
              </div>
            </button>
          );
        })}
      </div>

      {/* Credentials Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {selectedCategory === "All" && !searchQuery && "All Credentials"}
            {selectedCategory !== "All" && !searchQuery && `${selectedCategory} (${filteredCredentials.length})`}
            {searchQuery && `Search Results (${filteredCredentials.length})`}
          </h2>
          {(selectedCategory !== "All" || searchQuery) && (
            <button
              onClick={() => {
                setSelectedCategory("All");
                setSearchQuery("");
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold"
            >
              Clear all filters
            </button>
          )}
        </div>

        {filteredCredentials.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl">
                  <Key className="w-12 h-12 text-white" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {project.credentials.length === 0 && "No credentials yet"}
                {project.credentials.length > 0 && searchQuery && "No matching credentials"}
                {project.credentials.length > 0 && !searchQuery && selectedCategory !== "All" && `No ${selectedCategory} credentials`}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {project.credentials.length === 0 && "Add your first credential to start managing access securely"}
                {project.credentials.length > 0 && searchQuery && `No credentials found matching "${searchQuery}"`}
                {project.credentials.length > 0 && !searchQuery && selectedCategory !== "All" && `No credentials found in ${selectedCategory} category`}
              </p>
              {project.credentials.length === 0 && (
                <Link href={`/dashboard/projects/${project.id}/credentials/new`}>
                  <Button size="lg">
                    <Plus className="w-5 h-5" />
                    Add First Credential
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCredentials.map((credential, index) => (
              <CredentialCard
                key={credential.id}
                credential={credential}
                onClick={() => handleCredentialClick(credential)}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
        </>
      )}

      {/* Services Tab Content */}
      {activeTab === "services" && (
        <>
          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search services..."
              value={serviceSearchQuery}
              onChange={(e) => setServiceSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            {serviceSearchQuery && (
              <button
                onClick={() => setServiceSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Tag Filters */}
          {availableTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedServiceTag("All")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  selectedServiceTag === "All"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                All ({services.length})
              </button>
              {availableTags.map((tag) => {
                const count = services.filter((s) => s.tags?.includes(tag)).length;
                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedServiceTag(tag)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                      selectedServiceTag === tag
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                    }`}
                  >
                    {tag} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Services Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {selectedServiceTag === "All" && !serviceSearchQuery && "All Services"}
                {selectedServiceTag !== "All" && !serviceSearchQuery && `${selectedServiceTag} (${filteredServices.length})`}
                {serviceSearchQuery && `Search Results (${filteredServices.length})`}
              </h2>
              {(selectedServiceTag !== "All" || serviceSearchQuery) && (
                <button
                  onClick={() => {
                    setSelectedServiceTag("All");
                    setServiceSearchQuery("");
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold"
                >
                  Clear all filters
                </button>
              )}
            </div>

            {filteredServices.length === 0 ? (
              <Card className="text-center py-16">
                <CardContent>
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl">
                      <Boxes className="w-12 h-12 text-white" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {services.length === 0 && "No services yet"}
                    {services.length > 0 && serviceSearchQuery && "No matching services"}
                    {services.length > 0 && !serviceSearchQuery && selectedServiceTag !== "All" && `No services with "${selectedServiceTag}" tag`}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {services.length === 0 && "Add your first service to start tracking your project services"}
                    {services.length > 0 && serviceSearchQuery && `No services found matching "${serviceSearchQuery}"`}
                    {services.length > 0 && !serviceSearchQuery && selectedServiceTag !== "All" && `No services found with "${selectedServiceTag}" tag`}
                  </p>
                  {services.length === 0 && canEdit && (
                    <Button size="lg" onClick={handleOpenAddService}>
                      <Plus className="w-5 h-5" />
                      Add First Service
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredServices.map((service, index) => (
                  <motion.div
                    key={service.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="h-full hover:shadow-lg transition-all border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 group">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {service.name}
                            </h3>
                            {service.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                                {service.description}
                              </p>
                            )}
                            {service.url && (
                              <a
                                href={service.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mb-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Globe className="w-3 h-3" />
                                <span className="truncate">{service.url}</span>
                              </a>
                            )}
                          </div>
                          {canEdit && (
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={() => handleEditService(service)}
                                className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteService(service)}
                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        {service.tags && service.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {service.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Credential Detail Modal */}
      <CredentialDetailModal
        credential={selectedCredential}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCredential(null);
        }}
        onDelete={canEdit ? handleDeleteCredential : undefined}
        onEdit={canEdit ? handleEditCredential : undefined}
        allCredentials={project.credentials}
        onCredentialClick={handleCredentialClick}
      />

      {/* Add Member Modal */}
      <AnimatePresence>
        {addMemberModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setAddMemberModal(false);
                setSelectedMember("");
                setSelectedRole('viewer');
              }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <UserPlus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Team Member</h2>
                </div>
                <button
                  onClick={() => {
                    setAddMemberModal(false);
                    setSelectedMember("");
                    setSelectedRole('viewer');
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Add a member to <span className="font-semibold text-purple-600 dark:text-purple-400">{project.name}</span> project
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Member
                  </label>
                  <select
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  >
                    <option value="">Choose a member...</option>
                    {orgMembers
                      .filter(m => !project.members?.some(pm => pm.userId === m.userId))
                      .map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.user.firstName} {member.user.lastName} ({member.user.email})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Project Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as any)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  >
                    <option value="viewer">Viewer - Can view credentials</option>
                    <option value="editor">Editor - Can create and edit</option>
                  </select>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                  <div className="flex gap-2">
                    <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-purple-900 dark:text-purple-200">
                      <p className="font-semibold mb-1">Role Permissions:</p>
                      {selectedRole === 'editor' ? (
                        <ul className="space-y-0.5 list-disc list-inside">
                          <li>View all credentials</li>
                          <li>Create new credentials</li>
                          <li>Edit existing credentials</li>
                          <li>Delete credentials</li>
                        </ul>
                      ) : (
                        <ul className="space-y-0.5 list-disc list-inside">
                          <li>View all credentials</li>
                          <li>Read-only access</li>
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleAddMember}
                    disabled={addingMember || !selectedMember}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 h-10 text-sm"
                  >
                    {addingMember ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add Member
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAddMemberModal(false);
                      setSelectedMember("");
                      setSelectedRole('viewer');
                    }}
                    className="h-10 text-sm px-6"
                    disabled={addingMember}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal({ isOpen: false, memberId: null, memberName: null })}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Remove Team Member
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Are you sure you want to remove <span className="font-semibold text-gray-900 dark:text-white">{confirmModal.memberName}</span> from this project?
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    They will lose access to all credentials in this project.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setConfirmModal({ isOpen: false, memberId: null, memberName: null })}
                  variant="outline"
                  className="flex-1 h-10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmRemoveMember}
                  className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Service Modal */}
      <AnimatePresence>
        {addServiceModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setAddServiceModal(false);
                setServiceForm({ name: "", description: "", url: "", tags: [] });
                setEditingService(null);
              }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Boxes className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingService ? "Edit Service" : "Add Service"}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setAddServiceModal(false);
                    setServiceForm({ name: "", description: "", url: "", tags: [] });
                    setEditingService(null);
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Service Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                    placeholder="e.g., Production API Server"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={serviceForm.description}
                    onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                    placeholder="Brief description of the service..."
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    URL
                  </label>
                  <input
                    type="url"
                    value={serviceForm.url}
                    onChange={(e) => setServiceForm({ ...serviceForm, url: e.target.value })}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tags
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="Add a tag..."
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <Button
                      type="button"
                      onClick={handleAddTag}
                      variant="outline"
                      size="sm"
                      className="px-4"
                    >
                      Add
                    </Button>
                  </div>
                  {serviceForm.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      {serviceForm.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSaveService}
                    disabled={savingService || !serviceForm.name.trim()}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 h-10 text-sm"
                  >
                    {savingService ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {editingService ? "Updating..." : "Creating..."}
                      </>
                    ) : (
                      <>
                        {editingService ? "Update Service" : "Create Service"}
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAddServiceModal(false);
                      setServiceForm({ name: "", description: "", url: "", tags: [] });
                      setEditingService(null);
                    }}
                    className="h-10 text-sm px-6"
                    disabled={savingService}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Service Confirmation Modal */}
      <AnimatePresence>
        {deleteServiceModal.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteServiceModal({ isOpen: false, service: null })}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Delete Service
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Are you sure you want to delete{" "}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {deleteServiceModal.service?.name}
                    </span>
                    ?
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setDeleteServiceModal({ isOpen: false, service: null })}
                  variant="outline"
                  className="flex-1 h-10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDeleteService}
                  className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isOpen={toast.isOpen}
        onClose={hideToast}
      />
    </div>
  );
}

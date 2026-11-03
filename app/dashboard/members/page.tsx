"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Edit2,
  Trash2,
  Crown,
  X,
  Search,
  Filter,
  Download,
  Activity,
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  BarChart3,
  Calendar,
  UserCheck,
  AlertCircle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/useToast";

interface Member {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface MemberWithStats extends Member {
  actionCount?: number;
  lastActivity?: string;
  recentActions?: AuditLog[];
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  details?: Record<string, any>;
  timestamp: string;
}

interface Organization {
  id: string;
  name: string;
}

export default function MembersPage() {
  const { toast, showToast, hideToast } = useToast();

  const [members, setMembers] = useState<MemberWithStats[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [viewingAudit, setViewingAudit] = useState<string | null>(null);

  // Delete confirmation modal state
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    member: MemberWithStats | null;
  }>({ isOpen: false, member: null });

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  // Edit role modal state
  const [editingMember, setEditingMember] = useState<MemberWithStats | null>(null);
  const [newRole, setNewRole] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      // Get session
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();

      if (!sessionData.success) {
        setLoading(false);
        return;
      }

      const isPlatformAdmin = sessionData.user?.role === 'platform_admin';

      // Platform admin sees all users, others see org members
      if (!isPlatformAdmin && !sessionData.organization) {
        setLoading(false);
        return;
      }

      // Platform admin always sees "All Users" view, even if they belong to an org
      setOrganization(isPlatformAdmin ? { id: 'all', name: 'All Users' } : sessionData.organization);
      setCurrentUserId(sessionData.user.id);
      setCurrentRole(isPlatformAdmin ? 'platform_admin' : sessionData.organizationRole);

      let membersData;
      let auditData;

      if (isPlatformAdmin) {
        // Platform admin gets all users
        const usersRes = await fetch("/api/users");
        membersData = await usersRes.json();

        // Transform to add platform role
        if (membersData && membersData.success) {
          membersData.data = membersData.data.map((member: any) => ({
            ...member,
            role: member.user?.role || member.role || 'member',
            joinedAt: member.joinedAt || member.createdAt || new Date().toISOString(),
          }));
        }

        // Get all audit logs (platform admin can see all)
        const auditRes = await fetch("/api/organizations/all/audit?limit=500");
        auditData = await auditRes.json();
      } else {
        // Get organization members
        const membersRes = await fetch(`/api/organizations/${sessionData.organization.id}/members`);
        membersData = await membersRes.json();

        // Get organization audit logs
        const auditRes = await fetch(`/api/organizations/${sessionData.organization.id}/audit?limit=500`);
        auditData = await auditRes.json();
      }

      if (membersData && membersData.success) {
        const logs = auditData && auditData.success ? auditData.data?.logs || auditData.data || [] : [];
        setAuditLogs(logs);

        // Calculate stats for each member
        const membersWithStats = membersData.data.map((member: Member) => {
          const memberLogs = logs.filter((log: AuditLog) => log.userId === member.userId);
          const lastActivity = memberLogs.length > 0 ? memberLogs[0].timestamp : member.joinedAt;

          return {
            ...member,
            actionCount: memberLogs.length,
            lastActivity,
            recentActions: memberLogs.slice(0, 10),
          };
        });

        setMembers(membersWithStats);
      }

      setLoading(false);
    } catch (error) {
      console.error("Load members error:", error);
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    setInviting(true);
    setInviteError("");

    try {
      const response = await fetch(`/api/organizations/${organization.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await response.json();

      if (data.success) {
        setShowInviteModal(false);
        setInviteEmail("");
        setInviteRole("member");
        await loadMembers();
      } else {
        setInviteError(data.error || "Failed to invite member");
      }
    } catch (error) {
      setInviteError("An error occurred");
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!organization || !editingMember) return;

    setUpdating(true);

    try {
      const response = await fetch(
        `/api/organizations/${organization.id}/members/${editingMember.userId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setEditingMember(null);
        await loadMembers();
      }
    } catch (error) {
      console.error("Update role error:", error);
    } finally {
      setUpdating(false);
    }
  };

  const getMemberName = (member: MemberWithStats) => {
    const firstName = member.user?.firstName || '';
    const lastName = member.user?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || member.user?.email || member.user?.username || "Unknown User";
  };

  const handleRemoveMember = (member: MemberWithStats) => {
    setDeleteConfirmModal({ isOpen: true, member });
  };

  const confirmRemoveMember = async () => {
    if (!organization || !deleteConfirmModal.member) return;

    try {
      let response;

      // Platform admin deletes users directly
      if (organization.id === 'all') {
        response = await fetch(
          `/api/users/${deleteConfirmModal.member.userId}`,
          { method: "DELETE" }
        );
      } else {
        // Organization admin/owner removes from organization
        response = await fetch(
          `/api/organizations/${organization.id}/members/${deleteConfirmModal.member.userId}`,
          { method: "DELETE" }
        );
      }

      if (response.ok) {
        showToast("Member removed successfully", "success");
        await loadMembers();
      } else {
        const data = await response.json();
        showToast(data.error || "Failed to remove member", "error");
      }
    } catch (error) {
      console.error("Remove member error:", error);
      showToast("Failed to remove member", "error");
    } finally {
      setDeleteConfirmModal({ isOpen: false, member: null });
    }
  };

  const handleBulkRemove = async () => {
    if (selectedMembers.size === 0) return;
    if (!confirm(`Remove ${selectedMembers.size} members from organization?`)) return;

    for (const userId of selectedMembers) {
      const member = members.find(m => m.userId === userId);
      if (member && member.role !== 'owner') {
        await handleRemoveMember(member);
      }
    }
    setSelectedMembers(new Set());
  };

  const handleExportMembers = () => {
    const csv = [
      ["Name", "Email", "Role", "Joined", "Actions", "Last Activity"],
      ...filteredMembers.map((member) => [
        getMemberName(member),
        member.user?.email || '',
        member.role,
        new Date(member.joinedAt).toLocaleDateString(),
        member.actionCount?.toString() || "0",
        member.lastActivity ? new Date(member.lastActivity).toLocaleString() : "N/A",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `members-${Date.now()}.csv`;
    a.click();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case "admin":
        return <Shield className="w-4 h-4 text-purple-500" />;
      case "member":
        return <UserCheck className="w-4 h-4 text-blue-500" />;
      default:
        return <Eye className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "admin":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "member":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "viewer":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const formatAction = (log: AuditLog) => {
    const details = log.details || {};
    switch (log.action) {
      case "created":
        if (log.resourceType === "project") return `Created project "${details.projectName}"`;
        if (log.resourceType === "credential") return `Created ${details.credentialType} credential`;
        return `Created ${log.resourceType}`;
      case "updated":
        if (log.resourceType === "credential") return `Updated credential`;
        return `Updated ${log.resourceType}`;
      case "deleted":
        return `Deleted ${log.resourceType}`;
      case "accessed":
        return `Accessed ${log.resourceType}`;
      case "invited":
        return `Invited ${details.email}`;
      default:
        return `${log.action} ${log.resourceType}`;
    }
  };

  const getActivityLevel = (actionCount: number) => {
    if (actionCount > 50) return { label: "Very Active", color: "text-green-600 bg-green-100 dark:bg-green-900/30" };
    if (actionCount > 20) return { label: "Active", color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" };
    if (actionCount > 5) return { label: "Moderate", color: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30" };
    return { label: "Low Activity", color: "text-gray-600 bg-gray-100 dark:bg-gray-900/30" };
  };

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const matchesSearch =
        (member.user?.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (member.user?.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (member.user?.email || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === "all" || member.role === roleFilter;

      let matchesActivity = true;
      if (activityFilter === "active") {
        matchesActivity = (member.actionCount || 0) > 10;
      } else if (activityFilter === "inactive") {
        matchesActivity = (member.actionCount || 0) <= 10;
      }

      return matchesSearch && matchesRole && matchesActivity;
    });
  }, [members, searchTerm, roleFilter, activityFilter]);

  const stats = useMemo(() => {
    const totalMembers = members.length;
    const activeMembers = members.filter(m => (m.actionCount || 0) > 5).length;
    const adminCount = members.filter(m => m.role === 'admin' || m.role === 'owner').length;
    const avgActions = members.reduce((sum, m) => sum + (m.actionCount || 0), 0) / totalMembers || 0;

    return { totalMembers, activeMembers, adminCount, avgActions: Math.round(avgActions) };
  }, [members]);

  const canEditMember = (member: MemberWithStats) => {
    if (currentRole === "platform_admin") return true;
    if (currentRole === "owner") return true;
    if (currentRole === "admin" && member.role !== "owner") return true;
    return false;
  };

  const toggleSelectMember = (userId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedMembers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedMembers.size === filteredMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(filteredMembers.map(m => m.userId)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading members...</p>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="p-6">
        <Card className="p-6 bg-yellow-50 dark:bg-yellow-900/20">
          <p className="text-yellow-800 dark:text-yellow-200">
            You need to be part of an organization to manage members.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Team Members
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            Manage members, roles, and monitor activity
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleExportMembers}
            variant="outline"
            size="sm"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export
          </Button>
          {(currentRole === "owner" || currentRole === "admin") && (
            <Button
              onClick={() => setShowInviteModal(true)}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              Invite
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase">Total</p>
              <p className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-0.5">{stats.totalMembers}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600/30" />
          </div>
        </Card>

        <Card className="p-3 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 dark:text-green-400 font-medium uppercase">Active</p>
              <p className="text-xl font-bold text-green-900 dark:text-green-100 mt-0.5">{stats.activeMembers}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600/30" />
          </div>
        </Card>

        <Card className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium uppercase">Admins</p>
              <p className="text-xl font-bold text-purple-900 dark:text-purple-100 mt-0.5">{stats.adminCount}</p>
            </div>
            <Shield className="w-8 h-8 text-purple-600/30" />
          </div>
        </Card>

        <Card className="p-3 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium uppercase">Avg Actions</p>
              <p className="text-xl font-bold text-orange-900 dark:text-orange-100 mt-0.5">{stats.avgActions}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-orange-600/30" />
          </div>
        </Card>
      </div>

      {/* Filters and Bulk Actions */}
      <Card className="p-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="all">All Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>

          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="all">All Activity</option>
            <option value="active">Active Users</option>
            <option value="inactive">Low Activity</option>
          </select>

          {selectedMembers.size > 0 && (
            <Button
              onClick={handleBulkRemove}
              size="sm"
              variant="outline"
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Remove ({selectedMembers.size})
            </Button>
          )}
        </div>

        {filteredMembers.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={selectedMembers.size === filteredMembers.length}
              onChange={toggleSelectAll}
              className="rounded"
            />
            <span>Select all ({filteredMembers.length})</span>
          </div>
        )}
      </Card>

      {/* Members List */}
      <div className="grid gap-3">
        {filteredMembers.map((member) => {
          const activityLevel = getActivityLevel(member.actionCount || 0);
          const isExpanded = expandedMember === member.userId;

          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              layout
            >
              <Card className="overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    {canEditMember(member) && member.role !== 'owner' && (
                      <input
                        type="checkbox"
                        checked={selectedMembers.has(member.userId)}
                        onChange={() => toggleSelectMember(member.userId)}
                        className="rounded"
                      />
                    )}

                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex-shrink-0">
                        <Users className="w-5 h-5 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {getMemberName(member)}
                          </h3>
                          {member.userId === currentUserId && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded">
                              You
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{member.user?.email || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {getRoleIcon(member.role)}
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                              {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            <span className={`px-1.5 py-0.5 rounded text-xs ${activityLevel.color}`}>
                              {member.actionCount || 0} actions
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatRelativeTime(member.lastActivity || member.joinedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedMember(isExpanded ? null : member.userId)}
                        className="h-8 w-8 p-0"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>

                      {member.userId !== currentUserId && canEditMember(member) && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingMember(member);
                              setNewRole(member.role);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>

                          {member.role !== "owner" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRemoveMember(member)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Member Info</h4>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Username:</span>
                                <span className="font-medium text-gray-900 dark:text-white">{member.user?.username || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Joined:</span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {new Date(member.joinedAt).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Activity Level:</span>
                                <span className={`font-medium ${activityLevel.color.split(' ')[0]}`}>
                                  {activityLevel.label}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Recent Activity</h4>
                            {member.recentActions && member.recentActions.length > 0 ? (
                              <div className="space-y-1 max-h-24 overflow-y-auto text-xs">
                                {member.recentActions.slice(0, 5).map((action) => (
                                  <div key={action.id} className="text-gray-600 dark:text-gray-400 truncate">
                                    • {formatAction(action)} - {formatRelativeTime(action.timestamp)}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500 dark:text-gray-400 italic">No recent activity</p>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setViewingAudit(member.userId)}
                              className="mt-2 w-full h-7 text-xs"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View Full Audit Log
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Card>
            </motion.div>
          );
        })}

        {filteredMembers.length === 0 && (
          <Card className="p-8">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No members found</p>
            </div>
          </Card>
        )}
      </div>

      {/* Audit Log Modal */}
      {viewingAudit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Audit Log - {viewingAudit && members.find(m => m.userId === viewingAudit) ? getMemberName(members.find(m => m.userId === viewingAudit)!) : 'Unknown User'}
              </h2>
              <button
                onClick={() => setViewingAudit(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {auditLogs
                .filter(log => log.userId === viewingAudit)
                .map((log) => (
                  <div key={log.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm">
                    <Activity className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-white">{formatAction(log)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              {auditLogs.filter(log => log.userId === viewingAudit).length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
                  No audit logs found for this member
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Invite Member</h2>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteError("");
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-3">
              {inviteError && (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  {inviteError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="viewer">Viewer - Read-only access</option>
                  <option value="member">Member - Create and edit</option>
                  <option value="admin">Admin - Manage members</option>
                  {currentRole === "owner" && (
                    <option value="owner">Owner - Full control</option>
                  )}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 h-9 text-sm"
                >
                  {inviting ? "Sending..." : "Send Invitation"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInviteModal(false)}
                  className="h-9 text-sm"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmModal.isOpen}
        onClose={() => setDeleteConfirmModal({ isOpen: false, member: null })}
        onConfirm={confirmRemoveMember}
        title="Remove Member"
        message={
          deleteConfirmModal.member
            ? `Are you sure you want to remove ${getMemberName(deleteConfirmModal.member)} from the organization? This action cannot be undone.`
            : ''
        }
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Edit Role Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Change Role</h2>
              <button
                onClick={() => setEditingMember(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Change role for {getMemberName(editingMember)}
              </p>

              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="viewer">Viewer</option>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                {currentRole === "owner" && (
                  <option value="owner">Owner</option>
                )}
              </select>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleUpdateRole}
                  disabled={updating || newRole === editingMember.role}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 h-9 text-sm"
                >
                  {updating ? "Updating..." : "Update Role"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingMember(null)}
                  className="h-9 text-sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
      />
    </div>
  );
}

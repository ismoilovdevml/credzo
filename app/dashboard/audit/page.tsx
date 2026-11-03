"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  FileText,
  AlertCircle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  timestamp: string;
}

interface Organization {
  id: string;
  name: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // Load audit logs on mount
  useEffect(() => {
    const loadAuditLogs = async () => {
      try {
        // Get session
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();

        if (!sessionData.success) {
          setLoading(false);
          return;
        }

        const isPlatformAdmin = sessionData.user?.role === 'platform_admin';

        // Platform admin sees all, others see org audit logs
        if (!isPlatformAdmin && !sessionData.organization) {
          setLoading(false);
          return;
        }

        setOrganization(sessionData.organization || { id: 'all', name: 'All Organizations' });

        let usersData;
        let logsData;

        if (isPlatformAdmin) {
          // Platform admin gets all users
          const usersRes = await fetch("/api/users");
          usersData = await usersRes.json();

          if (usersData.success) {
            const userMap: Record<string, any> = {};
            usersData.data.forEach((member: any) => {
              // The /api/users endpoint returns data in this format:
              // { id, userId, role, user: { id, email, firstName, lastName, username } }
              const userData = member.user || member;
              userMap[member.userId || member.id] = {
                id: userData.id,
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                username: userData.username,
              };
            });
            setUsers(userMap);
          }

          // Get all audit logs
          const logsRes = await fetch("/api/organizations/all/audit?limit=1000");
          logsData = await logsRes.json();
        } else {
          // Get organization members for user mapping
          const membersRes = await fetch(`/api/organizations/${sessionData.organization.id}/members`);
          const membersData = await membersRes.json();

          if (membersData.success) {
            const userMap: Record<string, any> = {};
            membersData.data.forEach((member: any) => {
              if (member.user) {
                userMap[member.userId] = member.user;
              }
            });
            setUsers(userMap);
          }

          // Get organization audit logs
          const logsRes = await fetch(
            `/api/organizations/${sessionData.organization.id}/audit?limit=500`
          );
          logsData = await logsRes.json();
        }

        if (logsData && logsData.success) {
          setLogs(logsData.data?.logs || logsData.data || []);
        }

        setLoading(false);
      } catch (error) {
        console.error("Load audit logs error:", error);
        setLoading(false);
      }
    };

    loadAuditLogs();
  }, []);

  // Apply filters using useMemo for better performance
  const filteredLogs = useMemo(() => {
    let filtered = [...logs];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((log) => {
        const userName = users[log.userId]
          ? `${users[log.userId].firstName} ${users[log.userId].lastName}`.toLowerCase()
          : "";
        const details = JSON.stringify(log.details || {}).toLowerCase();

        return (
          log.action.toLowerCase().includes(term) ||
          log.resourceType.toLowerCase().includes(term) ||
          userName.includes(term) ||
          details.includes(term)
        );
      });
    }

    // Action filter
    if (actionFilter !== "all") {
      filtered = filtered.filter((log) => log.action === actionFilter);
    }

    // Resource filter
    if (resourceFilter !== "all") {
      filtered = filtered.filter((log) => log.resourceType === resourceFilter);
    }

    // User filter
    if (userFilter !== "all") {
      filtered = filtered.filter((log) => log.userId === userFilter);
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const filterDate = new Date();

      switch (dateFilter) {
        case "today":
          filterDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          filterDate.setDate(now.getDate() - 7);
          break;
        case "month":
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }

      filtered = filtered.filter((log) => new Date(log.timestamp) >= filterDate);
    }

    return filtered;
  }, [logs, searchTerm, actionFilter, resourceFilter, userFilter, dateFilter, users]);

  const formatAction = (log: AuditLog) => {
    const details = log.details || {};

    switch (log.action) {
      case "created":
        if (log.resourceType === "project") {
          return `Created project "${details.projectName}"`;
        }
        if (log.resourceType === "credential") {
          return `Created ${details.credentialType} credential "${details.credentialName}"`;
        }
        return `Created ${log.resourceType}`;

      case "updated":
        if (log.resourceType === "project") {
          return `Updated project "${details.projectName}"`;
        }
        if (log.resourceType === "credential") {
          return `Updated credential "${details.credentialName}"`;
        }
        return `Updated ${log.resourceType}`;

      case "deleted":
        if (log.resourceType === "project") {
          return `Deleted project "${details.projectName}"`;
        }
        if (log.resourceType === "credential") {
          return `Deleted credential "${details.credentialName}"`;
        }
        return `Deleted ${log.resourceType}`;

      case "accessed":
        if (log.resourceType === "credential") {
          return `Accessed credential "${details.credentialName}"`;
        }
        return `Accessed ${log.resourceType}`;

      case "invited":
        return `Invited ${details.email} as ${details.role}`;

      case "removed":
        return `Removed ${details.removedUsername}`;

      case "role_changed":
        return `Changed ${details.targetUsername}'s role from ${details.oldRole} to ${details.newRole}`;

      case "login":
        return "Logged in";

      case "logout":
        return "Logged out";

      default:
        return `${log.action} ${log.resourceType}`;
    }
  };

  const getUserName = (userId: string) => {
    const user = users[userId];
    if (!user) return "Unknown User";
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || user.email || user.username || "Unknown User";
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "created":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "updated":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "deleted":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "accessed":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "login":
        return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  const handleExport = () => {
    const csv = [
      ["Timestamp", "User", "Action", "Resource Type", "Description", "IP Address"],
      ...filteredLogs.map((log) => [
        log.timestamp,
        getUserName(log.userId),
        log.action,
        log.resourceType,
        formatAction(log),
        log.ipAddress || "N/A",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${Date.now()}.csv`;
    a.click();
  };

  const uniqueActions = Array.from(new Set(logs.map((log) => log.action)));
  const uniqueResources = Array.from(new Set(logs.map((log) => log.resourceType)));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="p-6">
        <Card className="p-6 bg-yellow-50 dark:bg-yellow-900/20">
          <p className="text-yellow-800 dark:text-yellow-200">
            You need to be part of an organization to view audit logs.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Activity className="w-8 h-8 text-purple-600" />
            Audit Logs
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Complete activity history and monitoring
          </p>
        </div>

        <Button
          onClick={handleExport}
          variant="outline"
          disabled={filteredLogs.length === 0}
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
          </div>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="all">All Actions</option>
            {uniqueActions.map((action) => (
              <option key={action} value={action}>
                {action.charAt(0).toUpperCase() + action.slice(1)}
              </option>
            ))}
          </select>

          {/* Resource Filter */}
          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="all">All Resources</option>
            {uniqueResources.map((resource) => (
              <option key={resource} value={resource}>
                {resource.charAt(0).toUpperCase() + resource.slice(1)}
              </option>
            ))}
          </select>

          {/* User Filter */}
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="all">All Users</option>
            {Object.entries(users).map(([userId, user]) => (
              <option key={userId} value={userId}>
                {getUserName(userId)}
              </option>
            ))}
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Showing {filteredLogs.length} of {logs.length} logs
          </span>
          {(searchTerm || actionFilter !== "all" || resourceFilter !== "all" || userFilter !== "all" || dateFilter !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setActionFilter("all");
                setResourceFilter("all");
                setUserFilter("all");
                setDateFilter("all");
              }}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      </Card>

      {/* Logs Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Resource
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  IP Address
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {formatDateTime(log.timestamp)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        {getUserName(log.userId)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {log.resourceType}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-md truncate">
                      {formatAction(log)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {log.ipAddress || "N/A"}
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500 dark:text-gray-400">No audit logs found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

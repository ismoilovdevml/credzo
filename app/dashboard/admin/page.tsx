"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  Users,
  FolderOpen,
  Key,
  Activity,
  TrendingUp,
  Clock,
  AlertCircle,
  BarChart3,
  PieChart,
  Zap,
  Database,
  GitBranch,
  UserCheck,
  FileText,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";

interface DashboardStats {
  totalMembers: number;
  activeProjects: number;
  totalCredentials: number;
  recentActivity: AuditLog[];
  memberActivity: MemberActivity[];
  actionBreakdown: Record<string, number>;
  resourceBreakdown: Record<string, number>;
  todayActions: number;
  yesterdayActions: number;
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  timestamp: string;
}

interface MemberActivity {
  userId: string;
  actionCount: number;
  lastActivity: string;
}

interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface Organization {
  id: string;
  name: string;
}

export default function AdminDashboardPage() {
  const [authContext, setAuthContext] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        // Get session
        const sessionRes = await fetch("/api/auth/session");
        if (!sessionRes.ok) throw new Error("Not authenticated");

        const sessionData = await sessionRes.json();
        setAuthContext(sessionData);

        // Platform admin only
        if (sessionData.user?.role !== 'platform_admin') {
          setError("Access denied. Platform admin only.");
          setLoading(false);
          return;
        }

        const orgId = sessionData.organization?.id;

        // Platform admin gets ALL users, not just org members
        const usersRes = await fetch('/api/users');
        const usersData = await usersRes.json();

        if (usersData.success) {
          const userMap: Record<string, User> = {};
          usersData.data.forEach((item: any) => {
            if (item.user) {
              userMap[item.user.id] = item.user;
            }
          });
          setUsers(userMap);
        }

        // Get projects and count actual credentials
        const projectsRes = await fetch("/api/projects");
        const projectsData = await projectsRes.json();
        const projects = projectsData.data || [];

        // Count total credentials across all projects
        let totalCreds = 0;
        projects.forEach((project: any) => {
          totalCreds += project.credentials?.length || 0;
        });

        // Get audit stats (from admin's organization for now)
        let auditData = { success: false, data: { logs: [] } };
        if (orgId) {
          const auditRes = await fetch(`/api/organizations/${orgId}/audit?limit=100`);
          if (auditRes.ok) {
            auditData = await auditRes.json();
          }
        }

        let recentActivity: AuditLog[] = [];
        let memberActivity: MemberActivity[] = [];
        let actionBreakdown: Record<string, number> = {};
        let resourceBreakdown: Record<string, number> = {};
        let todayActions = 0;
        let yesterdayActions = 0;

        if (auditData.success && auditData.data.logs) {
          const logs = auditData.data.logs;

          // Filter out login actions for cleaner activity view
          recentActivity = logs
            .filter((log: AuditLog) => log.action !== 'login')
            .slice(0, 10);

          // Calculate action breakdown
          logs.forEach((log: AuditLog) => {
            actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;
            resourceBreakdown[log.resourceType] = (resourceBreakdown[log.resourceType] || 0) + 1;
          });

          // Calculate member activity
          const userActions: Record<string, { count: number; lastActivity: string }> = {};
          logs.forEach((log: AuditLog) => {
            if (!userActions[log.userId]) {
              userActions[log.userId] = { count: 0, lastActivity: log.timestamp };
            }
            userActions[log.userId].count++;
            if (new Date(log.timestamp) > new Date(userActions[log.userId].lastActivity)) {
              userActions[log.userId].lastActivity = log.timestamp;
            }
          });

          memberActivity = Object.entries(userActions).map(([userId, data]) => ({
            userId,
            actionCount: data.count,
            lastActivity: data.lastActivity,
          })).sort((a, b) => b.actionCount - a.actionCount);

          // Calculate today vs yesterday actions
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);

          logs.forEach((log: AuditLog) => {
            const logDate = new Date(log.timestamp);
            if (logDate >= today) {
              todayActions++;
            } else if (logDate >= yesterday && logDate < today) {
              yesterdayActions++;
            }
          });
        }

        setStats({
          totalMembers: usersData.data?.length || 0,
          activeProjects: projects.length,
          totalCredentials: totalCreds,
          recentActivity,
          memberActivity,
          actionBreakdown,
          resourceBreakdown,
          todayActions,
          yesterdayActions,
        });

        setLoading(false);
      } catch (err: any) {
        console.error("Dashboard load error:", err);
        setError(err.message || "Failed to load dashboard");
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

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
    return `${days}d ago`;
  };

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

      default:
        return `${log.action} ${log.resourceType}`;
    }
  };

  const getUserName = (userId: string) => {
    const user = users[userId];
    if (!user) return "Unknown User";
    return `${user.firstName} ${user.lastName}`;
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "created": return <Zap className="w-4 h-4" />;
      case "updated": return <FileText className="w-4 h-4" />;
      case "deleted": return <AlertCircle className="w-4 h-4" />;
      case "accessed": return <Key className="w-4 h-4" />;
      case "invited": return <UserCheck className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "created": return "text-green-600 bg-green-100 dark:bg-green-900/30";
      case "updated": return "text-blue-600 bg-blue-100 dark:bg-blue-900/30";
      case "deleted": return "text-red-600 bg-red-100 dark:bg-red-900/30";
      case "accessed": return "text-purple-600 bg-purple-100 dark:bg-purple-900/30";
      case "invited": return "text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30";
      default: return "text-gray-600 bg-gray-100 dark:bg-gray-900/30";
    }
  };

  const calculateTrend = () => {
    if (!stats) return { percentage: 0, isPositive: true };

    const { todayActions, yesterdayActions } = stats;
    if (yesterdayActions === 0) return { percentage: todayActions > 0 ? 100 : 0, isPositive: true };

    const diff = todayActions - yesterdayActions;
    const percentage = Math.abs(Math.round((diff / yesterdayActions) * 100));

    return { percentage, isPositive: diff >= 0 };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <div>
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-200">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const trend = calculateTrend();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-600" />
            Admin Dashboard
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            Organization management and monitoring
          </p>
        </div>
      </div>

      {/* Stats Grid - More Compact */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Members</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                  {stats?.totalMembers || 0}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Active users
                </p>
              </div>
              <div className="p-2.5 bg-blue-200 dark:bg-blue-700 rounded-lg">
                <Users className="w-5 h-5 text-blue-700 dark:text-blue-200" />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">Projects</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1">
                  {stats?.activeProjects || 0}
                </p>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                  Active repositories
                </p>
              </div>
              <div className="p-2.5 bg-purple-200 dark:bg-purple-700 rounded-lg">
                <FolderOpen className="w-5 h-5 text-purple-700 dark:text-purple-200" />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Credentials</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
                  {stats?.totalCredentials || 0}
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  Stored secrets
                </p>
              </div>
              <div className="p-2.5 bg-green-200 dark:bg-green-700 rounded-lg">
                <Key className="w-5 h-5 text-green-700 dark:text-green-200" />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide">Activity</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100 mt-1">
                  {stats?.todayActions || 0}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {trend.isPositive ? (
                    <ArrowUp className="w-3 h-3 text-green-600" />
                  ) : (
                    <ArrowDown className="w-3 h-3 text-red-600" />
                  )}
                  <p className={`text-xs ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {trend.percentage}% vs yesterday
                  </p>
                </div>
              </div>
              <div className="p-2.5 bg-orange-200 dark:bg-orange-700 rounded-lg">
                <Activity className="w-5 h-5 text-orange-700 dark:text-orange-200" />
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Action Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Action Breakdown</h3>
            </div>
            <div className="space-y-2">
              {Object.entries(stats?.actionBreakdown || {})
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([action, count]) => (
                  <div key={action} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded ${getActionColor(action)}`}>
                        {getActionIcon(action)}
                      </div>
                      <span className="capitalize text-gray-700 dark:text-gray-300">{action}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                  </div>
                ))}
            </div>
          </Card>
        </motion.div>

        {/* Resource Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <PieChart className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Resource Types</h3>
            </div>
            <div className="space-y-2">
              {Object.entries(stats?.resourceBreakdown || {})
                .sort(([, a], [, b]) => b - a)
                .map(([resource, count]) => {
                  const total = Object.values(stats?.resourceBreakdown || {}).reduce((a, b) => a + b, 0);
                  const percentage = Math.round((count / total) * 100);
                  return (
                    <div key={resource} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="capitalize text-gray-700 dark:text-gray-300">{resource}</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{count} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-purple-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        </motion.div>

        {/* System Health */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-green-600" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">System Health</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-gray-700 dark:text-gray-300">API Status</span>
                </div>
                <span className="text-xs font-semibold text-green-600">Healthy</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-gray-700 dark:text-gray-300">Database</span>
                </div>
                <span className="text-xs font-semibold text-green-600">Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span className="text-xs text-gray-700 dark:text-gray-300">Storage</span>
                </div>
                <span className="text-xs font-semibold text-blue-600">SQLite</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  <span className="text-xs text-gray-700 dark:text-gray-300">Encryption</span>
                </div>
                <span className="text-xs font-semibold text-purple-600">AES-256</span>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity - More Compact */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
              <span className="ml-auto text-xs text-gray-500">Last 10 actions</span>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className={`p-1.5 rounded ${getActionColor(log.action)} flex-shrink-0`}>
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                        {getUserName(log.userId)}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {formatAction(log)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {formatRelativeTime(log.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-8">
                  No recent activity
                </p>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Member Activity - More Compact */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Top Contributors</h3>
              <span className="ml-auto text-xs text-gray-500">By activity</span>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {stats?.memberActivity && stats.memberActivity.length > 0 ? (
                stats.memberActivity.slice(0, 10).map((activity, index) => {
                  const user = users[activity.userId];
                  return (
                    <div key={activity.userId} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-xs font-bold text-purple-600">
                        {index + 1}
                      </div>
                      <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded">
                        <Users className="w-3.5 h-3.5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                          {user ? `${user.firstName} ${user.lastName}` : "Unknown User"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {formatRelativeTime(activity.lastActivity)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {activity.actionCount}
                        </p>
                        <p className="text-xs text-gray-500">actions</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-8">
                  No member activity yet
                </p>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

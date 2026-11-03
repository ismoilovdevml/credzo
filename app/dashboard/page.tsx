"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Plus, FolderOpen, Key, Server, TrendingUp, Loader2,
  Database, Clock, Shield, Activity, ArrowRight,
  Settings, FileText, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProjects } from "@/lib/storage";
import { getServiceMetadata } from "@/lib/services";
import type { Project, Credential } from "@/lib/types";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalCredentials: 0,
    totalServers: 0,
    totalDatabases: 0,
    recentActivity: [] as { type: string; name: string; project: string; time: Date }[],
    categoryBreakdown: {} as Record<string, number>,
  });

  useEffect(() => {
    async function loadProjects() {
      setLoading(true);
      try {
        const response = await fetch("/api/projects");
        if (!response.ok) throw new Error("Failed to fetch projects");

        const data = await response.json();
        const allProjects = data.data || [];

      // Calculate all statistics
      const totalCredentials = allProjects.reduce((sum: number, p: any) => sum + p.credentials.length, 0);
      const totalServers = allProjects.reduce((sum: number, p: any) => {
        return sum + p.credentials.filter((c: any) =>
          c.type === "vm-server" || c.type === "ssh-server" || c.type === "ftp" || c.type === "sftp"
        ).length;
      }, 0);

      const totalDatabases = allProjects.reduce((sum: number, p: any) => {
        return sum + p.credentials.filter((c: any) => {
          const meta = getServiceMetadata(c.type);
          return meta?.category === "Database";
        }).length;
      }, 0);

      // Get category breakdown
      const categoryBreakdown: Record<string, number> = {};
      allProjects.forEach((project: any) => {
        project.credentials.forEach((cred: any) => {
          const meta = getServiceMetadata(cred.type);
          const category = meta?.category || "Other";
          categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
        });
      });

      // Get recent activity (last 10 credentials across all projects)
      const allCredentials: { cred: Credential; project: Project }[] = [];
      allProjects.forEach((project: any) => {
        project.credentials.forEach((cred: any) => {
          allCredentials.push({ cred, project });
        });
      });

      const recentActivity = allCredentials
        .sort((a, b) => new Date(b.cred.updatedAt).getTime() - new Date(a.cred.updatedAt).getTime())
        .slice(0, 10)
        .map(({ cred, project }) => ({
          type: cred.type,
          name: cred.name,
          project: project.name,
          time: new Date(cred.updatedAt),
        }));

        setProjects(allProjects);
        setStats({
          totalProjects: allProjects.length,
          totalCredentials,
          totalServers,
          totalDatabases,
          recentActivity,
          categoryBreakdown,
        });
      } catch (error) {
        console.error("Failed to load projects:", error);
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  const statCards = [
    {
      title: "Total Projects",
      value: stats.totalProjects,
      icon: FolderOpen,
      gradient: "from-blue-500 to-cyan-500",
      description: "Active projects"
    },
    {
      title: "Total Credentials",
      value: stats.totalCredentials,
      icon: Key,
      gradient: "from-purple-500 to-pink-500",
      description: "Stored credentials"
    },
    {
      title: "Active Servers",
      value: stats.totalServers,
      icon: Server,
      gradient: "from-orange-500 to-red-500",
      description: "Server connections"
    },
    {
      title: "Databases",
      value: stats.totalDatabases,
      icon: Database,
      gradient: "from-green-500 to-emerald-500",
      description: "Database credentials"
    },
  ];

  const quickActions = [
    { label: "New Project", href: "/dashboard/projects/new", icon: Plus, color: "blue" },
    { label: "All Projects", href: "/dashboard/projects", icon: FolderOpen, color: "purple" },
    { label: "Settings", href: "/dashboard/settings", icon: Settings, color: "gray" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-1">Dashboard</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Complete overview of your DevOps infrastructure</p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button size="sm" className="group">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="relative overflow-hidden group hover:shadow-lg transition-all">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-5 group-hover:opacity-10 transition-opacity`} />
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
                <CardTitle className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient}`}>
                  <stat.icon className="w-4 h-4 text-white" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-0.5">{stat.value}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                  {stat.description}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 p-4 pt-0">
              <Link href="/dashboard/projects/new">
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Plus className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">New Project</span>
                    <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                  </div>
                </motion.div>
              </Link>

              <Link href="/dashboard/projects">
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <FolderOpen className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">All Projects</span>
                    <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                  </div>
                </motion.div>
              </Link>

              <Link href="/dashboard/settings">
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
                      <Settings className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">Settings</span>
                    <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                  </div>
                </motion.div>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {stats.recentActivity.length === 0 ? (
                <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                  No recent activity
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                  {stats.recentActivity.map((activity, index) => {
                    const meta = getServiceMetadata(activity.type as any);
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.02 }}
                        className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <Key className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {activity.name}
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">
                            {meta?.label || activity.type} • {activity.project}
                          </div>
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500">
                          {activity.time.toLocaleDateString()}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Category Breakdown & System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Category Breakdown */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
                Credentials by Category
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {Object.keys(stats.categoryBreakdown).length === 0 ? (
                <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                  No credentials yet
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(stats.categoryBreakdown)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, count], index) => (
                      <motion.div
                        key={category}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + index * 0.03 }}
                        className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800"
                      >
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{category}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                              style={{ width: `${(count / stats.totalCredentials) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-900 dark:text-white w-6 text-right">
                            {count}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* System Status */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Database</span>
                </div>
                <span className="text-xs text-green-600 dark:text-green-400 font-semibold">Operational</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Storage</span>
                </div>
                <span className="text-xs text-green-600 dark:text-green-400 font-semibold">Healthy</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Encryption</span>
                </div>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Active</span>
              </div>

              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                  Last backup: {new Date().toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Projects */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Projects</h2>
          <Link href="/dashboard/projects">
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </Link>
        </div>

        {projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="text-center py-12">
              <CardContent>
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl">
                    <FolderOpen className="w-12 h-12 text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No projects yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm max-w-md mx-auto">
                  Get started by creating your first project to organize credentials
                </p>
                <Link href="/dashboard/projects/new">
                  <Button size="sm">
                    <Plus className="w-4 h-4" />
                    Create Your First Project
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {projects.slice(0, 4).map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.03 }}
              >
                <Link href={`/dashboard/projects/${project.id}`}>
                  <Card className="group cursor-pointer hover:shadow-lg transition-all h-full">
                    <CardHeader className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-sm mb-1 group-hover:text-blue-600 transition-colors line-clamp-1">
                            {project.name}
                          </CardTitle>
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                            {project.description}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex items-center gap-2 text-xs">
                        <Key className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                        <span className="font-semibold text-gray-900 dark:text-white">{project.credentials.length}</span>
                        <span className="text-gray-500 dark:text-gray-400">credentials</span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">
                          Updated {new Date(project.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

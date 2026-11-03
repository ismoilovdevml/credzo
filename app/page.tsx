"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, Server, Database, Key, Shield, Zap, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 animate-gradient relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-blue-500/10 rounded-full blur-3xl"
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-purple-500/10 rounded-full blur-3xl"
          animate={{ y: [0, 20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-20">
        {/* Hero Section */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex justify-center mb-8">
            <motion.div
              className="relative"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            >
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl animate-pulse" />
              <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-3xl shadow-2xl shadow-blue-500/50">
                <Lock className="w-16 h-16 text-white" strokeWidth={2.5} />
              </div>
            </motion.div>
          </div>

          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-300 font-medium">Secure Credential Management</span>
          </motion.div>

          <motion.h1
            className="text-7xl md:text-8xl font-black gradient-text mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Credzo
          </motion.h1>

          <motion.p
            className="text-2xl md:text-3xl text-gray-300 mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            DevOps Credentials <span className="text-blue-400 font-semibold">Simplified</span>
          </motion.p>

          <motion.p
            className="text-lg text-gray-400 max-w-2xl mx-auto mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Secure, organized management for infrastructure credentials, servers, databases, and services.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Link href="/dashboard">
              <Button size="lg" className="group">
                Open Dashboard
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="text-white border-white/20 hover:bg-white/10">
              Learn More
            </Button>
          </motion.div>
        </motion.div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-24">
          {[
            {
              icon: Server,
              title: "Server Management",
              desc: "Store VM credentials, SSH keys, and server access securely.",
              gradient: "from-blue-500 to-cyan-500",
            },
            {
              icon: Database,
              title: "Database Credentials",
              desc: "Manage PostgreSQL, Redis, MongoDB connections in one place.",
              gradient: "from-purple-500 to-pink-500",
            },
            {
              icon: Key,
              title: "Service Keys",
              desc: "API keys, tokens, and credentials organized by project.",
              gradient: "from-orange-500 to-red-500",
            },
          ].map((feature, i) => (
            <FeatureCard key={i} {...feature} index={i} />
          ))}
        </div>

        {/* Security Features */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-6">
          {[
            { icon: Shield, title: "Encrypted Storage", desc: "Industry-standard encryption" },
            { icon: Zap, title: "Lightning Fast", desc: "Instant credential access" },
            { icon: Lock, title: "Project Based", desc: "Organize by environments" },
          ].map((feature, i) => (
            <motion.div
              key={i}
              className="glass p-6 rounded-xl hover:bg-white/5 transition-all"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 flex-shrink-0">
                  <feature.icon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">{feature.title}</h4>
                  <p className="text-sm text-gray-400">{feature.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  gradient,
  index,
}: {
  icon: any;
  title: string;
  desc: string;
  gradient: string;
  index: number;
}) {
  return (
    <motion.div
      className="group relative"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ scale: 1.05 }}
    >
      <div className="glass p-8 rounded-2xl hover:bg-white/10 transition-all h-full">
        <motion.div
          className={`w-16 h-16 bg-gradient-to-r ${gradient} rounded-xl flex items-center justify-center text-white mb-6`}
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Icon className="w-8 h-8" />
        </motion.div>
        <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
        <p className="text-gray-400">{desc}</p>
      </div>
    </motion.div>
  );
}

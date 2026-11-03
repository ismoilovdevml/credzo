import {
  Server, Database, HardDrive, Radio, Cloud, Workflow,
  Box, Activity, Zap, Globe, GitBranch, FileCode,
  Mail, MessageCircle, Users, Shield, Key, FileText,
  Lock, Package, BarChart3, Search, TrendingUp, Network,
  MessageSquare, Container, Github, Webhook
} from "lucide-react";

const serviceIcons: Record<string, any> = {
  // Servers
  "vm-server": Server,
  "ssh-server": Server,
  "ftp": HardDrive,
  "sftp": HardDrive,

  // Databases
  "postgresql": Database,
  "mysql": Database,
  "mongodb": Database,
  "redis": Database,
  "mariadb": Database,
  "cassandra": Database,
  "elasticsearch": Search,
  "influxdb": TrendingUp,
  "timescaledb": TrendingUp,
  "clickhouse": Database,
  "couchdb": Database,
  "neo4j": Network,

  // Message Queues
  "rabbitmq": MessageSquare,
  "kafka": Radio,
  "nats": Radio,
  "activemq": MessageSquare,
  "redis-queue": Database,

  // Storage
  "minio": HardDrive,
  "aws-s3": Cloud,
  "azure-blob": Cloud,
  "google-cloud-storage": Cloud,
  "cloudflare": Cloud,

  // CI/CD
  "jenkins": Workflow,
  "gitlab-ci": GitBranch,
  "github-actions": Github,
  "circleci": Workflow,
  "travis-ci": Workflow,
  "argocd": GitBranch,
  "teamcity": Workflow,

  // Container
  "docker": Container,
  "kubernetes": Box,
  "docker-registry": Package,
  "harbor": Package,
  "rancher": Box,
  "openshift": Box,

  // Monitoring
  "prometheus": Activity,
  "grafana": BarChart3,
  "datadog": Activity,
  "new-relic": Activity,
  "elk-stack": Search,
  "splunk": Activity,
  "sentry": Activity,

  // Caching
  "memcached": Database,
  "varnish": Zap,

  // Proxy
  "nginx": Globe,
  "apache": Globe,
  "traefik": Globe,
  "haproxy": Globe,
  "caddy": Globe,

  // Version Control
  "github": Github,
  "gitlab": GitBranch,
  "bitbucket": GitBranch,

  // Cloud
  "aws": Cloud,
  "azure": Cloud,
  "gcp": Cloud,
  "digitalocean": Cloud,
  "linode": Cloud,
  "heroku": Cloud,

  // Config Management
  "ansible": FileCode,
  "terraform": FileCode,
  "consul": Network,
  "vault": Lock,
  "etcd": Database,

  // Communication
  "smtp": Mail,
  "slack": MessageCircle,
  "discord": MessageCircle,
  "telegram": MessageCircle,

  // Authentication
  "ldap": Users,
  "oauth": Shield,
  "jwt-secret": Key,
  "api-key": Key,

  // Other
  "webhook": Webhook,
  "vpn": Shield,
  "generic": FileText,
};

interface ServiceIconProps {
  type: string;
  className?: string;
}

export function ServiceIcon({ type, className = "w-5 h-5" }: ServiceIconProps) {
  const Icon = serviceIcons[type] || FileText;
  return <Icon className={className} />;
}

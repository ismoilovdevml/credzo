import { createElement } from "react";
import {
  Activity,
  BarChart3,
  Boxes,
  Bug,
  Cloud,
  Container,
  Database,
  FileCode,
  FileText,
  FileUp,
  Fingerprint,
  FolderUp,
  GitBranch,
  Github,
  Gitlab,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  LineChart,
  Lock,
  Mail,
  MemoryStick,
  MessageCircle,
  Network,
  Package,
  Rocket,
  ScrollText,
  Search,
  Send,
  Server,
  Settings2,
  Shield,
  ShieldCheck,
  Ship,
  Terminal,
  TrendingUp,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { getServiceMetadata } from "@/lib/services";
import type { ServiceType } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

/** One icon per service type in lib/services.ts SERVICE_DEFINITIONS. */
const SERVICE_ICONS: Record<string, LucideIcon> = {
  // Servers
  "vm-server": Server,
  "ssh-server": Terminal,
  ftp: FolderUp,
  sftp: FileUp,

  // Databases
  postgresql: Database,
  mysql: Database,
  mongodb: Database,
  redis: Database,
  mariadb: Database,
  cassandra: Database,
  elasticsearch: Search,
  influxdb: TrendingUp,
  timescaledb: TrendingUp,
  clickhouse: Database,
  couchdb: Database,
  neo4j: Network,

  // Message queues
  rabbitmq: Workflow,
  kafka: Workflow,
  nats: Workflow,
  activemq: Workflow,
  "redis-queue": Workflow,

  // Storage
  minio: HardDrive,
  "aws-s3": Cloud,
  "azure-blob": Cloud,
  "google-cloud-storage": Cloud,
  cloudflare: Cloud,

  // CI/CD
  jenkins: Workflow,
  "gitlab-ci": Gitlab,
  "github-actions": Github,
  circleci: Rocket,
  "travis-ci": Rocket,
  argocd: GitBranch,
  teamcity: Rocket,

  // Containers
  docker: Container,
  kubernetes: Ship,
  "docker-registry": Package,
  harbor: Package,
  rancher: Boxes,
  openshift: Boxes,

  // Monitoring
  prometheus: Activity,
  grafana: BarChart3,
  datadog: LineChart,
  "new-relic": LineChart,
  "elk-stack": ScrollText,
  splunk: ScrollText,
  sentry: Bug,

  // Caching
  memcached: MemoryStick,
  varnish: Zap,

  // Proxies
  nginx: Globe,
  apache: Globe,
  traefik: Globe,
  haproxy: Globe,
  caddy: Globe,

  // Version control
  github: Github,
  gitlab: Gitlab,
  bitbucket: GitBranch,

  // Cloud
  aws: Cloud,
  azure: Cloud,
  gcp: Cloud,
  digitalocean: Cloud,
  linode: Cloud,
  heroku: Cloud,

  // Configuration management
  ansible: FileCode,
  terraform: FileCode,
  consul: Network,
  vault: Lock,
  etcd: Database,

  // Communication
  smtp: Mail,
  slack: MessageCircle,
  discord: MessageCircle,
  telegram: Send,

  // Authentication
  ldap: Fingerprint,
  oauth: ShieldCheck,
  "jwt-secret": KeyRound,
  "api-key": KeyRound,

  // Other
  webhook: Webhook,
  vpn: Shield,
  generic: FileText,
};

/** Fallback icon for a type that is missing above but belongs to a known category. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Servers: Server,
  Database: Database,
  "Message Queue": Workflow,
  Storage: HardDrive,
  "CI/CD": Rocket,
  Container: Container,
  Monitoring: Activity,
  Caching: Zap,
  Proxy: Globe,
  "Version Control": GitBranch,
  Cloud: Cloud,
  "Config Management": Settings2,
  Communication: MessageCircle,
  Authentication: KeyRound,
  Other: Layers,
};

/** Tile colours (token classes) per category; every category maps to a fixed tone. */
const CATEGORY_TONES: Record<string, string> = {
  Servers: "bg-accent-soft text-accent-ink",
  Proxy: "bg-accent-soft text-accent-ink",
  Container: "bg-accent-soft text-accent-ink",
  Database: "bg-info-soft text-info",
  Caching: "bg-info-soft text-info",
  Authentication: "bg-violet-soft text-violet",
  "Config Management": "bg-violet-soft text-violet",
  Cloud: "bg-warn-soft text-warn",
  Storage: "bg-warn-soft text-warn",
  Monitoring: "bg-success-soft text-success",
  "Message Queue": "bg-ink/[0.06] text-ink-2",
  "CI/CD": "bg-ink/[0.06] text-ink-2",
  "Version Control": "bg-ink/[0.06] text-ink-2",
  Communication: "bg-info-soft text-info",
  Other: "bg-ink/[0.06] text-ink-2",
};

const NEUTRAL_TONE = "bg-ink/[0.06] text-ink-2";

const TILE_SIZES = {
  sm: "h-8 w-8 rounded-lg [&_svg]:h-4 [&_svg]:w-4",
  md: "h-9 w-9 rounded-[9px] [&_svg]:h-[18px] [&_svg]:w-[18px]",
  lg: "h-12 w-12 rounded-xl [&_svg]:h-6 [&_svg]:w-6",
} as const;

function serviceCategory(type: string): string | undefined {
  return getServiceMetadata(type as ServiceType)?.category;
}

function iconFor(type: string): LucideIcon {
  const category = serviceCategory(type);
  return SERVICE_ICONS[type] ?? (category ? CATEGORY_ICONS[category] : undefined) ?? FileText;
}

/** Token classes (background + text) for a service type, chosen by its category. */
export function serviceTone(type: string): string {
  const category = serviceCategory(type);
  return (category && CATEGORY_TONES[category]) || NEUTRAL_TONE;
}

interface ServiceIconProps {
  type: string;
  className?: string;
}

/** Bare lucide icon for a service type; inherits the current text colour. */
export function ServiceIcon({ type, className = "h-5 w-5" }: ServiceIconProps) {
  // createElement: the icon is looked up from a static map, not created during render.
  return createElement(iconFor(type), { className, "aria-hidden": true });
}

interface ServiceTileProps {
  type: string;
  size?: keyof typeof TILE_SIZES;
  className?: string;
}

/** Service icon on a tinted square, coloured by service category. */
export function ServiceTile({ type, size = "md", className }: ServiceTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex flex-none items-center justify-center", TILE_SIZES[size], serviceTone(type), className)}
    >
      <ServiceIcon type={type} className="" />
    </span>
  );
}

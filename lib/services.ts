import type { ServiceMetadata, ServiceType } from "./types";

// Service definitions with metadata and field configurations
export const SERVICE_DEFINITIONS: ServiceMetadata[] = [
  // ===== Servers & Infrastructure =====
  {
    type: "vm-server",
    category: "Servers",
    label: "VM Server",
    icon: "Server",
    color: "bg-blue-500",
    fields: [
      { name: "host", label: "Host/IP", type: "text", required: true, placeholder: "192.168.1.100" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "22" },
      { name: "username", label: "Username", type: "text", required: true, placeholder: "root" },
      { name: "password", label: "Password", type: "password", required: true },
      { name: "ram", label: "RAM", type: "text", required: false, placeholder: "16GB", description: "Server RAM size (e.g., 8GB, 16GB, 32GB)" },
      { name: "cpu", label: "CPU", type: "text", required: false, placeholder: "8 vCPU", description: "CPU cores or specifications" },
      { name: "disk", label: "Disk", type: "textarea", required: false, placeholder: "/dev/sda1: 500GB SSD\n/dev/sdb1: 1TB HDD", description: "Disk configuration (one per line)" },
      { name: "price", label: "Price/Month", type: "text", required: false, placeholder: "$50/month", description: "Monthly cost or pricing" },
    ],
  },
  {
    type: "ssh-server",
    category: "Servers",
    label: "SSH Server",
    icon: "Terminal",
    color: "bg-blue-600",
    fields: [
      { name: "host", label: "Host/IP", type: "text", required: true, placeholder: "server.example.com" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "22" },
      { name: "username", label: "Username", type: "text", required: true, placeholder: "ubuntu" },
      { name: "password", label: "Password", type: "password", required: false },
      { name: "privateKey", label: "Private Key", type: "textarea", required: false, placeholder: "-----BEGIN RSA PRIVATE KEY-----" },
      { name: "ram", label: "RAM", type: "text", required: false, placeholder: "16GB", description: "Server RAM size (e.g., 8GB, 16GB, 32GB)" },
      { name: "cpu", label: "CPU", type: "text", required: false, placeholder: "8 vCPU", description: "CPU cores or specifications" },
      { name: "disk", label: "Disk", type: "textarea", required: false, placeholder: "/dev/sda1: 500GB SSD\n/dev/sdb1: 1TB HDD", description: "Disk configuration (one per line)" },
      { name: "price", label: "Price/Month", type: "text", required: false, placeholder: "$50/month", description: "Monthly cost or pricing" },
    ],
  },
  {
    type: "ftp",
    category: "Servers",
    label: "FTP Server",
    icon: "FolderUp",
    color: "bg-indigo-500",
    fields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "ftp.example.com" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "21" },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "password", label: "Password", type: "password", required: true },
    ],
  },
  {
    type: "sftp",
    category: "Servers",
    label: "SFTP Server",
    icon: "FileUp",
    color: "bg-indigo-600",
    fields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "sftp.example.com" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "22" },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "password", label: "Password", type: "password", required: false },
      { name: "privateKey", label: "Private Key", type: "textarea", required: false },
    ],
  },

  // ===== Databases =====
  {
    type: "postgresql",
    category: "Database",
    label: "PostgreSQL",
    icon: "Database",
    color: "bg-blue-700",
    fields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "5432" },
      { name: "database", label: "Database", type: "text", required: true, placeholder: "mydb" },
      { name: "username", label: "Username", type: "text", required: true, placeholder: "postgres" },
      { name: "password", label: "Password", type: "password", required: true },
      { name: "sslMode", label: "SSL Mode", type: "text", required: false, placeholder: "require" },
    ],
  },
  {
    type: "mysql",
    category: "Database",
    label: "MySQL",
    icon: "Database",
    color: "bg-orange-600",
    fields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "3306" },
      { name: "database", label: "Database", type: "text", required: true },
      { name: "username", label: "Username", type: "text", required: true, placeholder: "root" },
      { name: "password", label: "Password", type: "password", required: true },
    ],
  },
  {
    type: "mongodb",
    category: "Database",
    label: "MongoDB",
    icon: "Database",
    color: "bg-green-600",
    fields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "27017" },
      { name: "database", label: "Database", type: "text", required: true },
      { name: "username", label: "Username", type: "text", required: false },
      { name: "password", label: "Password", type: "password", required: false },
      { name: "authSource", label: "Auth Source", type: "text", required: false, placeholder: "admin" },
    ],
  },
  {
    type: "redis",
    category: "Database",
    label: "Redis",
    icon: "Database",
    color: "bg-red-600",
    fields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "6379" },
      { name: "password", label: "Password", type: "password", required: false },
      { name: "db", label: "Database Index", type: "number", required: false, placeholder: "0" },
    ],
  },
  {
    type: "mariadb",
    category: "Database",
    label: "MariaDB",
    icon: "Database",
    color: "bg-blue-800",
    fields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "3306" },
      { name: "database", label: "Database", type: "text", required: true },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "password", label: "Password", type: "password", required: true },
    ],
  },
  {
    type: "cassandra",
    category: "Database",
    label: "Cassandra",
    icon: "Database",
    color: "bg-cyan-700",
    fields: [
      { name: "contactPoints", label: "Contact Points", type: "text", required: true, placeholder: "node1,node2" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "9042" },
      { name: "keyspace", label: "Keyspace", type: "text", required: true },
      { name: "username", label: "Username", type: "text", required: false },
      { name: "password", label: "Password", type: "password", required: false },
    ],
  },
  {
    type: "elasticsearch",
    category: "Database",
    label: "Elasticsearch",
    icon: "Search",
    color: "bg-yellow-600",
    fields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "9200" },
      { name: "username", label: "Username", type: "text", required: false },
      { name: "password", label: "Password", type: "password", required: false },
      { name: "apiKey", label: "API Key", type: "password", required: false },
    ],
  },
  {
    type: "influxdb",
    category: "Database",
    label: "InfluxDB",
    icon: "TrendingUp",
    color: "bg-purple-600",
    fields: [
      { name: "url", label: "URL", type: "url", required: true, placeholder: "http://localhost:8086" },
      { name: "token", label: "Token", type: "password", required: true },
      { name: "org", label: "Organization", type: "text", required: true },
      { name: "bucket", label: "Bucket", type: "text", required: true },
    ],
  },
  {
    type: "clickhouse",
    category: "Database",
    label: "ClickHouse",
    icon: "Database",
    color: "bg-yellow-700",
    fields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "8123" },
      { name: "database", label: "Database", type: "text", required: true },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "password", label: "Password", type: "password", required: true },
    ],
  },

  // ===== Message Queues =====
  {
    type: "rabbitmq",
    category: "Message Queue",
    label: "RabbitMQ",
    icon: "MessageSquare",
    color: "bg-orange-500",
    fields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "5672" },
      { name: "username", label: "Username", type: "text", required: true, placeholder: "guest" },
      { name: "password", label: "Password", type: "password", required: true },
      { name: "vhost", label: "Virtual Host", type: "text", required: false, placeholder: "/" },
    ],
  },
  {
    type: "kafka",
    category: "Message Queue",
    label: "Apache Kafka",
    icon: "Radio",
    color: "bg-gray-800",
    fields: [
      { name: "brokers", label: "Brokers", type: "text", required: true, placeholder: "localhost:9092,localhost:9093" },
      { name: "username", label: "Username (SASL)", type: "text", required: false },
      { name: "password", label: "Password (SASL)", type: "password", required: false },
      { name: "clientId", label: "Client ID", type: "text", required: false },
    ],
  },

  // ===== Object Storage =====
  {
    type: "minio",
    category: "Storage",
    label: "MinIO",
    icon: "HardDrive",
    color: "bg-red-700",
    fields: [
      { name: "endpoint", label: "Endpoint", type: "url", required: true, placeholder: "http://localhost:9000" },
      { name: "accessKey", label: "Access Key", type: "text", required: true },
      { name: "secretKey", label: "Secret Key", type: "password", required: true },
      { name: "bucket", label: "Bucket", type: "text", required: false },
      { name: "region", label: "Region", type: "text", required: false },
    ],
  },
  {
    type: "aws-s3",
    category: "Storage",
    label: "AWS S3",
    icon: "Cloud",
    color: "bg-orange-400",
    fields: [
      { name: "accessKeyId", label: "Access Key ID", type: "text", required: true },
      { name: "secretAccessKey", label: "Secret Access Key", type: "password", required: true },
      { name: "region", label: "Region", type: "text", required: true, placeholder: "us-east-1" },
      { name: "bucket", label: "Bucket", type: "text", required: false },
    ],
  },

  // ===== CI/CD =====
  {
    type: "jenkins",
    category: "CI/CD",
    label: "Jenkins",
    icon: "Workflow",
    color: "bg-red-800",
    fields: [
      { name: "url", label: "Jenkins URL", type: "url", required: true, placeholder: "http://jenkins.example.com" },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "apiToken", label: "API Token", type: "password", required: true },
    ],
  },
  {
    type: "gitlab-ci",
    category: "CI/CD",
    label: "GitLab CI",
    icon: "GitBranch",
    color: "bg-orange-700",
    fields: [
      { name: "url", label: "GitLab URL", type: "url", required: true, placeholder: "https://gitlab.com" },
      { name: "accessToken", label: "Access Token", type: "password", required: true },
      { name: "projectId", label: "Project ID", type: "text", required: false },
    ],
  },
  {
    type: "github-actions",
    category: "CI/CD",
    label: "GitHub Actions",
    icon: "Github",
    color: "bg-gray-900",
    fields: [
      { name: "repository", label: "Repository", type: "text", required: true, placeholder: "owner/repo" },
      { name: "accessToken", label: "Personal Access Token", type: "password", required: true },
    ],
  },

  // ===== Container & Orchestration =====
  {
    type: "docker",
    category: "Container",
    label: "Docker",
    icon: "Container",
    color: "bg-blue-500",
    fields: [
      { name: "host", label: "Docker Host", type: "text", required: true, placeholder: "unix:///var/run/docker.sock" },
      { name: "tlsCert", label: "TLS Cert", type: "textarea", required: false },
      { name: "tlsKey", label: "TLS Key", type: "textarea", required: false },
    ],
  },
  {
    type: "kubernetes",
    category: "Container",
    label: "Kubernetes",
    icon: "Box",
    color: "bg-blue-600",
    fields: [
      { name: "apiServer", label: "API Server", type: "url", required: true, placeholder: "https://k8s.example.com:6443" },
      { name: "token", label: "Token", type: "password", required: false },
      { name: "kubeconfig", label: "Kubeconfig", type: "textarea", required: false },
      { name: "namespace", label: "Namespace", type: "text", required: false, placeholder: "default" },
    ],
  },
  {
    type: "docker-registry",
    category: "Container",
    label: "Docker Registry",
    icon: "Package",
    color: "bg-cyan-600",
    fields: [
      { name: "url", label: "Registry URL", type: "url", required: true, placeholder: "https://registry.example.com" },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "password", label: "Password", type: "password", required: true },
    ],
  },

  // ===== Monitoring =====
  {
    type: "prometheus",
    category: "Monitoring",
    label: "Prometheus",
    icon: "Activity",
    color: "bg-orange-600",
    fields: [
      { name: "url", label: "Prometheus URL", type: "url", required: true, placeholder: "http://localhost:9090" },
      { name: "username", label: "Username", type: "text", required: false },
      { name: "password", label: "Password", type: "password", required: false },
    ],
  },
  {
    type: "grafana",
    category: "Monitoring",
    label: "Grafana",
    icon: "BarChart3",
    color: "bg-orange-500",
    fields: [
      { name: "url", label: "Grafana URL", type: "url", required: true, placeholder: "http://localhost:3000" },
      { name: "apiKey", label: "API Key", type: "password", required: true },
    ],
  },

  // ===== Reverse Proxy =====
  {
    type: "nginx",
    category: "Proxy",
    label: "Nginx",
    icon: "Globe",
    color: "bg-green-700",
    fields: [
      { name: "host", label: "Host", type: "text", required: true },
      { name: "configPath", label: "Config Path", type: "text", required: false, placeholder: "/etc/nginx/nginx.conf" },
      { name: "sshUser", label: "SSH User", type: "text", required: false },
      { name: "sshPassword", label: "SSH Password", type: "password", required: false },
    ],
  },

  // ===== Cloud Providers =====
  {
    type: "aws",
    category: "Cloud",
    label: "AWS",
    icon: "Cloud",
    color: "bg-orange-500",
    fields: [
      { name: "accessKeyId", label: "Access Key ID", type: "text", required: true },
      { name: "secretAccessKey", label: "Secret Access Key", type: "password", required: true },
      { name: "region", label: "Default Region", type: "text", required: false, placeholder: "us-east-1" },
      { name: "accountId", label: "Account ID", type: "text", required: false },
    ],
  },
  {
    type: "azure",
    category: "Cloud",
    label: "Microsoft Azure",
    icon: "Cloud",
    color: "bg-blue-600",
    fields: [
      { name: "subscriptionId", label: "Subscription ID", type: "text", required: true },
      { name: "tenantId", label: "Tenant ID", type: "text", required: true },
      { name: "clientId", label: "Client ID", type: "text", required: true },
      { name: "clientSecret", label: "Client Secret", type: "password", required: true },
    ],
  },
  {
    type: "gcp",
    category: "Cloud",
    label: "Google Cloud Platform",
    icon: "Cloud",
    color: "bg-red-500",
    fields: [
      { name: "projectId", label: "Project ID", type: "text", required: true },
      { name: "serviceAccountKey", label: "Service Account Key (JSON)", type: "textarea", required: true, placeholder: '{"type": "service_account", ...}' },
    ],
  },
  {
    type: "digitalocean",
    category: "Cloud",
    label: "DigitalOcean",
    icon: "Cloud",
    color: "bg-blue-500",
    fields: [
      { name: "apiToken", label: "API Token", type: "password", required: true },
      { name: "spaceAccessKey", label: "Spaces Access Key", type: "text", required: false },
      { name: "spaceSecretKey", label: "Spaces Secret Key", type: "password", required: false },
    ],
  },

  // ===== Configuration Management =====
  {
    type: "vault",
    category: "Config Management",
    label: "HashiCorp Vault",
    icon: "Lock",
    color: "bg-yellow-500",
    fields: [
      { name: "url", label: "Vault URL", type: "url", required: true, placeholder: "http://localhost:8200" },
      { name: "token", label: "Token", type: "password", required: true },
      { name: "namespace", label: "Namespace", type: "text", required: false },
    ],
  },
  {
    type: "terraform",
    category: "Config Management",
    label: "Terraform Cloud",
    icon: "FileCode",
    color: "bg-purple-700",
    fields: [
      { name: "organization", label: "Organization", type: "text", required: true },
      { name: "apiToken", label: "API Token", type: "password", required: true },
      { name: "workspace", label: "Workspace", type: "text", required: false },
    ],
  },

  // ===== Communication =====
  {
    type: "smtp",
    category: "Communication",
    label: "SMTP Server",
    icon: "Mail",
    color: "bg-blue-600",
    fields: [
      { name: "host", label: "SMTP Host", type: "text", required: true, placeholder: "smtp.gmail.com" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "587" },
      { name: "username", label: "Username", type: "email", required: true },
      { name: "password", label: "Password", type: "password", required: true },
      { name: "secure", label: "Use TLS/SSL", type: "text", required: false, placeholder: "true" },
    ],
  },
  {
    type: "slack",
    category: "Communication",
    label: "Slack",
    icon: "MessageCircle",
    color: "bg-purple-600",
    fields: [
      { name: "webhookUrl", label: "Webhook URL", type: "url", required: false },
      { name: "botToken", label: "Bot Token", type: "password", required: false },
      { name: "appToken", label: "App Token", type: "password", required: false },
    ],
  },
  {
    type: "discord",
    category: "Communication",
    label: "Discord",
    icon: "MessageCircle",
    color: "bg-indigo-500",
    fields: [
      { name: "webhookUrl", label: "Webhook URL", type: "url", required: false },
      { name: "botToken", label: "Bot Token", type: "password", required: false },
      { name: "applicationId", label: "Application ID", type: "text", required: false },
    ],
  },
  {
    type: "telegram",
    category: "Communication",
    label: "Telegram",
    icon: "MessageCircle",
    color: "bg-blue-400",
    fields: [
      { name: "botToken", label: "Bot Token", type: "password", required: true },
      { name: "chatId", label: "Chat ID", type: "text", required: false },
    ],
  },

  // ===== Authentication =====
  {
    type: "ldap",
    category: "Authentication",
    label: "LDAP",
    icon: "Users",
    color: "bg-indigo-600",
    fields: [
      { name: "url", label: "LDAP URL", type: "url", required: true, placeholder: "ldap://ldap.example.com:389" },
      { name: "bindDN", label: "Bind DN", type: "text", required: true, placeholder: "cn=admin,dc=example,dc=com" },
      { name: "bindPassword", label: "Bind Password", type: "password", required: true },
      { name: "baseDN", label: "Base DN", type: "text", required: true, placeholder: "dc=example,dc=com" },
    ],
  },
  {
    type: "oauth",
    category: "Authentication",
    label: "OAuth Provider",
    icon: "Shield",
    color: "bg-green-600",
    fields: [
      { name: "clientId", label: "Client ID", type: "text", required: true },
      { name: "clientSecret", label: "Client Secret", type: "password", required: true },
      { name: "authUrl", label: "Authorization URL", type: "url", required: false },
      { name: "tokenUrl", label: "Token URL", type: "url", required: false },
    ],
  },
  {
    type: "api-key",
    category: "Authentication",
    label: "API Key",
    icon: "Key",
    color: "bg-yellow-600",
    fields: [
      { name: "apiKey", label: "API Key", type: "password", required: true },
      { name: "apiUrl", label: "API URL", type: "url", required: false },
      { name: "apiSecret", label: "API Secret", type: "password", required: false },
    ],
  },
  {
    type: "jwt-secret",
    category: "Authentication",
    label: "JWT Secret",
    icon: "Key",
    color: "bg-indigo-700",
    fields: [
      { name: "secret", label: "JWT Secret", type: "password", required: true },
      { name: "algorithm", label: "Algorithm", type: "text", required: false, placeholder: "HS256" },
      { name: "expiresIn", label: "Expires In", type: "text", required: false, placeholder: "1h" },
    ],
  },

  // ===== Additional Databases =====
  {
    type: "timescaledb",
    category: "Database",
    label: "TimescaleDB",
    icon: "Database",
    color: "bg-orange-700",
    fields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "5432" },
      { name: "database", label: "Database", type: "text", required: true },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "password", label: "Password", type: "password", required: true },
    ],
  },
  {
    type: "couchdb",
    category: "Database",
    label: "CouchDB",
    icon: "Database",
    color: "bg-red-500",
    fields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "5984" },
      { name: "username", label: "Username", type: "text", required: false },
      { name: "password", label: "Password", type: "password", required: false },
      { name: "database", label: "Database", type: "text", required: false },
    ],
  },
  {
    type: "neo4j",
    category: "Database",
    label: "Neo4j",
    icon: "Database",
    color: "bg-green-700",
    fields: [
      { name: "uri", label: "URI", type: "url", required: true, placeholder: "bolt://localhost:7687" },
      { name: "username", label: "Username", type: "text", required: true, placeholder: "neo4j" },
      { name: "password", label: "Password", type: "password", required: true },
    ],
  },

  // ===== Additional Message Queues =====
  {
    type: "nats",
    category: "Message Queue",
    label: "NATS",
    icon: "Radio",
    color: "bg-blue-500",
    fields: [
      { name: "servers", label: "Servers", type: "text", required: true, placeholder: "nats://localhost:4222" },
      { name: "username", label: "Username", type: "text", required: false },
      { name: "password", label: "Password", type: "password", required: false },
      { name: "token", label: "Token", type: "password", required: false },
    ],
  },
  {
    type: "activemq",
    category: "Message Queue",
    label: "ActiveMQ",
    icon: "MessageSquare",
    color: "bg-red-600",
    fields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "61616" },
      { name: "username", label: "Username", type: "text", required: false },
      { name: "password", label: "Password", type: "password", required: false },
    ],
  },
  {
    type: "redis-queue",
    category: "Message Queue",
    label: "Redis Queue (Bull/BullMQ)",
    icon: "Database",
    color: "bg-red-700",
    fields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "6379" },
      { name: "password", label: "Password", type: "password", required: false },
      { name: "prefix", label: "Queue Prefix", type: "text", required: false, placeholder: "bull" },
    ],
  },

  // ===== Additional Storage =====
  {
    type: "azure-blob",
    category: "Storage",
    label: "Azure Blob Storage",
    icon: "Cloud",
    color: "bg-blue-500",
    fields: [
      { name: "accountName", label: "Account Name", type: "text", required: true },
      { name: "accountKey", label: "Account Key", type: "password", required: true },
      { name: "containerName", label: "Container Name", type: "text", required: false },
    ],
  },
  {
    type: "google-cloud-storage",
    category: "Storage",
    label: "Google Cloud Storage",
    icon: "Cloud",
    color: "bg-blue-600",
    fields: [
      { name: "projectId", label: "Project ID", type: "text", required: true },
      { name: "keyFile", label: "Service Account Key (JSON)", type: "textarea", required: true },
      { name: "bucket", label: "Bucket", type: "text", required: false },
    ],
  },
  {
    type: "cloudflare",
    category: "Storage",
    label: "Cloudflare R2",
    icon: "Cloud",
    color: "bg-orange-500",
    fields: [
      { name: "accountId", label: "Account ID", type: "text", required: true },
      { name: "accessKeyId", label: "Access Key ID", type: "text", required: true },
      { name: "secretAccessKey", label: "Secret Access Key", type: "password", required: true },
      { name: "bucket", label: "Bucket", type: "text", required: false },
    ],
  },

  // ===== Additional CI/CD =====
  {
    type: "circleci",
    category: "CI/CD",
    label: "CircleCI",
    icon: "Workflow",
    color: "bg-gray-700",
    fields: [
      { name: "apiToken", label: "API Token", type: "password", required: true },
      { name: "organization", label: "Organization", type: "text", required: false },
    ],
  },
  {
    type: "travis-ci",
    category: "CI/CD",
    label: "Travis CI",
    icon: "Workflow",
    color: "bg-yellow-600",
    fields: [
      { name: "apiToken", label: "API Token", type: "password", required: true },
      { name: "apiUrl", label: "API URL", type: "url", required: false, placeholder: "https://api.travis-ci.com" },
    ],
  },
  {
    type: "argocd",
    category: "CI/CD",
    label: "ArgoCD",
    icon: "GitBranch",
    color: "bg-orange-600",
    fields: [
      { name: "serverUrl", label: "Server URL", type: "url", required: true, placeholder: "https://argocd.example.com" },
      { name: "authToken", label: "Auth Token", type: "password", required: true },
      { name: "username", label: "Username", type: "text", required: false },
    ],
  },
  {
    type: "teamcity",
    category: "CI/CD",
    label: "TeamCity",
    icon: "Workflow",
    color: "bg-blue-700",
    fields: [
      { name: "serverUrl", label: "Server URL", type: "url", required: true },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "password", label: "Password", type: "password", required: true },
    ],
  },

  // ===== Additional Container & Orchestration =====
  {
    type: "harbor",
    category: "Container",
    label: "Harbor Registry",
    icon: "Package",
    color: "bg-blue-600",
    fields: [
      { name: "url", label: "Harbor URL", type: "url", required: true, placeholder: "https://harbor.example.com" },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "password", label: "Password", type: "password", required: true },
    ],
  },
  {
    type: "rancher",
    category: "Container",
    label: "Rancher",
    icon: "Box",
    color: "bg-blue-500",
    fields: [
      { name: "serverUrl", label: "Server URL", type: "url", required: true },
      { name: "accessKey", label: "Access Key", type: "text", required: true },
      { name: "secretKey", label: "Secret Key", type: "password", required: true },
      { name: "clusterId", label: "Cluster ID", type: "text", required: false },
    ],
  },
  {
    type: "openshift",
    category: "Container",
    label: "Red Hat OpenShift",
    icon: "Box",
    color: "bg-red-700",
    fields: [
      { name: "apiUrl", label: "API URL", type: "url", required: true, placeholder: "https://api.openshift.com:6443" },
      { name: "token", label: "Token", type: "password", required: true },
      { name: "namespace", label: "Namespace", type: "text", required: false },
    ],
  },

  // ===== Additional Monitoring =====
  {
    type: "datadog",
    category: "Monitoring",
    label: "Datadog",
    icon: "Activity",
    color: "bg-purple-600",
    fields: [
      { name: "apiKey", label: "API Key", type: "password", required: true },
      { name: "appKey", label: "Application Key", type: "password", required: true },
      { name: "site", label: "Site", type: "text", required: false, placeholder: "datadoghq.com" },
    ],
  },
  {
    type: "new-relic",
    category: "Monitoring",
    label: "New Relic",
    icon: "Activity",
    color: "bg-green-500",
    fields: [
      { name: "apiKey", label: "API Key", type: "password", required: true },
      { name: "accountId", label: "Account ID", type: "text", required: true },
      { name: "licenseKey", label: "License Key", type: "password", required: false },
    ],
  },
  {
    type: "elk-stack",
    category: "Monitoring",
    label: "ELK Stack (Elasticsearch)",
    icon: "Search",
    color: "bg-teal-600",
    fields: [
      { name: "elasticsearchUrl", label: "Elasticsearch URL", type: "url", required: true },
      { name: "kibanaUrl", label: "Kibana URL", type: "url", required: false },
      { name: "username", label: "Username", type: "text", required: false },
      { name: "password", label: "Password", type: "password", required: false },
    ],
  },
  {
    type: "splunk",
    category: "Monitoring",
    label: "Splunk",
    icon: "Activity",
    color: "bg-green-600",
    fields: [
      { name: "url", label: "Splunk URL", type: "url", required: true },
      { name: "token", label: "HEC Token", type: "password", required: true },
      { name: "index", label: "Index", type: "text", required: false },
    ],
  },
  {
    type: "sentry",
    category: "Monitoring",
    label: "Sentry",
    icon: "AlertCircle",
    color: "bg-purple-700",
    fields: [
      { name: "dsn", label: "DSN", type: "password", required: true },
      { name: "authToken", label: "Auth Token", type: "password", required: false },
      { name: "organization", label: "Organization", type: "text", required: false },
      { name: "project", label: "Project", type: "text", required: false },
    ],
  },

  // ===== Caching =====
  {
    type: "memcached",
    category: "Caching",
    label: "Memcached",
    icon: "Database",
    color: "bg-purple-500",
    fields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "11211" },
      { name: "username", label: "Username (SASL)", type: "text", required: false },
      { name: "password", label: "Password (SASL)", type: "password", required: false },
    ],
  },
  {
    type: "varnish",
    category: "Caching",
    label: "Varnish Cache",
    icon: "Zap",
    color: "bg-blue-700",
    fields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { name: "port", label: "Port", type: "number", required: true, placeholder: "6082" },
      { name: "secret", label: "Secret", type: "password", required: false },
    ],
  },

  // ===== Additional Proxy & Load Balancer =====
  {
    type: "apache",
    category: "Proxy",
    label: "Apache HTTP Server",
    icon: "Globe",
    color: "bg-red-600",
    fields: [
      { name: "host", label: "Host", type: "text", required: true },
      { name: "configPath", label: "Config Path", type: "text", required: false, placeholder: "/etc/apache2/apache2.conf" },
      { name: "sshUser", label: "SSH User", type: "text", required: false },
      { name: "sshPassword", label: "SSH Password", type: "password", required: false },
    ],
  },
  {
    type: "traefik",
    category: "Proxy",
    label: "Traefik",
    icon: "Globe",
    color: "bg-cyan-600",
    fields: [
      { name: "apiUrl", label: "API URL", type: "url", required: true, placeholder: "http://localhost:8080" },
      { name: "username", label: "Username", type: "text", required: false },
      { name: "password", label: "Password", type: "password", required: false },
    ],
  },
  {
    type: "haproxy",
    category: "Proxy",
    label: "HAProxy",
    icon: "Globe",
    color: "bg-blue-800",
    fields: [
      { name: "host", label: "Host", type: "text", required: true },
      { name: "statsUrl", label: "Stats URL", type: "url", required: false, placeholder: "http://localhost:8404/stats" },
      { name: "username", label: "Stats Username", type: "text", required: false },
      { name: "password", label: "Stats Password", type: "password", required: false },
    ],
  },
  {
    type: "caddy",
    category: "Proxy",
    label: "Caddy Server",
    icon: "Globe",
    color: "bg-green-600",
    fields: [
      { name: "host", label: "Host", type: "text", required: true },
      { name: "adminUrl", label: "Admin API URL", type: "url", required: false, placeholder: "http://localhost:2019" },
      { name: "configPath", label: "Config Path", type: "text", required: false, placeholder: "/etc/caddy/Caddyfile" },
    ],
  },

  // ===== Version Control =====
  {
    type: "github",
    category: "Version Control",
    label: "GitHub",
    icon: "Github",
    color: "bg-gray-800",
    fields: [
      { name: "personalAccessToken", label: "Personal Access Token", type: "password", required: true },
      { name: "username", label: "Username", type: "text", required: false },
      { name: "repository", label: "Repository", type: "text", required: false, placeholder: "owner/repo" },
    ],
  },
  {
    type: "gitlab",
    category: "Version Control",
    label: "GitLab",
    icon: "GitBranch",
    color: "bg-orange-600",
    fields: [
      { name: "url", label: "GitLab URL", type: "url", required: true, placeholder: "https://gitlab.com" },
      { name: "accessToken", label: "Access Token", type: "password", required: true },
      { name: "projectId", label: "Project ID", type: "text", required: false },
    ],
  },
  {
    type: "bitbucket",
    category: "Version Control",
    label: "Bitbucket",
    icon: "GitBranch",
    color: "bg-blue-600",
    fields: [
      { name: "username", label: "Username", type: "text", required: true },
      { name: "appPassword", label: "App Password", type: "password", required: true },
      { name: "workspace", label: "Workspace", type: "text", required: false },
    ],
  },

  // ===== Additional Cloud Providers =====
  {
    type: "linode",
    category: "Cloud",
    label: "Linode",
    icon: "Cloud",
    color: "bg-green-700",
    fields: [
      { name: "apiToken", label: "API Token", type: "password", required: true },
      { name: "region", label: "Default Region", type: "text", required: false, placeholder: "us-east" },
    ],
  },
  {
    type: "heroku",
    category: "Cloud",
    label: "Heroku",
    icon: "Cloud",
    color: "bg-purple-600",
    fields: [
      { name: "apiKey", label: "API Key", type: "password", required: true },
      { name: "email", label: "Email", type: "email", required: false },
    ],
  },

  // ===== Additional Config Management =====
  {
    type: "ansible",
    category: "Config Management",
    label: "Ansible",
    icon: "FileCode",
    color: "bg-red-600",
    fields: [
      { name: "host", label: "Ansible Host", type: "text", required: true },
      { name: "username", label: "SSH Username", type: "text", required: true },
      { name: "privateKey", label: "SSH Private Key", type: "textarea", required: false },
      { name: "password", label: "SSH Password", type: "password", required: false },
      { name: "inventoryPath", label: "Inventory Path", type: "text", required: false },
    ],
  },
  {
    type: "consul",
    category: "Config Management",
    label: "HashiCorp Consul",
    icon: "Network",
    color: "bg-pink-600",
    fields: [
      { name: "address", label: "Address", type: "url", required: true, placeholder: "http://localhost:8500" },
      { name: "token", label: "ACL Token", type: "password", required: false },
      { name: "datacenter", label: "Datacenter", type: "text", required: false },
    ],
  },
  {
    type: "etcd",
    category: "Config Management",
    label: "etcd",
    icon: "Database",
    color: "bg-blue-700",
    fields: [
      { name: "endpoints", label: "Endpoints", type: "text", required: true, placeholder: "http://localhost:2379" },
      { name: "username", label: "Username", type: "text", required: false },
      { name: "password", label: "Password", type: "password", required: false },
    ],
  },

  // ===== Other Services =====
  {
    type: "webhook",
    category: "Other",
    label: "Webhook",
    icon: "Webhook",
    color: "bg-gray-700",
    fields: [
      { name: "url", label: "Webhook URL", type: "url", required: true },
      { name: "secret", label: "Secret", type: "password", required: false },
      { name: "headers", label: "Custom Headers (JSON)", type: "textarea", required: false, placeholder: '{"Authorization": "Bearer token"}' },
    ],
  },
  {
    type: "vpn",
    category: "Other",
    label: "VPN",
    icon: "Shield",
    color: "bg-blue-700",
    fields: [
      { name: "server", label: "VPN Server", type: "text", required: true },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "password", label: "Password", type: "password", required: false },
      { name: "certificate", label: "Certificate", type: "textarea", required: false },
      { name: "protocol", label: "Protocol", type: "text", required: false, placeholder: "OpenVPN" },
    ],
  },

  // ===== Generic =====
  {
    type: "generic",
    category: "Other",
    label: "Generic Credential",
    icon: "FileText",
    color: "bg-gray-600",
    fields: [
      { name: "username", label: "Username", type: "text", required: false },
      { name: "password", label: "Password", type: "password", required: false },
      { name: "url", label: "URL", type: "url", required: false },
      { name: "notes", label: "Notes", type: "textarea", required: false },
    ],
  },
];

// Helper function to get service metadata by type
export function getServiceMetadata(type: ServiceType): ServiceMetadata | undefined {
  return SERVICE_DEFINITIONS.find((s) => s.type === type);
}

// Helper function to get all service types grouped by category
export function getServicesByCategory(): Record<string, ServiceMetadata[]> {
  const grouped: Record<string, ServiceMetadata[]> = {};

  for (const service of SERVICE_DEFINITIONS) {
    if (!grouped[service.category]) {
      grouped[service.category] = [];
    }
    grouped[service.category].push(service);
  }

  return grouped;
}

// Get all categories
export function getCategories(): string[] {
  return [...new Set(SERVICE_DEFINITIONS.map((s) => s.category))];
}

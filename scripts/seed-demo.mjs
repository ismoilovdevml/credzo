#!/usr/bin/env node
/**
 * Populates a running Credzo instance with a realistic DEMO dataset.
 *
 * Everything goes through the public HTTP API, so secrets are encrypted and
 * audit events are recorded exactly as they would be for real users.
 *
 *   BASE_URL=http://localhost:3000 DEMO_PASSWORD=credzo-demo-2026 npm run seed:demo
 *
 * Run it against a FRESH instance: the first account becomes the platform admin.
 * If the demo owner already exists the script does nothing and exits 0.
 * All secret values are random and every host is fake (example.com / 10.0.x.x).
 */
import { randomBytes, randomInt } from "node:crypto";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const ORIGIN = new URL(BASE_URL).origin;
const PASSWORD = process.env.DEMO_PASSWORD ?? "credzo-demo-2026";
const MAX_RATE_LIMIT_RETRIES = 3;

// ---------------------------------------------------------------------------
// Minimal cookie-aware API client
// ---------------------------------------------------------------------------

class ApiError extends Error {
  constructor(method, path, status, message) {
    super(`${method} ${path} -> ${status}: ${message}`);
    this.status = status;
    this.apiMessage = message;
  }
}

class Session {
  #cookies = new Map();

  async call(method, path, body, attempt = 0) {
    const headers = { Accept: "application/json", Origin: ORIGIN };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.#cookies.size > 0) {
      headers.Cookie = [...this.#cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });

    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (value === "" || /max-age=0/i.test(raw)) this.#cookies.delete(name);
      else this.#cookies.set(name, value);
    }

    if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const waitSeconds = Math.min(Number(res.headers.get("retry-after")) || 5, 60);
      log(`  rate limited on ${path}, retrying in ${waitSeconds}s`);
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
      return this.call(method, path, body, attempt + 1);
    }

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      throw new ApiError(method, path, res.status, json?.error ?? (text.slice(0, 200) || res.statusText));
    }
    return json;
  }

  get(path) {
    return this.call("GET", path);
  }

  post(path, body) {
    return this.call("POST", path, body ?? {});
  }
}

// ---------------------------------------------------------------------------
// Fake-value helpers (obviously not real secrets)
// ---------------------------------------------------------------------------

const token = (bytes = 24) => randomBytes(bytes).toString("base64url");
const hex = (bytes = 16) => randomBytes(bytes).toString("hex");
const ip = () => `10.0.${randomInt(1, 255)}.${randomInt(2, 254)}`;
const log = (msg) => process.stdout.write(`${msg}\n`);

// ---------------------------------------------------------------------------
// Dataset
// ---------------------------------------------------------------------------

const OWNER = {
  username: "dilnoza",
  email: "dilnoza@example.com",
  firstName: "Dilnoza",
  lastName: "Karimova",
};

const TEAMMATES = [
  { username: "aziz", email: "aziz@example.com", firstName: "Aziz", lastName: "Rahimov", role: "admin" },
  { username: "malika", email: "malika@example.com", firstName: "Malika", lastName: "Yusupova", role: "member" },
  { username: "timur", email: "timur@example.com", firstName: "Timur", lastName: "Saidov", role: "member" },
  { username: "nodira", email: "nodira@example.com", firstName: "Nodira", lastName: "Ergasheva", role: "viewer" },
];

const ssh = (host, username) => ({
  host,
  port: "22",
  username,
  password: token(18),
  cpu: "4 vCPU",
  ram: "16GB",
  disk: "/dev/sda1: 200GB SSD",
});
const pg = (database, username) => ({
  host: ip(),
  port: "5432",
  database,
  username,
  password: token(),
  sslMode: "require",
});

/** name, type, environment, rotationDays, description, fields */
const PROJECTS = [
  {
    name: "Payments API",
    description: "Card processing service and its ledger database.",
    credentials: [
      ["payments-db-primary", "postgresql", "production", 90, "Primary ledger database (read/write).", pg("payments", "pay_svc")],
      ["payments-db-staging", "postgresql", "staging", null, "Staging copy, refreshed nightly.", pg("payments_staging", "pay_svc")],
      ["payments-redis", "redis", "production", null, "Idempotency keys and rate limiting.", { host: ip(), port: "6379", password: token(), db: "0" }],
      ["stripe-secret-key", "api-key", "production", 30, "Stripe restricted key for charges.", { apiKey: `sk_test_${token(24)}`, apiUrl: "https://api.stripe.example.com" }],
      ["api-node-01", "ssh-server", "production", 90, "API node behind the internal load balancer.", ssh("api-01.payments.example.com", "ubuntu")],
      ["payments-jwt-signing", "jwt-secret", "production", 180, "Signs merchant session tokens.", { secret: token(48), algorithm: "HS256", expiresIn: "1h" }],
    ],
  },
  {
    name: "Customer Portal",
    description: "Self-service web portal for customers.",
    credentials: [
      ["portal-db", "mysql", "production", 90, "Portal application database.", { host: ip(), port: "3306", database: "portal", username: "portal_app", password: token() }],
      ["portal-smtp", "smtp", "production", null, "Transactional email relay.", { host: "smtp.example.com", port: "587", username: "portal@example.com", password: token(), secure: "true" }],
      ["portal-sentry", "sentry", "production", null, "Error tracking DSN.", { dsn: `https://${hex(16)}@sentry.example.com/42`, authToken: token(32), organization: "acme", project: "customer-portal" }],
      ["google-oauth-client", "oauth", "production", 365, "Sign in with Google.", { clientId: `${randomInt(100000, 999999)}-${hex(8)}.apps.example.com`, clientSecret: token(), authUrl: "https://accounts.example.com/o/oauth2/auth", tokenUrl: "https://oauth2.example.com/token" }],
      ["portal-staging-ssh", "ssh-server", "staging", null, "Staging web host.", ssh("portal-staging.example.com", "deploy")],
    ],
  },
  {
    name: "Data Platform",
    description: "Event pipeline, warehouse and analytics storage.",
    credentials: [
      ["warehouse-clickhouse", "clickhouse", "production", 90, "Analytics warehouse.", { host: ip(), port: "8123", database: "analytics", username: "etl", password: token() }],
      ["events-kafka", "kafka", "production", null, "Event bus brokers.", { brokers: `${ip()}:9092,${ip()}:9092`, username: "events", password: token(), clientId: "ingest" }],
      ["analytics-s3", "aws-s3", "production", 90, "Raw event archive bucket.", { accessKeyId: `AKIAEXAMPLE${hex(5).toUpperCase()}`, secretAccessKey: token(30), region: "eu-central-1", bucket: "acme-analytics-raw" }],
      ["etl-postgres", "postgresql", "staging", null, "ETL staging database.", pg("etl", "etl_runner")],
      ["search-elasticsearch", "elasticsearch", "production", null, "Product search cluster.", { host: ip(), port: "9200", username: "elastic", password: token() }],
      ["airflow-worker", "ssh-server", "development", null, "Airflow worker for experiments.", ssh("airflow-dev.example.com", "airflow")],
      ["minio-dev", "minio", "development", null, "Local object storage for notebooks.", { endpoint: "http://minio.dev.example.com:9000", accessKey: hex(10), secretKey: token(), bucket: "scratch", region: "us-east-1" }],
    ],
  },
  {
    name: "Marketing Site",
    description: "Public website, CMS and newsletter.",
    credentials: [
      ["cms-db", "mysql", "production", 180, "Headless CMS database.", { host: ip(), port: "3306", database: "cms", username: "cms", password: token() }],
      ["cloudflare-r2", "cloudflare", "production", null, "Static asset bucket.", { accountId: hex(16), accessKeyId: hex(16), secretAccessKey: token(32), bucket: "marketing-assets" }],
      ["newsletter-api", "api-key", "production", 60, "Newsletter provider API.", { apiKey: `nl_${token(28)}`, apiUrl: "https://api.newsletter.example.com" }],
      ["preview-host", "ssh-server", "staging", null, "Preview deployments.", ssh("preview.marketing.example.com", "deploy")],
    ],
  },
  {
    name: "Internal Tools",
    description: "Shared tooling: monitoring, CI/CD and chat-ops.",
    credentials: [
      ["grafana-admin", "grafana", "production", 90, "Grafana service-account key.", { url: "https://grafana.example.com", apiKey: `glsa_${token(32)}` }],
      ["github-deploy-bot", "github", "production", 90, "Bot token for release automation.", { personalAccessToken: `ghp_${token(27)}`, username: "acme-deploy-bot", repository: "acme/platform" }],
      ["slack-alerts", "slack", "production", null, "Alerting webhook for #ops-alerts.", { webhookUrl: `https://hooks.slack.example.com/services/${hex(6)}/${hex(6)}`, botToken: `xoxb-${token(24)}` }],
      ["vault-root-token", "vault", "production", 30, "Break-glass Vault token.", { url: "https://vault.example.com:8200", token: `hvs.${token(24)}`, namespace: "admin" }],
      ["argocd", "argocd", "production", null, "GitOps controller.", { serverUrl: "https://argocd.example.com", authToken: token(40), username: "admin" }],
      ["k8s-staging", "kubernetes", "staging", null, "Staging cluster service account.", { apiServer: "https://k8s-staging.example.com:6443", token: token(48), namespace: "default" }],
    ],
  },
  {
    name: "Mobile Backend",
    description: "APIs and queues behind the iOS and Android apps.",
    credentials: [
      ["mobile-mongo", "mongodb", "production", 90, "User profiles and devices.", { host: ip(), port: "27017", database: "mobile", username: "mobile_api", password: token(), authSource: "admin" }],
      ["mobile-mongo-dev", "mongodb", "development", null, "Developer sandbox.", { host: ip(), port: "27017", database: "mobile_dev", username: "dev", password: token(), authSource: "admin" }],
      ["push-notifications", "api-key", "production", 180, "Push gateway server key.", { apiKey: `push_${token(32)}`, apiUrl: "https://push.example.com/v1" }],
      ["mobile-rabbitmq", "rabbitmq", "production", null, "Background job queue.", { host: ip(), port: "5672", username: "mobile", password: token(), vhost: "/mobile" }],
      ["mobile-registry", "docker-registry", "production", null, "Container registry for API images.", { url: "https://registry.example.com", username: "ci-mobile", password: token() }],
      ["datadog", "datadog", "production", null, "Metrics and APM.", { apiKey: hex(16), appKey: hex(20), site: "datadoghq.eu" }],
    ],
  },
];

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/** Signs up a user, or signs in if the account already exists. */
async function ensureUser(person) {
  const session = new Session();
  try {
    const res = await session.post("/api/auth/signup", { ...person, password: PASSWORD });
    return { session, user: res?.user ?? res?.data?.user ?? res?.data };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status >= 500) throw error;
    const res = await session.post("/api/auth/login", { username: person.username, password: PASSWORD });
    return { session, user: res?.user ?? res?.data?.user ?? res?.data };
  }
}

/** Records a reveal audit event for one secret field of a credential. */
async function reveal(session, credentialId, field) {
  try {
    await session.post(`/api/credentials/${credentialId}/reveal`, { field });
  } catch (error) {
    // Older API: fetching a credential is what records the access event.
    if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) throw error;
    await session.get(`/api/credentials/${credentialId}`);
  }
}

const SECRET_FIELDS = ["password", "apiKey", "secret", "secretAccessKey", "token", "authToken", "personalAccessToken", "clientSecret", "webhookUrl"];

async function main() {
  log(`Seeding demo data into ${BASE_URL}`);

  const probe = new Session();
  try {
    await probe.post("/api/auth/login", { username: OWNER.username, password: PASSWORD });
    log(`Demo owner "${OWNER.username}" already exists - nothing to do.`);
    return;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status >= 500) throw error;
  }

  const owner = { session: new Session(), user: null };
  try {
    const res = await owner.session.post("/api/auth/signup", { ...OWNER, password: PASSWORD });
    owner.user = res?.user ?? res?.data?.user ?? res?.data;
  } catch (error) {
    if (error instanceof ApiError && error.status < 500 && /already exists/i.test(error.apiMessage)) {
      log(`Demo owner "${OWNER.username}" already exists (with a different password) - nothing to do.`);
      return;
    }
    throw error;
  }
  log(`+ owner ${OWNER.firstName} ${OWNER.lastName} (${owner.user?.role ?? "unknown role"})`);
  if (owner.user?.role && owner.user.role !== "platform_admin") {
    log("  note: this instance already had users, so the demo owner is not the platform admin.");
  }

  const orgs = await owner.session.get("/api/organizations");
  const orgList = Array.isArray(orgs?.data) ? orgs.data : [];
  const org = orgList[0];
  if (!org?.id) throw new Error("The demo owner has no organization.");
  log(`+ organization "${org.name}"`);

  const teammates = [];
  for (const mate of TEAMMATES) {
    const { role, ...person } = mate;
    const account = await ensureUser(person);
    try {
      await owner.session.post(`/api/organizations/${org.id}/members`, { email: person.email, role });
    } catch (error) {
      if (!(error instanceof ApiError) || !/already/i.test(error.apiMessage)) throw error;
    }
    teammates.push({ ...mate, session: account.session });
    log(`+ ${role.padEnd(6)} ${person.firstName} ${person.lastName}`);
  }

  let credentialCount = 0;
  let revealCount = 0;
  for (const project of PROJECTS) {
    const created = await owner.session.post("/api/projects", {
      name: project.name,
      description: project.description,
      organizationId: org.id,
    });
    const projectId = created?.data?.id;
    if (!projectId) throw new Error(`Project "${project.name}" was not created.`);

    for (const [name, type, environment, rotationDays, description, fields] of project.credentials) {
      const res = await owner.session.post("/api/credentials", {
        projectId,
        name,
        type,
        environment,
        rotationDays,
        description,
        fields,
      });
      credentialCount += 1;

      // Production secrets get looked at; that is what the audit log is for.
      const credentialId = res?.data?.id;
      const secretField = SECRET_FIELDS.find((f) => f in fields);
      if (credentialId && secretField && environment === "production" && randomInt(0, 3) > 0) {
        // Owner, admin or a member reveals it (never the read-only viewer).
        const actors = [owner.session, ...teammates.filter((t) => t.role !== "viewer").map((t) => t.session)];
        const actor = actors[randomInt(0, actors.length)];
        await reveal(actor, credentialId, secretField);
        revealCount += 1;
      }
    }
    log(`+ project ${project.name} (${project.credentials.length} credentials)`);
  }

  log("");
  log(`Done: ${PROJECTS.length} projects, ${credentialCount} credentials, ${TEAMMATES.length + 1} users, ${revealCount} reveals.`);
  log(`Sign in at ${BASE_URL}/login as "${OWNER.username}" (or ${TEAMMATES.map((t) => t.username).join(", ")}) with the DEMO_PASSWORD.`);
}

main().catch((error) => {
  process.stderr.write(`seed-demo failed: ${error.message}\n`);
  process.exit(1);
});

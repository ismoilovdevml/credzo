/** Builds connection URIs for database / broker credentials from their field values. */

const MASK = "••••";

/** Pass as `password` to render the password as a mask. */
export const MASKED = Symbol("masked");

type Scheme = { protocol: string; database: "path" | "redis-index" | "vhost" | "none"; userless?: boolean };

const SCHEMES: Record<string, Scheme> = {
  postgresql: { protocol: "postgresql", database: "path" },
  timescaledb: { protocol: "postgresql", database: "path" },
  mysql: { protocol: "mysql", database: "path" },
  mariadb: { protocol: "mysql", database: "path" },
  clickhouse: { protocol: "clickhouse", database: "path" },
  mongodb: { protocol: "mongodb", database: "path" },
  redis: { protocol: "redis", database: "redis-index", userless: true },
  "redis-queue": { protocol: "redis", database: "none", userless: true },
  rabbitmq: { protocol: "amqp", database: "vhost" },
};

export function supportsConnectionString(type: string): boolean {
  return type in SCHEMES;
}

/**
 * `postgresql://user:pass@host:5432/db` from the non-secret field values.
 * `password` is the plain password, MASKED to show a placeholder (secret not
 * revealed yet), or null when the credential has none. Returns null for
 * unsupported types or when the host is missing.
 */
export function buildConnectionString(
  type: string,
  values: Record<string, string | undefined>,
  password: string | typeof MASKED | null
): string | null {
  const scheme = SCHEMES[type];
  const host = values.host?.trim();
  if (!scheme || !host) return null;

  const username = scheme.userless ? "" : (values.username ?? "");
  const secret = password === MASKED ? MASK : password ? encodeURIComponent(password) : "";
  const userInfo = username || secret ? `${encodeURIComponent(username)}${secret ? `:${secret}` : ""}@` : "";
  const port = values.port ? `:${values.port}` : "";

  let path = "";
  if (scheme.database === "path" && values.database) path = `/${encodeURIComponent(values.database)}`;
  if (scheme.database === "redis-index" && values.db) path = `/${encodeURIComponent(values.db)}`;
  if (scheme.database === "vhost" && values.vhost) path = `/${encodeURIComponent(values.vhost)}`;

  const query = new URLSearchParams();
  if (type === "mongodb" && values.authSource) query.set("authSource", values.authSource);
  if ((type === "postgresql" || type === "timescaledb") && values.sslMode) query.set("sslmode", values.sslMode);
  const search = query.toString() ? `?${query.toString()}` : "";

  return `${scheme.protocol}://${userInfo}${host}${port}${path}${search}`;
}

# Credzo architecture

Credzo is a single Next.js application (App Router) that serves both the UI and
a JSON API from one Node.js process. State lives in one SQLite database. There
are no other services to run.

```
Browser ──HTTPS──▶ Next.js server (Node >= 22)
                     ├─ app/            pages (React, client components)
                     ├─ app/api/**      route handlers → { success, data | error }
                     ├─ proxy.ts        same-origin check for mutating requests
                     └─ lib/            auth, RBAC, crypto, audit, data access
                                  │
                                  ▼
                       SQLite (better-sqlite3, WAL) in $DATA_DIR/credzo.db
```

## Data and storage

- **Location.** Everything is stored under `DATA_DIR` (default `./data`,
  `/app/data` in the Docker image): the database `credzo.db` and, when no key
  is supplied via the environment, the generated key file `encryption.key`.
  Back up the whole directory.
- **Schema.** Tables are created on first start (`lib/db.ts`): `users`,
  `organizations`, `organization_members`, `invitations`, `projects`,
  `project_members`, `services`, `credentials`, `sessions`,
  `login_challenges`, `audit_logs` and `shares` (one-time links). Simple
  data migrations run at start-up, keyed by a schema version.

## Security model

| Concern | Mechanism |
|---|---|
| Passwords | scrypt with a per-user random salt; constant-time comparison. |
| Secrets at rest | Credential fields and TOTP secrets are encrypted with AES-256-GCM (random 96-bit IV, auth tag, versioned `enc:v1:` prefix). |
| Master key | `CREDZO_ENCRYPTION_KEY` (32 bytes, base64 or hex; `openssl rand -base64 32`). If unset, a random key is generated once into `$DATA_DIR/encryption.key` (mode 0600). Losing the key makes stored secrets unrecoverable. |
| Sessions | Random 256-bit token in an HTTP-only, `SameSite=Lax` cookie (`Secure` unless `COOKIE_SECURE=false`). Only a SHA-256 hash of the token is stored, so a database leak does not yield usable sessions. |
| CSRF | State-changing requests must carry an `Origin` matching the host. |
| Two-factor auth | Optional TOTP (RFC 6238, 30 s steps, replay-protected) plus single-use backup codes stored as hashes. Sign-in with 2FA goes through a short-lived login challenge. |
| Abuse | In-memory rate limits on sign-in and other sensitive endpoints; request body size caps. |
| Responses | API responses are `Cache-Control: no-store`. |

## Access control (RBAC)

- **Platform role.** The first account created becomes `platform_admin` and can
  manage all users from `/dashboard/admin`. Everyone else is a `user`.
- **Organization roles.** Each account gets its own organization on sign-up.
  Members are added with one of:

  | Role | Can |
  |---|---|
  | `owner` | everything, including deleting the organization and managing owners |
  | `admin` | manage members (except owners), projects and credentials |
  | `member` | create and edit projects and credentials, reveal secrets |
  | `viewer` | read-only; cannot reveal or change secrets |

- **Projects** belong to an organization; per-project membership can further
  restrict who sees a project. Every API handler checks the caller's role
  against the resource before reading or writing (`lib/authorization.ts`).

## One-time share links (zero-knowledge)

A secret can be shared with someone outside Credzo via a link that opens once
(or a small number of times) and expires after 1 h, 24 h or 7 days.

1. The browser encrypts the secret with AES-GCM using a random key, optionally
   mixed with a passphrase through PBKDF2.
2. Only ciphertext, IV and salt are sent to the server. The key travels in the
   URL fragment (`#...`), which browsers never send to the server.
3. The server enforces expiry, view count and revocation, and deletes the
   ciphertext once the link is used up. It can never decrypt the payload.

## Audit log

Security-relevant events are appended to `audit_logs` with actor, organization,
resource, IP address and user agent: sign-ins (including failures), sign-up,
member invitations and role changes, project and credential create/update/
delete, secret reveals, share link creation/opening/revocation. Organization
owners and admins read it at `/dashboard/audit`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `CREDZO_ENCRYPTION_KEY` | generated key file | Master key for encryption at rest. |
| `DATA_DIR` | `./data` | Database and key file location. |
| `COOKIE_SECURE` | `true` in production | Set `false` only for plain HTTP on a trusted network. |
| `PORT` | `3000` | Listening port. |

See `.env.example`. The Docker image runs as a non-root user, keeps data in the
`/app/data` volume and exposes a health check at `GET /api/health`.

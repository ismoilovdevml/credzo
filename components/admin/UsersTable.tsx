"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, Users } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  IconButton,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { notify } from "@/components/Toast";
import { api, errorMessage } from "@/lib/api-client";
import { formatDate } from "./format";

/** Row shape of GET /api/users. */
interface PlatformUser {
  id: string;
  platformRole: string;
  createdAt: string;
  lastLogin: string | null;
  user: { id: string; username: string; email: string; firstName: string; lastName: string };
}

const displayName = (row: PlatformUser) => `${row.user.firstName} ${row.user.lastName}`.trim() || row.user.username;

interface UsersTableProps {
  currentUserId: string | null;
  /** Called after a user is deleted so the overview numbers refresh. */
  onUserDeleted: () => void;
}

/** Every account on the platform with delete (platform admins only). */
export function UsersTable({ currentUserId, onUserDeleted }: UsersTableProps) {
  const [users, setUsers] = useState<PlatformUser[] | null>(null);
  const [failure, setFailure] = useState<{ attempt: number; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PlatformUser | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.get<PlatformUser[]>("/api/users", { signal: controller.signal })
      .then((data) => {
        setUsers(data);
        setFailure(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setFailure({ attempt, message: errorMessage(error, "Could not load users.") });
      });
    return () => controller.abort();
  }, [attempt]);

  const loadError = failure?.attempt === attempt ? failure.message : null;

  const filtered = useMemo(() => {
    if (!users) return [];
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((row) =>
      [displayName(row), row.user.username, row.user.email].some((value) => value.toLowerCase().includes(term))
    );
  }, [users, query]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    try {
      await api.del(`/api/users/${encodeURIComponent(target.id)}`);
      setUsers((current) => current?.filter((row) => row.id !== target.id) ?? current);
      notify.success(`${displayName(target)} was deleted`);
      onUserDeleted();
    } catch (error) {
      notify.error(errorMessage(error, "Could not delete the user."));
    }
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="admin-users-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <CardTitle id="admin-users-title" className="text-base">
            Users
          </CardTitle>
          <p className="text-[13.5px] text-muted">
            Every account on this Credzo instance.{users ? ` ${users.length.toLocaleString()} in total.` : ""}
          </p>
        </div>
        <div className="w-full sm:w-72">
          <Input
            type="search"
            inputSize="sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, username or email"
            aria-label="Search users"
            leading={<Search className="h-4 w-4" aria-hidden="true" />}
            data-testid="admin-users-search"
          />
        </div>
      </div>

      {loadError ? (
        <Card padded>
          <EmptyState
            bare
            icon={<Users />}
            title="Users could not be loaded"
            description={loadError}
            action={
              <Button variant="secondary" size="sm" onClick={() => setAttempt((value) => value + 1)}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : users === null ? (
        <Card padded className="flex flex-col gap-3" aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-[30px] w-[30px] rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={query ? "No users match your search" : "No users yet"}
          description={query ? "Try a different name, username or email." : undefined}
        />
      ) : (
        <Table aria-labelledby="admin-users-title" data-testid="admin-users-table">
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => {
              const name = displayName(row);
              const isPlatformAdmin = row.platformRole === "platform_admin";
              const isSelf = row.id === currentUserId;
              const blockedReason = isSelf
                ? "You cannot delete your own account here"
                : isPlatformAdmin
                  ? "Platform admin accounts cannot be deleted"
                  : null;
              return (
                <TableRow key={row.id} data-testid="admin-user-row">
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={name} size="sm" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-ink">
                          {name}
                          {isSelf && <span className="ml-1.5 text-[12.5px] font-normal text-muted">(you)</span>}
                        </span>
                        <span className="truncate text-[12.5px] text-muted">
                          @{row.user.username} · {row.user.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge tone={isPlatformAdmin ? "accent" : "neutral"} size="sm">
                      {isPlatformAdmin ? "Platform admin" : "User"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted">{formatDate(row.createdAt)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted">
                    {row.lastLogin ? formatDate(row.lastLogin) : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <IconButton
                      label={`Delete ${name}`}
                      title={blockedReason ?? `Delete ${name}`}
                      variant="danger"
                      size="sm"
                      disabled={blockedReason !== null}
                      onClick={() => setPendingDelete(row)}
                      data-testid="admin-user-delete"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        variant="danger"
        title="Delete user?"
        message={
          pendingDelete
            ? `${displayName(pendingDelete)} (@${pendingDelete.user.username}) will be deleted together with their personal projects and credentials. This cannot be undone.`
            : ""
        }
        details={[
          "Users who own an organisation or organisation projects must transfer them first.",
          "Their sessions end immediately.",
        ]}
        confirmText="Delete user"
      />
    </section>
  );
}

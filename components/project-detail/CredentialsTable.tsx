"use client";

import Link from "next/link";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { ServiceTile } from "@/components/ServiceIcon";
import { EnvBadge, IconButton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { CopySecretButton } from "./CopySecretButton";
import {
  ROTATION_TEXT,
  credentialSummary,
  credentialUrl,
  formatDateTime,
  relativeTime,
  rotationStatus,
  serviceLabel,
  type CredentialView,
} from "./model";

interface CredentialsTableProps {
  credentials: CredentialView[];
  canEdit: boolean;
  /** Reference time for relative dates and rotation status. */
  now: number;
  onDelete: (credential: CredentialView) => void;
}

export function CredentialsTable({ credentials, canEdit, now, onDelete }: CredentialsTableProps) {
  return (
    <Table aria-label="Credentials" minWidthClass="min-w-[820px]">
      <TableHeader>
        <tr>
          <TableHead>Name</TableHead>
          <TableHead>Environment</TableHead>
          <TableHead>Rotation</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {credentials.map((credential) => {
          const href = credentialUrl(credential.projectId, credential.id);
          const summary = credentialSummary(credential);
          const rotation = rotationStatus(credential, now);
          return (
            <TableRow key={credential.id} data-testid="credential-row" data-credential-id={credential.id}>
              <TableCell className="max-w-[360px]">
                <Link
                  href={href}
                  className="group flex min-w-0 items-center gap-3 rounded-lg text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  <ServiceTile type={credential.type} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-semibold group-hover:text-accent-ink">{credential.name}</span>
                    <span className="truncate font-mono text-[12.5px] text-muted" title={summary || undefined}>
                      {summary || serviceLabel(credential.type)}
                    </span>
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                {credential.environment ? (
                  <EnvBadge env={credential.environment} />
                ) : (
                  <span className="text-[13px] text-muted">Unassigned</span>
                )}
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold",
                    ROTATION_TEXT[rotation.state]
                  )}
                >
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
                  {rotation.label}
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap text-[13.5px] text-ink-2">
                <time dateTime={credential.updatedAt} title={formatDateTime(credential.updatedAt)}>
                  {relativeTime(credential.updatedAt, now)}
                </time>
              </TableCell>
              <TableCell className="py-2">
                <div className="flex justify-end gap-1">
                  <CopySecretButton credential={credential} />
                  <IconButton asChild label={`Open ${credential.name}`}>
                    <Link href={href}>
                      <Eye />
                    </Link>
                  </IconButton>
                  {canEdit && (
                    <>
                      <IconButton asChild label={`Edit ${credential.name}`}>
                        <Link href={`${href}/edit`}>
                          <Pencil />
                        </Link>
                      </IconButton>
                      <IconButton
                        label={`Delete ${credential.name}`}
                        variant="danger"
                        onClick={() => onDelete(credential)}
                        data-testid="delete-credential"
                      >
                        <Trash2 />
                      </IconButton>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

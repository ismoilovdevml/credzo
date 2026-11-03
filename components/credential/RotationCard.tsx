import Link from "next/link";
import { Badge, Card, CardHeader } from "@/components/ui";
import { formatDate, formatDateTime, formatDaysFromNow, getRotationStatus } from "./format";

export interface RotationCardProps {
  rotationDays: number | null;
  lastRotatedAt: string | null;
  createdAt: string;
  now: number;
  /** Shown when there is no policy and the user may set one. */
  editHref?: string;
}

/** Rotation policy, last rotation and the next due date with an on-schedule / due / overdue badge. */
export function RotationCard({ rotationDays, lastRotatedAt, createdAt, now, editHref }: RotationCardProps) {
  if (!rotationDays) {
    return (
      <Card>
        <CardHeader
          title="Rotation"
          actions={
            <Badge tone="neutral" data-testid="rotation-status">
              No policy
            </Badge>
          }
        />
        <div className="flex flex-col gap-2 px-5 py-4 text-[14px] text-muted">
          <p>No rotation period is set for this credential.</p>
          {editHref && (
            <Link href={editHref} className="w-fit font-semibold text-accent-ink hover:underline">
              Set a rotation period
            </Link>
          )}
        </div>
      </Card>
    );
  }

  const rotatedAt = lastRotatedAt ?? createdAt;
  const status = getRotationStatus(rotationDays, rotatedAt, now);

  return (
    <Card>
      <CardHeader
        title="Rotation"
        actions={
          <Badge tone={status.tone} dot data-testid="rotation-status" data-state={status.state}>
            {status.label}
          </Badge>
        }
      />
      <dl className="m-0 grid grid-cols-1 gap-4 px-5 py-4 min-[420px]:grid-cols-3 lg:grid-cols-1">
        <div className="flex flex-col gap-1">
          <dt className="text-[12.5px] font-semibold text-muted">Policy</dt>
          <dd className="m-0 text-[15px] font-bold text-ink">Every {rotationDays === 1 ? "day" : `${rotationDays} days`}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[12.5px] font-semibold text-muted">{lastRotatedAt ? "Last rotated" : "Created (never rotated)"}</dt>
          <dd className="m-0 text-[15px] font-bold text-ink">
            <time dateTime={rotatedAt} title={formatDateTime(rotatedAt)}>
              {formatDate(rotatedAt)}
            </time>
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[12.5px] font-semibold text-muted">Next rotation</dt>
          <dd className="m-0 flex flex-col">
            <time
              dateTime={status.dueAt}
              className={status.state === "overdue" ? "text-[15px] font-bold text-danger" : "text-[15px] font-bold text-ink"}
            >
              {formatDate(status.dueAt)}
            </time>
            <span className="text-[13px] text-muted">{formatDaysFromNow(status.daysLeft)}</span>
          </dd>
        </div>
      </dl>
    </Card>
  );
}

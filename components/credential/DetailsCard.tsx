import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardHeader, EnvBadge } from "@/components/ui";
import { formatDate, formatDateTime } from "./format";

export interface DetailsCardProps {
  serviceLabel: string;
  category?: string;
  environment: string | null;
  projectName: string;
  projectHref: string;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3">
      <dt className="flex-none text-[13.5px] font-medium text-muted">{label}</dt>
      <dd className="m-0 min-w-0 break-words text-right text-[14px] text-ink">{children}</dd>
    </div>
  );
}

function Stamp({ at, by }: { at: string; by: string | null }) {
  return (
    <>
      <time dateTime={at} title={formatDateTime(at)}>
        {formatDate(at)}
      </time>
      {by && <span className="block text-[13px] text-muted">by {by}</span>}
    </>
  );
}

/** Service, environment, project and created / updated stamps. */
export function DetailsCard(props: DetailsCardProps) {
  return (
    <Card>
      <CardHeader title="Details" />
      <dl className="m-0 divide-y divide-line-soft py-1">
        <Row label="Service">
          {props.serviceLabel}
          {props.category && <span className="block text-[13px] text-muted">{props.category}</span>}
        </Row>
        <Row label="Environment">
          {props.environment ? <EnvBadge env={props.environment} /> : <span className="text-muted">Not set</span>}
        </Row>
        <Row label="Project">
          <Link href={props.projectHref} className="font-medium text-accent-ink hover:underline">
            {props.projectName}
          </Link>
        </Row>
        <Row label="Created">
          <Stamp at={props.createdAt} by={props.createdBy} />
        </Row>
        <Row label="Last updated">
          <Stamp at={props.updatedAt} by={props.updatedBy} />
        </Row>
      </dl>
    </Card>
  );
}

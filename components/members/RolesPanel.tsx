import { Badge, Card, CardHeader } from "@/components/ui";
import { ORG_ROLES, ROLE_META } from "./roles";

/** "What each role can do" reference, matching lib/authorization.ts. */
export function RolesPanel() {
  return (
    <Card>
      <CardHeader title="What each role can do" />
      <dl className="flex flex-col gap-3.5 px-5 py-4">
        {ORG_ROLES.map((role) => (
          <div key={role} className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
            <dt className="flex-none sm:w-20 sm:pt-0.5">
              <Badge tone={ROLE_META[role].tone}>{ROLE_META[role].label}</Badge>
            </dt>
            <dd className="text-[14px] leading-relaxed text-muted">{ROLE_META[role].summary}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

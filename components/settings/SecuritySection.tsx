"use client";

import { useState } from "react";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { useSession } from "@/components/shell/SessionProvider";
import type { PublicUser } from "@/lib/types";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { SettingRow } from "./controls";
import { formatDateTime, formatRelative } from "./format";
import { SessionsList } from "./SessionsList";
import { DisableTwoFactorModal, EnableTwoFactorModal } from "./TwoFactorModals";

function backupCodesNote(remaining: number | undefined) {
  if (remaining === undefined) return null;
  if (remaining === 0) return <span className="font-medium text-danger">no backup codes left</span>;
  const text = `${remaining} backup ${remaining === 1 ? "code" : "codes"} left`;
  return remaining <= 3 ? <span className="font-medium text-warn">{text}</span> : text;
}

/** Password, two-factor authentication and active sessions. */
export function SecuritySection({
  profile,
  onProfileChange,
  reloadProfile,
}: {
  profile: PublicUser;
  onProfileChange: (changes: Partial<PublicUser>) => void;
  reloadProfile: () => void;
}) {
  const { refresh } = useSession();
  const [dialog, setDialog] = useState<"password" | "enable-2fa" | "disable-2fa" | null>(null);
  const [sessionsVersion, setSessionsVersion] = useState(0);
  const closeDialog = () => setDialog(null);

  const changedAt = profile.passwordChangedAt;
  const backupNote = backupCodesNote(profile.backupCodesRemaining);

  return (
    <Card className="p-5 sm:p-6">
      <CardTitle className="mb-1">
        Security
      </CardTitle>

      <SettingRow
        title="Password"
        description={
          changedAt ? (
            <>
              Last changed <time dateTime={changedAt} title={formatDateTime(changedAt)}>{formatRelative(changedAt)}</time>
            </>
          ) : (
            "Not changed since you created your account"
          )
        }
      >
        <Button variant="secondary" size="sm" data-testid="change-password-button" onClick={() => setDialog("password")}>
          Change password
        </Button>
      </SettingRow>

      <SettingRow
        title={
          <>
            Two-factor authentication
            <Badge data-testid="twofa-status" tone={profile.totpEnabled ? "success" : "neutral"} size="sm">
              {profile.totpEnabled ? "On" : "Off"}
            </Badge>
          </>
        }
        description={
          profile.totpEnabled ? (
            <>Authenticator app{backupNote && <> · {backupNote}</>}</>
          ) : (
            "Require a code from an authenticator app when you sign in."
          )
        }
      >
        {profile.totpEnabled ? (
          <Button variant="secondary" size="sm" data-testid="twofa-disable" onClick={() => setDialog("disable-2fa")}>
            Turn off
          </Button>
        ) : (
          <Button size="sm" data-testid="twofa-enable" onClick={() => setDialog("enable-2fa")}>
            Turn on
          </Button>
        )}
      </SettingRow>

      <SessionsList version={sessionsVersion} />

      <ChangePasswordModal
        open={dialog === "password"}
        onClose={closeDialog}
        onChanged={(result) => {
          if (result.passwordChangedAt) onProfileChange({ passwordChangedAt: result.passwordChangedAt });
          setSessionsVersion((value) => value + 1);
        }}
      />
      <EnableTwoFactorModal
        open={dialog === "enable-2fa"}
        onClose={closeDialog}
        onEnabled={() => {
          reloadProfile();
          void refresh();
        }}
      />
      <DisableTwoFactorModal
        open={dialog === "disable-2fa"}
        onClose={closeDialog}
        onDisabled={() => {
          onProfileChange({ totpEnabled: false, backupCodesRemaining: 0 });
          void refresh();
        }}
      />
    </Card>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { Avatar, Button, Card, CardTitle, Field, Input, Select } from "@/components/ui";
import { notify } from "@/components/Toast";
import { useSession } from "@/components/shell/SessionProvider";
import type { PublicUser } from "@/lib/types";
import { ApiError, api } from "@/lib/api-client";
import { errorMessage } from "./api";
import { browserTimeZone, listTimeZones, timeZoneOffset } from "./format";

interface ProfileForm {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  jobTitle: string;
  timezone: string;
}

type FieldName = keyof ProfileForm;
type FieldErrors = Partial<Record<FieldName, string>>;

const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Server messages start with the field label ("Username is already taken"); route them to that field. */
const FIELD_LABELS: [FieldName, RegExp][] = [
  ["firstName", /^first name/i],
  ["lastName", /^last name/i],
  ["username", /^username/i],
  ["email", /^(email|an account with this email)/i],
  ["jobTitle", /^job title/i],
  ["timezone", /^timezone/i],
];

function formFromProfile(profile: PublicUser): ProfileForm {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    username: profile.username,
    email: profile.email,
    jobTitle: profile.jobTitle ?? "",
    timezone: profile.timezone || browserTimeZone(),
  };
}

/** Every zone this browser knows, labelled with its current UTC offset; keeps an unknown saved zone selectable. */
function timeZoneOptions(selected: string): { value: string; label: string }[] {
  const zones = listTimeZones();
  const all = selected && !zones.includes(selected) ? [selected, ...zones] : zones;
  return all.map((zone) => {
    const name = zone.replace(/_/g, " ");
    const offset = timeZoneOffset(zone);
    return { value: zone, label: offset ? `${name} (${offset})` : name };
  });
}

function validate(form: ProfileForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.firstName.trim()) errors.firstName = "First name is required";
  if (!form.lastName.trim()) errors.lastName = "Last name is required";
  const username = form.username.trim();
  if (username.length < 3 || username.length > 32) errors.username = "Username must be 3–32 characters";
  else if (!USERNAME_PATTERN.test(username)) errors.username = "Use letters, numbers and underscores only";
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Enter a valid email address";
  return errors;
}

/** Profile card: name, username, email, job title and time zone. Sends only the fields that changed. */
export function ProfileSection({ profile, onSaved }: { profile: PublicUser; onSaved: (profile: PublicUser) => void }) {
  const { refresh } = useSession();
  const [form, setForm] = useState<ProfileForm>(() => formFromProfile(profile));
  const [baseline, setBaseline] = useState<ProfileForm>(form);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  // Built once: computing ~400 offsets is not free, and the list never changes while mounted.
  const [timeZones] = useState(() => timeZoneOptions(form.timezone));

  const dirty = (Object.keys(form) as FieldName[]).some((key) => form[key].trim() !== baseline[key].trim());
  const timezoneDetected = !profile.timezone && form.timezone === baseline.timezone;
  const displayName = `${form.firstName} ${form.lastName}`.trim() || form.username;

  const update = (key: FieldName) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const stored: ProfileForm = { ...formFromProfile(profile), timezone: profile.timezone ?? "" };
    const changes: Partial<ProfileForm> = {};
    for (const key of Object.keys(form) as FieldName[]) {
      const value = form[key].trim();
      if (value !== stored[key].trim()) changes[key] = value;
    }
    if (Object.keys(changes).length === 0) {
      setBaseline(form);
      return;
    }

    setSaving(true);
    try {
      const updated = await api.patch<PublicUser>("/api/user-profile", changes);
      const next = formFromProfile(updated);
      setForm(next);
      setBaseline(next);
      onSaved(updated);
      notify.success("Profile saved");
      await refresh();
    } catch (error) {
      const message = errorMessage(error, "Couldn't save your profile");
      const field = error instanceof ApiError ? FIELD_LABELS.find(([, pattern]) => pattern.test(message))?.[0] : undefined;
      if (field) setErrors({ [field]: message });
      else notify.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar name={displayName} size="xl" className="h-16 w-16 text-[22px] font-extrabold" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <CardTitle>Profile</CardTitle>
            <p className="text-[14px] text-muted">Visible to members of your organisation.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" error={errors.firstName} required>
            <Input
              data-testid="profile-first-name"
              value={form.firstName}
              onChange={(event) => update("firstName")(event.target.value)}
              autoComplete="given-name"
              maxLength={50}
            />
          </Field>
          <Field label="Last name" error={errors.lastName} required>
            <Input
              data-testid="profile-last-name"
              value={form.lastName}
              onChange={(event) => update("lastName")(event.target.value)}
              autoComplete="family-name"
              maxLength={50}
            />
          </Field>
          <Field label="Username" error={errors.username} required>
            <Input
              data-testid="profile-username"
              value={form.username}
              onChange={(event) => update("username")(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={32}
            />
          </Field>
          <Field label="Email" error={errors.email} required>
            <Input
              data-testid="profile-email"
              type="email"
              value={form.email}
              onChange={(event) => update("email")(event.target.value)}
              autoComplete="email"
              maxLength={254}
            />
          </Field>
          <Field label="Job title" error={errors.jobTitle} optional>
            <Input
              data-testid="profile-job-title"
              value={form.jobTitle}
              onChange={(event) => update("jobTitle")(event.target.value)}
              autoComplete="organization-title"
              placeholder="e.g. Platform engineer"
              maxLength={100}
            />
          </Field>
          <Field
            label="Time zone"
            error={errors.timezone}
            hint={timezoneDetected ? "Detected from your browser — save to keep it." : undefined}
          >
            <Select
              data-testid="profile-timezone"
              value={form.timezone}
              onChange={(event) => update("timezone")(event.target.value)}
            >
              {timeZones.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {dirty && !saving && <span className="text-[13px] text-muted">Unsaved changes</span>}
          <Button
            type="submit"
            data-testid="profile-save"
            loading={saving}
            disabled={!dirty && !timezoneDetected}
          >
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}

"use client";

import type { FormEvent } from "react";
import { Field, Input, SegmentedControl, Select, Textarea } from "@/components/ui";
import { CREDENTIAL_CONFIG } from "@/lib/config/constants";
import { getServiceMetadata } from "@/lib/services";
import type { ServiceType } from "@/lib/types";
import {
  type CredentialFormValues,
  type EnvironmentChoice,
  type FormErrors,
  ENVIRONMENT_OPTIONS,
  NAME_ERROR_KEY,
  NAME_INPUT_ID,
  ROTATION_PRESETS,
  fieldErrorKey,
  fieldInputId,
  isSecret,
  serviceFields,
} from "./form-model";
import { ServiceFieldInput } from "./ServiceFieldInput";

export const CREDENTIAL_FORM_ID = "credential-form";

interface CredentialDetailsFormProps {
  type: ServiceType;
  values: CredentialFormValues;
  onChange: (values: CredentialFormValues) => void;
  errors: FormErrors;
  onSubmit: () => void;
  /** Field names that already hold a saved value (edit mode). */
  storedFields?: ReadonlySet<string>;
}

/** Step 2: name, environment, the service's own fields, rotation reminder and notes. */
export function CredentialDetailsForm({ type, values, onChange, errors, onSubmit, storedFields }: CredentialDetailsFormProps) {
  const label = getServiceMetadata(type)?.label ?? type;
  const fields = serviceFields(type);
  const rotationOptions: number[] = [...ROTATION_PRESETS];
  const currentRotation = Number(values.rotation);
  if (values.rotation && !rotationOptions.includes(currentRotation)) {
    rotationOptions.push(currentRotation);
    rotationOptions.sort((a, b) => a - b);
  }

  const update = (patch: Partial<CredentialFormValues>) => onChange({ ...values, ...patch });
  const updateField = (name: string, value: string) => update({ fields: { ...values.fields, [name]: value } });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form id={CREDENTIAL_FORM_ID} noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field id={NAME_INPUT_ID} label="Name" required error={errors[NAME_ERROR_KEY]}>
        <Input
          value={values.name}
          onChange={(event) => update({ name: event.target.value })}
          placeholder={`e.g. Production ${label}`}
          maxLength={CREDENTIAL_CONFIG.NAME_MAX_LENGTH}
          autoComplete="off"
          data-testid="credential-name-input"
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink-2" aria-hidden="true">
          Environment
        </span>
        <SegmentedControl<EnvironmentChoice>
          aria-label="Environment"
          value={values.environment}
          onChange={(environment) => update({ environment })}
          options={ENVIRONMENT_OPTIONS.map((option) => ({
            value: option.value,
            label: <span data-testid={`env-${option.value}`}>{option.label}</span>,
          }))}
          className="w-fit"
        />
      </div>

      {fields.length > 0 && (
        <fieldset className="flex min-w-0 flex-col gap-4 border-t border-line-soft pt-5">
          <legend className="sr-only">{label} connection details</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <ServiceFieldInput
                key={`${type}:${field.name}`}
                field={field}
                id={fieldInputId(field.name)}
                value={values.fields[field.name] ?? ""}
                onChange={(value) => updateField(field.name, value)}
                secret={isSecret(type, field)}
                error={errors[fieldErrorKey(field.name)]}
                hasStoredValue={storedFields?.has(field.name) ?? false}
              />
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 border-t border-line-soft pt-5 sm:grid-cols-2">
        <Field
          label="Rotation reminder"
          hint="Flags the credential as due once this many days pass since its secret last changed."
        >
          <Select value={values.rotation} onChange={(event) => update({ rotation: event.target.value })} data-testid="rotation-select">
            <option value="">No reminder</option>
            {rotationOptions.map((days) => (
              <option key={days} value={String(days)}>
                Every {days} days
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Notes" optional>
        <Textarea
          value={values.description}
          onChange={(event) => update({ description: event.target.value })}
          placeholder="Anything teammates should know: VPN, read replicas, owners…"
          maxLength={CREDENTIAL_CONFIG.DESCRIPTION_MAX_LENGTH}
          rows={3}
        />
      </Field>
    </form>
  );
}

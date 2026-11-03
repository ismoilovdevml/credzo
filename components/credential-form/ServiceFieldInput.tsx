"use client";

import { useState } from "react";
import { Eye, EyeOff, Wand2 } from "lucide-react";
import { Button, Field, IconButton, Input, Textarea } from "@/components/ui";
import type { ServiceFieldDefinition } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { generateSecret } from "./generate-secret";

interface ServiceFieldInputProps {
  field: ServiceFieldDefinition;
  id: string;
  value: string;
  onChange: (value: string) => void;
  secret: boolean;
  error?: string;
  /** The field already holds a saved value (edit mode). Saved multi-line secrets start masked. */
  hasStoredValue: boolean;
}

/** One dynamic field from the service metadata: text, number, url, email, password or textarea. */
export function ServiceFieldInput({ field, id, value, onChange, secret, error, hasStoredValue }: ServiceFieldInputProps) {
  const multiline = field.type === "textarea";
  // Single-line secrets are always masked at first; an empty key/kubeconfig box stays open for pasting.
  const [revealed, setRevealed] = useState(!secret || (multiline && !hasStoredValue));
  const canGenerate = field.type === "password";
  const lowerLabel = field.label.toLowerCase();

  const generate = () => {
    onChange(generateSecret());
    setRevealed(true);
  };

  const toggle = (
    <IconButton
      label={revealed ? `Hide ${lowerLabel}` : `Show ${lowerLabel}`}
      size="sm"
      aria-pressed={revealed}
      aria-controls={id}
      onClick={() => setRevealed((current) => !current)}
    >
      {revealed ? <EyeOff /> : <Eye />}
    </IconButton>
  );

  const labelAction =
    secret && (canGenerate || multiline) ? (
      <div className="flex items-center gap-1">
        {canGenerate && (
          <Button
            variant="link"
            size="sm"
            leftIcon={<Wand2 />}
            onClick={generate}
            data-testid={`generate-${field.name}`}
          >
            Generate
          </Button>
        )}
        {multiline && toggle}
      </div>
    ) : undefined;

  const common = {
    value,
    placeholder: field.placeholder,
    spellCheck: false,
    "data-testid": `field-${field.name}`,
  };

  let control;
  if (multiline && revealed) {
    control = (
      <Textarea
        {...common}
        rows={secret ? 6 : 4}
        mono={secret || /cert/i.test(field.name)}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
    );
  } else if (multiline) {
    // Masked multi-line secret: a read-only password box until the user chooses to show it.
    control = (
      <Input
        {...common}
        type="password"
        mono
        readOnly
      />
    );
  } else {
    const type = field.type === "password" ? (revealed ? "text" : "password") : field.type;
    control = (
      <Input
        {...common}
        type={type}
        mono={secret || field.type === "number" || field.type === "url"}
        inputMode={field.type === "number" ? "numeric" : undefined}
        min={field.type === "number" ? (field.name === "port" ? 1 : 0) : undefined}
        max={field.name === "port" ? 65535 : undefined}
        autoComplete={secret ? "new-password" : "off"}
        trailing={secret ? toggle : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <Field
      id={id}
      label={field.label}
      required={field.required}
      hint={multiline && !revealed ? "Hidden. Use the eye button to view or edit it." : field.description}
      error={error}
      labelAction={labelAction}
      className={cn((multiline || secret) && "sm:col-span-2")}
    >
      {control}
    </Field>
  );
}

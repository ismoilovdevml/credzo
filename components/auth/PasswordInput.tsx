"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { IconButton, Input, type InputProps } from "@/components/ui";

export type PasswordInputProps = Omit<InputProps, "type" | "trailing">;

/** Password field with a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>((props, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      ref={ref}
      type={visible ? "text" : "password"}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <IconButton
          label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          disabled={props.disabled}
        >
          {visible ? <EyeOff /> : <Eye />}
        </IconButton>
      }
      {...props}
    />
  );
});
PasswordInput.displayName = "PasswordInput";

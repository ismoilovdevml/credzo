"use client";

import { Moon, Sun } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";

/** Light/dark switch for the top bar. The full light/dark/system picker lives in Settings and the user menu. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <IconButton
      variant="secondary"
      label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggleTheme}
      className={className}
    >
      {isDark ? <Sun /> : <Moon />}
    </IconButton>
  );
}

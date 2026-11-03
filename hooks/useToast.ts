import { useCallback, useState } from "react";
import type { ToastType } from "@/components/Toast";

interface ToastState {
  message: string;
  type: ToastType;
  isOpen: boolean;
}

/**
 * Local state for a controlled `<Toast {...toast} onClose={hideToast} />`.
 * New code should call `notify()` from "@/components/Toast" instead.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    message: "",
    type: "info",
    isOpen: false,
  });

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToast({ message, type, isOpen: true });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return { toast, showToast, hideToast };
}

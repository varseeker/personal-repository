"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel = "Loading…",
  disabled,
  ...props
}: React.ComponentProps<"button"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button {...props} type={props.type ?? "submit"} disabled={pending || disabled} aria-busy={pending || undefined}>
      {pending ? pendingLabel : children}
    </button>
  );
}
